import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run, saveDB } from '../db/client';
import { createLeadBodySchema, updateLeadBodySchema } from '../types/lead';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../middleware/error-handler';

function mapLead(lead: any) {
  return {
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
  };
}

function findLeadInTenant(tenantId: string, leadId: string): any | null {
  return queryOne('SELECT * FROM leads WHERE id = ? AND tenant_id = ?', [leadId, tenantId]);
}

function hasWritePermission(user: { role: string; userId: string }, lead: any): boolean {
  if (user.role === 'owner' || user.role === 'admin' || user.role === 'manager') return true;
  if (user.role === 'agent') return lead.assigned_to === user.userId;
  return false;
}

export function getLead(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.currentUser!;
    const leadId = req.params.id;
    const lead = findLeadInTenant(user.tenantId, leadId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }
    res.json({
      status: 'success',
      message: 'Lead fetched successfully',
      data: mapLead(lead),
    });
  } catch (error) {
    next(error);
  }
}

export function createLead(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.currentUser!;
    const parsed = createLeadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join('; ');
      throw new BadRequestError(message);
    }

    const { name, phone, countryCode, email, assignedTo, followUpDate } = parsed.data;
    const now = new Date().toISOString();
    const id = uuidv4();
    const e164 = `${countryCode}${phone}`;

    const emailVal = email ?? null;
    const assignedToVal = assignedTo ?? null;
    const followUpDateVal = followUpDate ?? null;

    // Agents may only create leads assigned to themselves (or unassigned)
    if (user.role === 'agent' && assignedTo && assignedTo !== user.userId) {
      throw new UnauthorizedError('Agents may only create leads assigned to themselves');
    }

    run(
      `INSERT INTO leads (id, tenant_id, user_id, name, phone, country_code, e164, email, assigned_to, follow_up_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.tenantId, user.userId, name, phone, countryCode, e164, emailVal, assignedToVal, followUpDateVal, now, now]
    );
    saveDB();

    const lead = queryOne('SELECT * FROM leads WHERE id = ?', [id]);
    res.status(201).json({
      status: 'success',
      message: 'Lead created successfully',
      data: mapLead(lead),
    });
  } catch (error) {
    next(error);
  }
}

export function updateLead(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.currentUser!;
    const leadId = req.params.id;
    const lead = findLeadInTenant(user.tenantId, leadId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }
    if (!hasWritePermission(user, lead)) {
      throw new UnauthorizedError('You do not have permission to update this lead');
    }

    const parsed = updateLeadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join('; ');
      throw new BadRequestError(message);
    }

    const fields = parsed.data;
    const countryCode = fields.countryCode ?? lead.country_code;
    const phone = fields.phone ?? lead.phone;
    const e164 = `${countryCode}${phone}`;
    const now = new Date().toISOString();

    run(
      `UPDATE leads
       SET name = ?, phone = ?, country_code = ?, e164 = ?, email = ?, assigned_to = ?, follow_up_date = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        fields.name ?? lead.name,
        phone,
        countryCode,
        e164,
        fields.email === undefined ? lead.email : fields.email,
        fields.assignedTo === undefined ? lead.assigned_to : fields.assignedTo,
        fields.followUpDate === undefined ? lead.follow_up_date : fields.followUpDate,
        now,
        leadId,
        user.tenantId,
      ]
    );
    saveDB();

    const updated = queryOne('SELECT * FROM leads WHERE id = ?', [leadId]);
    res.json({
      status: 'success',
      message: 'Lead updated successfully',
      data: mapLead(updated),
    });
  } catch (error) {
    next(error);
  }
}

export function deleteLead(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = req.currentUser!;
    const leadId = req.params.id;
    const lead = findLeadInTenant(user.tenantId, leadId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }
    if (user.role === 'agent') {
      throw new UnauthorizedError('Agents are not allowed to delete leads');
    }

    // Delete custom field values first (preserve referential integrity)
    run('DELETE FROM lead_custom_field_values WHERE lead_id = ?', [leadId]);
    run('DELETE FROM leads WHERE id = ? AND tenant_id = ?', [leadId, user.tenantId]);
    saveDB();

    res.json({
      status: 'success',
      message: 'Lead deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}
