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
        if (column === 'email') {
          return {
            sql: `(LOWER(leads.${column}) != LOWER(?) OR leads.${column} IS NULL)`,
            params: [value || ''],
          };
        }
        return { sql: `LOWER(leads.${column}) != LOWER(?)`, params: [value || ''] };
      case 'contain':
        return { sql: `leads.${column} LIKE ?`, params: [`%${value || ''}%`] };
      case 'does not contain':
        return {
          sql: `(leads.${column} NOT LIKE ? OR leads.${column} IS NULL)`,
          params: [`%${value || ''}%`],
        };
      case 'starts with':
        return { sql: `leads.${column} LIKE ?`, params: [`${value || ''}%`] };
      case 'ends with':
        return { sql: `leads.${column} LIKE ?`, params: [`%${value || ''}`] };
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

  const baseExists = `EXISTS (SELECT 1 FROM lead_custom_field_values lcfv WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ?`;
  const baseNotExists = `NOT EXISTS (SELECT 1 FROM lead_custom_field_values lcfv WHERE lcfv.lead_id = leads.id AND lcfv.field_id = ?`;

  if (fieldType === 'string') {
    switch (condition) {
      case 'is':
        return {
          sql: `${baseExists} AND LOWER(lcfv.value) = LOWER(?))`,
          params: [fieldId, value || ''],
        };
      case 'is not':
        return {
          sql: `(${baseNotExists} OR LOWER(lcfv.value) != LOWER(?))`,
          params: [fieldId, value || ''],
        };
      case 'contain':
        return {
          sql: `${baseExists} AND lcfv.value LIKE ?)`,
          params: [fieldId, `%${value || ''}%`],
        };
      case 'does not contain':
        return {
          sql: `(${baseNotExists} OR lcfv.value NOT LIKE ?)`,
          params: [fieldId, `%${value || ''}%`],
        };
      case 'starts with':
        return {
          sql: `${baseExists} AND lcfv.value LIKE ?)`,
          params: [fieldId, `${value || ''}%`],
        };
      case 'ends with':
        return {
          sql: `${baseExists} AND lcfv.value LIKE ?)`,
          params: [fieldId, `%${value || ''}`],
        };
      case 'is empty':
        return {
          sql: `(${baseNotExists} OR lcfv.value IS NULL OR lcfv.value = '')`,
          params: [fieldId],
        };
      case 'is not empty':
        return {
          sql: `${baseExists} AND lcfv.value IS NOT NULL AND lcfv.value != '')`,
          params: [fieldId],
        };
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for custom string field type`);
    }
  }

  if (fieldType === 'number') {
    switch (condition) {
      case 'is':
        return {
          sql: `${baseExists} AND CAST(lcfv.value AS REAL) = ?)`,
          params: [fieldId, value || '0'],
        };
      case 'greater than':
        return {
          sql: `${baseExists} AND CAST(lcfv.value AS REAL) > ?)`,
          params: [fieldId, value || ''],
        };
      case 'less than':
        return {
          sql: `${baseExists} AND CAST(lcfv.value AS REAL) < ?)`,
          params: [fieldId, value || ''],
        };
      case 'is empty':
        return {
          sql: `(${baseNotExists} OR lcfv.value IS NULL OR lcfv.value = '')`,
          params: [fieldId],
        };
      case 'is not empty':
        return {
          sql: `${baseExists} AND lcfv.value IS NOT NULL AND lcfv.value != '')`,
          params: [fieldId],
        };
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for custom number field type`);
    }
  }

  if (fieldType === 'date') {
    switch (condition) {
      case 'before':
        return {
          sql: `${baseExists} AND lcfv.value < ?)`,
          params: [fieldId, value || ''],
        };
      case 'after':
        return {
          sql: `${baseExists} AND lcfv.value > ?)`,
          params: [fieldId, value || ''],
        };
      case 'is':
        return {
          sql: `${baseExists} AND DATE(lcfv.value) = DATE(?))`,
          params: [fieldId, value || ''],
        };
      case 'is empty':
        return {
          sql: `(${baseNotExists} OR lcfv.value IS NULL OR lcfv.value = '')`,
          params: [fieldId],
        };
      case 'is not empty':
        return {
          sql: `${baseExists} AND lcfv.value IS NOT NULL AND lcfv.value != '')`,
          params: [fieldId],
        };
      default:
        throw new BadRequestError(`Condition "${condition}" is not supported for custom date field type`);
    }
  }

  if (fieldType === 'boolean') {
    switch (condition) {
      case 'is':
        if (value === 'true') {
          return {
            sql: `${baseExists} AND lcfv.value = 'true')`,
            params: [fieldId],
          };
        }
        if (value === 'false') {
          return {
            sql: `(${baseNotExists} OR lcfv.value = 'false')`,
            params: [fieldId],
          };
        }
        throw new BadRequestError('Boolean "is" condition requires value "true" or "false"');
      case 'is empty':
        return {
          sql: `(${baseNotExists} OR lcfv.value IS NULL OR lcfv.value = '')`,
          params: [fieldId],
        };
      case 'is not empty':
        return {
          sql: `${baseExists} AND lcfv.value IS NOT NULL AND lcfv.value != '')`,
          params: [fieldId],
        };
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
    sql: `(leads.name LIKE ? OR leads.phone LIKE ? OR leads.email LIKE ? OR leads.e164 LIKE ?)`,
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
