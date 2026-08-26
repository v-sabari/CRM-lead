import { CurrentUser } from '../middleware/auth';
import { LeadFilter } from '../types/lead-filter';
import { BadRequestError } from '../middleware/error-handler';

const SYSTEM_FIELDS: Record<string, { column: string; type: string }> = {
  name: { column: 'name', type: 'string' },
  phone: { column: 'phone', type: 'string' },
  email: { column: 'email', type: 'string' },
  assignedTo: { column: 'assigned_to', type: 'string' },
  createdBy: { column: 'user_id', type: 'string' },
  followUpDate: { column: 'follow_up_date', type: 'date' },
  createdAt: { column: 'created_at', type: 'date' },
  updatedAt: { column: 'updated_at', type: 'date' },
};

type FilterClause = { sql: string; params: string[] };

function buildSystemFieldClause(filter: LeadFilter): FilterClause {
  const systemField = SYSTEM_FIELDS[filter.fieldId];
  if (!systemField) {
    throw new BadRequestError(`Unknown system field: ${filter.fieldId}`);
  }

  const { column, type } = systemField;
  const { condition, value, inputType } = filter;

  if (type === 'string') {
    if (inputType === 'multiselect' && (condition === 'is' || condition === 'contain')) {
      const ids = value?.split(',').map((v) => v.trim()).filter(Boolean) || [];
      if (ids.length === 0) {
        throw new BadRequestError('multiselect is/contain requires at least one value');
      }
      if (condition === 'is') {
        const placeholders = ids.map(() => '?').join(', ');
        return {
          sql: `leads.${column} IN (${placeholders})`,
          params: ids,
        };
      }
      if (condition === 'contain') {
        const orConditions = ids.map(() => `leads.${column} LIKE ?`).join(' OR ');
        const params = ids.map((id) => `%${id}%`);
        return { sql: `(${orConditions})`, params };
      }
    }

    if (inputType === 'multiselect' && (condition === 'is not' || condition === 'does not contain')) {
      const ids = value?.split(',').map((v) => v.trim()).filter(Boolean) || [];
      if (ids.length === 0) {
        throw new BadRequestError('multiselect is not/does not contain requires at least one value');
      }
      if (condition === 'is not') {
        const placeholders = ids.map(() => '?').join(', ');
        return {
          sql: `(leads.${column} NOT IN (${placeholders}) OR leads.${column} IS NULL)`,
          params: ids,
        };
      }
      if (condition === 'does not contain') {
        const andConditions = ids.map(() => `(leads.${column} NOT LIKE ? OR leads.${column} IS NULL)`).join(' AND ');
        const params = ids.map((id) => `%${id}%`);
        return { sql: andConditions, params };
      }
    }

    switch (condition) {
      case 'is':
        return { sql: `LOWER(leads.${column}) = LOWER(?)`, params: [value || ''] };
      case 'is not':
        return {
          sql: `(LOWER(leads.${column}) != LOWER(?) OR leads.${column} IS NULL)`,
          params: [value || ''],
        };
      case 'contain':
        return { sql: `LOWER(leads.${column}) LIKE LOWER(?)`, params: [`%${value || ''}%`] };
      case 'does not contain':
        return {
          sql: `(LOWER(leads.${column}) NOT LIKE LOWER(?) OR leads.${column} IS NULL)`,
          params: [`%${value || ''}%`],
        };
      case 'starts with':
        return { sql: `LOWER(leads.${column}) LIKE LOWER(?)`, params: [`${value || ''}%`] };
      case 'ends with':
        return { sql: `LOWER(leads.${column}) LIKE LOWER(?)`, params: [`%${value || ''}`] };
      case 'is empty':
        return {
          sql: `(leads.${column} IS NULL OR leads.${column} = '')`,
          params: [],
        };
      case 'is not empty':
        return {
          sql: `(leads.${column} IS NOT NULL AND leads.${column} != '')`,
          params: [],
        };
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for string field type`);
    }
  }

  if (type === 'date') {
    switch (condition) {
      case 'before':
        return { sql: `leads.${column} < ?`, params: [value || ''] };
      case 'after':
        return { sql: `leads.${column} > ?`, params: [value || ''] };
      case 'is':
        return { sql: `DATE(leads.${column}) = DATE(?)`, params: [value || ''] };
      case 'is empty':
        return { sql: `leads.${column} IS NULL`, params: [] };
      case 'is not empty':
        return { sql: `leads.${column} IS NOT NULL`, params: [] };
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for date field type`);
    }
  }

  if (type === 'number') {
    switch (condition) {
      case 'is':
        return { sql: `CAST(leads.${column} AS REAL) = ?`, params: [value || '0'] };
      case 'greater than':
        return { sql: `CAST(leads.${column} AS REAL) > ?`, params: [value || '0'] };
      case 'less than':
        return { sql: `CAST(leads.${column} AS REAL) < ?`, params: [value || '0'] };
      case 'is empty':
        return {
          sql: `(leads.${column} IS NULL OR leads.${column} = '')`,
          params: [],
        };
      case 'is not empty':
        return {
          sql: `(leads.${column} IS NOT NULL AND leads.${column} != '')`,
          params: [],
        };
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for number field type`);
    }
  }

  if (type === 'boolean') {
    switch (condition) {
      case 'is':
        if (value === 'true') {
          return { sql: `leads.${column} = 'true'`, params: [] };
        }
        if (value === 'false') {
          return { sql: `(leads.${column} = 'false' OR leads.${column} IS NULL)`, params: [] };
        }
        throw new BadRequestError('Boolean "is" condition requires value "true" or "false"');
      case 'is empty':
        return { sql: `leads.${column} IS NULL`, params: [] };
      case 'is not empty':
        return { sql: `leads.${column} IS NOT NULL`, params: [] };
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for boolean field type`);
    }
  }

  throw new BadRequestError(`Unsupported field type: ${type}`);
}

function buildCustomFieldClause(filter: LeadFilter): FilterClause {
  const { fieldId, fieldType, condition, value } = filter;

  const exists = (extraWhere: string, extraParams: string[]) => ({
    sql: `EXISTS (SELECT 1 FROM lead_custom_field_values lcfv WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ? AND ${extraWhere})`,
    params: [fieldId, ...extraParams],
  });

  const notExists = (extraWhere: string, extraParams: string[]) => ({
    sql: `NOT EXISTS (SELECT 1 FROM lead_custom_field_values lcfv WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ? AND ${extraWhere})`,
    params: [fieldId, ...extraParams],
  });

  const anyExists = () => ({
    sql: `EXISTS (SELECT 1 FROM lead_custom_field_values lcfv WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ?)`,
    params: [fieldId],
  });

  const noneExists = () => ({
    sql: `NOT EXISTS (SELECT 1 FROM lead_custom_field_values lcfv WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ?)`,
    params: [fieldId],
  });

  if (fieldType === 'string') {
    switch (condition) {
      case 'is':
        return exists('LOWER(lcfv.value) = LOWER(?)', [value || '']);
      case 'is not':
        return {
          sql: `NOT EXISTS (SELECT 1 FROM lead_custom_field_values lcfv WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ? AND LOWER(lcfv.value) = LOWER(?))`,
          params: [fieldId, value || ''],
        };
      case 'contain':
        return exists('LOWER(lcfv.value) LIKE LOWER(?)', [`%${value || ''}%`]);
      case 'does not contain':
        return {
          sql: `NOT EXISTS (SELECT 1 FROM lead_custom_field_values lcfv WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ? AND LOWER(lcfv.value) LIKE LOWER(?))`,
          params: [fieldId, `%${value || ''}%`],
        };
      case 'starts with':
        return exists('LOWER(lcfv.value) LIKE LOWER(?)', [`${value || ''}%`]);
      case 'ends with':
        return exists('LOWER(lcfv.value) LIKE LOWER(?)', [`%${value || ''}`]);
      case 'is empty':
        return noneExists();
      case 'is not empty':
        return anyExists();
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for custom string field type`);
    }
  }

  if (fieldType === 'number') {
    switch (condition) {
      case 'is':
        return exists('CAST(lcfv.value AS REAL) = ?', [value || '0']);
      case 'greater than':
        return exists('CAST(lcfv.value AS REAL) > ?', [value || '0']);
      case 'less than':
        return exists('CAST(lcfv.value AS REAL) < ?', [value || '0']);
      case 'is empty':
        return noneExists();
      case 'is not empty':
        return anyExists();
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for custom number field type`);
    }
  }

  if (fieldType === 'date') {
    switch (condition) {
      case 'before':
        return exists('lcfv.value < ?', [value || '']);
      case 'after':
        return exists('lcfv.value > ?', [value || '']);
      case 'is':
        return exists('DATE(lcfv.value) = DATE(?)', [value || '']);
      case 'is empty':
        return noneExists();
      case 'is not empty':
        return anyExists();
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for custom date field type`);
    }
  }

  if (fieldType === 'boolean') {
    switch (condition) {
      case 'is':
        if (value === 'true') {
          return exists('lcfv.value = ?', ['true']);
        }
        if (value === 'false') {
          return {
            sql: `NOT EXISTS (SELECT 1 FROM lead_custom_field_values lcfv WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ? AND lcfv.value = ?)`,
            params: [fieldId, 'true'],
          };
        }
        throw new BadRequestError('Boolean "is" condition requires value "true" or "false"');
      case 'is empty':
        return noneExists();
      case 'is not empty':
        return anyExists();
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for custom boolean field type`);
    }
  }

  throw new BadRequestError(`Unsupported custom field type: ${fieldType}`);
}

function buildVisibilityClause(user: CurrentUser): FilterClause {
  if (user.role === 'agent') {
    return {
      sql: 'leads.assigned_to = ?',
      params: [user.userId],
    };
  }
  return { sql: '1=1', params: [] };
}

function buildFreeTextClause(q: string): FilterClause {
  const trimmed = q.trim();
  if (!trimmed) {
    return { sql: '1=1', params: [] };
  }

  return {
    sql: `(LOWER(leads.name) LIKE LOWER(?) OR LOWER(leads.phone) LIKE LOWER(?) OR LOWER(leads.email) LIKE LOWER(?) OR LOWER(leads.e164) LIKE LOWER(?))`,
    params: [`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`],
  };
}

export function buildLeadFilterClause(
  filters: LeadFilter[],
  logic: 'AND' | 'OR',
  q: string | undefined,
  user: CurrentUser,
): FilterClause {
  const clauses: FilterClause[] = [];

  clauses.push({ sql: 'leads.tenant_id = ?', params: [user.tenantId] });
  clauses.push(buildVisibilityClause(user));

  if (q && q.trim()) {
    clauses.push(buildFreeTextClause(q));
  }

  if (filters.length > 0) {
    const filterClauses = filters.map((filter) => {
      if (SYSTEM_FIELDS[filter.fieldId]) {
        return buildSystemFieldClause(filter);
      }
      return buildCustomFieldClause(filter);
    });

    const joiner = logic === 'OR' ? ' OR ' : ' AND ';
    const filterSql = filterClauses.map((c) => `(${c.sql})`).join(joiner);
    const filterParams = filterClauses.flatMap((c) => c.params);

    clauses.push({ sql: filterSql, params: filterParams });
  }

  const whereSql = clauses.map((c) => `(${c.sql})`).join(' AND ');
  const allParams = clauses.flatMap((c) => c.params);

  return { sql: whereSql, params: allParams };
}
