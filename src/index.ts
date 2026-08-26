import app from './app';
import { initDB, queryOne } from './db/client';
import { v4 as uuidv4 } from 'uuid';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const AGENT_A1 = '33333333-3333-3333-3333-333333333333';
const AGENT_A2 = '44444444-4444-4444-4444-444444444444';
const AGENT_B1 = '55555555-5555-5555-5555-555555555555';
const ADMIN_USER = '66666666-6666-6666-6666-666666666666';
const CITY_FIELD = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SCORE_FIELD = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

import { run as dbRun } from './db/client';

function seedIfEmpty() {
  const row = queryOne('SELECT COUNT(*) as cnt FROM leads') as { cnt: number } | null;
  if (row && Number(row.cnt) > 0) return;

  console.log('Database empty, seeding...');

  const now = new Date().toISOString();

  const tenantALeads = [
    { id: uuidv4(), name: 'Ram Kumar', phone: '9000000001', assignedTo: AGENT_A1, followUpDate: '2026-08-10', email: 'ram@example.com', city: 'Chennai', score: '85' },
    { id: uuidv4(), name: 'Ramesh', phone: '9000000002', assignedTo: AGENT_A1, followUpDate: '2026-07-01', email: 'ramesh@example.com', city: 'Madurai', score: '72' },
    { id: uuidv4(), name: 'Priya', phone: '9000000003', assignedTo: AGENT_A2, followUpDate: null, email: null, city: 'Chennai', score: '90' },
    { id: uuidv4(), name: 'Anand', phone: '9000000004', assignedTo: null, followUpDate: '2026-08-15', email: 'anand@example.com', city: 'Coimbatore', score: '60' },
    { id: uuidv4(), name: 'Sita', phone: '9000000005', assignedTo: AGENT_A2, followUpDate: '2026-08-01', email: 'sita@example.com', city: 'Chennai', score: '78' },
  ];

  for (const lead of tenantALeads) {
    dbRun(
      `INSERT INTO leads (id, tenant_id, user_id, name, phone, country_code, e164, email, assigned_to, follow_up_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lead.id, TENANT_A, ADMIN_USER, lead.name, lead.phone, '+91', `+91${lead.phone}`, lead.email, lead.assignedTo, lead.followUpDate, now, now]
    );
  }

  const tenantBLeads = [
    { id: uuidv4(), name: 'Vikram', phone: '9000000006', assignedTo: AGENT_B1, followUpDate: '2026-09-01', email: 'vikram@example.com', city: 'Mumbai', score: '88' },
    { id: uuidv4(), name: 'Deepa', phone: '9000000007', assignedTo: null, followUpDate: null, email: 'deepa@example.com', city: 'Delhi', score: '65' },
  ];

  for (const lead of tenantBLeads) {
    dbRun(
      `INSERT INTO leads (id, tenant_id, user_id, name, phone, country_code, e164, email, assigned_to, follow_up_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lead.id, TENANT_B, ADMIN_USER, lead.name, lead.phone, '+91', `+91${lead.phone}`, lead.email, lead.assignedTo, lead.followUpDate, now, now]
    );
  }

  dbRun(`INSERT INTO custom_fields (id, tenant_id, label, type, status) VALUES (?, ?, ?, ?, ?)`, [CITY_FIELD, TENANT_A, 'City', 'string', 1]);
  dbRun(`INSERT INTO custom_fields (id, tenant_id, label, type, status) VALUES (?, ?, ?, ?, ?)`, [SCORE_FIELD, TENANT_A, 'Score', 'number', 1]);
  dbRun(`INSERT INTO custom_fields (id, tenant_id, label, type, status) VALUES (?, ?, ?, ?, ?)`, [uuidv4(), TENANT_B, 'City', 'string', 1]);

  for (const lead of tenantALeads) {
    dbRun(`INSERT INTO lead_custom_field_values (id, lead_id, field_id, value) VALUES (?, ?, ?, ?)`, [uuidv4(), lead.id, CITY_FIELD, lead.city]);
    dbRun(`INSERT INTO lead_custom_field_values (id, lead_id, field_id, value) VALUES (?, ?, ?, ?)`, [uuidv4(), lead.id, SCORE_FIELD, lead.score]);
  }

  for (const lead of tenantBLeads) {
    dbRun(`INSERT INTO lead_custom_field_values (id, lead_id, field_id, value) VALUES (?, ?, ?, ?)`, [uuidv4(), lead.id, CITY_FIELD, lead.city]);
    dbRun(`INSERT INTO lead_custom_field_values (id, lead_id, field_id, value) VALUES (?, ?, ?, ?)`, [uuidv4(), lead.id, SCORE_FIELD, lead.score]);
  }

  console.log('Seed completed!');
}

async function main() {
  await initDB();
  seedIfEmpty();

  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch(console.error);
