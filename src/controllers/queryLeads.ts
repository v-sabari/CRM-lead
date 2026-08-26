import { Request, Response, NextFunction } from 'express';
import { queryAll, queryOne } from '../db/client';
import { queryLeadsBodySchema, queryLeadsParamsSchema } from '../types/lead-filter';
import { buildLeadFilterClause } from '../services/filters';
import { BadRequestError } from '../middleware/error-handler';

const SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'leads.created_at',
  followUpDate: 'leads.follow_up_date',
};

export function queryLeads(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.currentUser!;
    const paramsResult = queryLeadsParamsSchema.safeParse(req.query);
    if (!paramsResult.success) {
      const message = paramsResult.error.errors.map((e) => e.message).join('; ');
      throw new BadRequestError(message);
    }

    const { page, limit, sortBy, sortDirection } = paramsResult.data;

    const bodyResult = queryLeadsBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      const message = bodyResult.error.errors.map((e) => e.message).join('; ');
      throw new BadRequestError(message);
    }

    const { q, logic, filters } = bodyResult.data;

    const { sql: whereSql, params: whereParams } = buildLeadFilterClause(filters, logic, q, user);

    const sortColumn = SORT_COLUMN_MAP[sortBy];
    if (!sortColumn) {
      throw new BadRequestError(`sortBy must be "followUpDate" or "createdAt"`);
    }

    const countQuery = `SELECT COUNT(*) as total FROM leads WHERE ${whereSql}`;
    const countResult = queryOne(countQuery, whereParams) as { total: number } | null;
    const totalRecords = countResult ? Number(countResult.total) : 0;
    const totalPages = Math.ceil(totalRecords / limit);

    const offset = (page - 1) * limit;

    let orderClause: string;
    if (sortBy === 'followUpDate' && sortDirection === 'asc') {
      orderClause = `ORDER BY ${sortColumn} IS NULL, ${sortColumn} ASC`;
    } else {
      orderClause = `ORDER BY ${sortColumn} ${sortDirection.toUpperCase()} NULLS LAST`;
    }

    const dataQuery = `
      SELECT leads.id FROM leads
      WHERE ${whereSql}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;
    const leadRows = queryAll(dataQuery, [...whereParams, limit, offset]) as { id: string }[];

    if (leadRows.length === 0) {
      res.json({
        status: 'success',
        message: 'Leads fetched successfully',
        data: [],
        meta: {
          page,
          limit,
          totalRecords,
          totalPages,
        },
      });
      return;
    }

    const leadIds = leadRows.map((r) => r.id);
    const placeholders = leadIds.map(() => '?').join(', ');

    const fullLeads = queryAll(
      `SELECT * FROM leads WHERE id IN (${placeholders})`,
      leadIds
    ) as any[];

    const leadMap = new Map(fullLeads.map((l) => [l.id, l]));
    const orderedLeads = leadIds.map((id) => leadMap.get(id)!);

    const customFieldValues = queryAll(
      `SELECT lcfv.*, cf.label
       FROM lead_custom_field_values lcfv
       JOIN custom_fields cf ON cf.id = lcfv.field_id
       WHERE lcfv.lead_id IN (${placeholders})
         AND cf.status = 1`,
      leadIds
    ) as any[];

    const cfvMap = new Map<string, any[]>();
    for (const cfv of customFieldValues) {
      if (!cfvMap.has(cfv.lead_id)) {
        cfvMap.set(cfv.lead_id, []);
      }
      cfvMap.get(cfv.lead_id)!.push(cfv);
    }

    const data = orderedLeads.map((lead) => ({
      id: lead.id,
      tenantId: lead.tenant_id,
      userId: lead.user_id,
      name: lead.name,
      phone: lead.phone,
      countryCode: lead.country_code,
      e164: lead.e164,
      email: lead.email,
      assignedTo: lead.assigned_to,
      followUpDate: lead.follow_up_date,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      customFields: (cfvMap.get(lead.id) || []).map((cfv: any) => ({
        fieldId: cfv.field_id,
        label: cfv.label,
        value: cfv.value,
      })),
    }));

    res.json({
      status: 'success',
      message: 'Leads fetched successfully',
      data,
      meta: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}
