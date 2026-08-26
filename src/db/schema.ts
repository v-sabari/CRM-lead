import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  countryCode: text('country_code').notNull(),
  e164: text('e164').notNull(),
  email: text('email'),
  assignedTo: text('assigned_to'),
  followUpDate: text('follow_up_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const customFields = sqliteTable('custom_fields', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  label: text('label').notNull(),
  type: text('type').notNull(),
  status: integer('status', { mode: 'boolean' }).notNull().default(true),
});

export const leadCustomFieldValues = sqliteTable('lead_custom_field_values', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull(),
  fieldId: text('field_id').notNull(),
  value: text('value'),
});
