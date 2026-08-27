# CRM-Lead: Lead Filter Query API

A standalone Express + TypeScript service implementing a flexible lead search/filter endpoint for a multi-tenant CRM.

## Tech Stack

| Piece       | Choice                    |
| ----------- | ------------------------- |
| Runtime     | Node 20+                  |
| Framework   | Express                   |
| Language    | TypeScript                |
| DB          | SQLite (sql.js)           |
| Validation  | Zod                       |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Seed the database

```bash
npm run seed
```

This populates two tenants with sample leads and custom fields.

### 3. Run the server

```bash
npm run dev
```

Server starts at `http://localhost:3000`.

## Seed Data Reference

| Entity            | ID                                      |
| ----------------- | --------------------------------------- |
| Tenant A          | `11111111-1111-1111-1111-111111111111`  |
| Tenant B          | `22222222-2222-2222-2222-222222222222`  |
| Admin User        | `66666666-6666-6666-6666-666666666666`  |
| Owner User        | `77777777-7777-7777-7777-777777777777`  |
| Agent A1          | `33333333-3333-3333-3333-333333333333`  |
| Agent A2          | `44444444-4444-4444-4444-444444444444`  |
| Agent B1          | `55555555-5555-5555-5555-555555555555`  |
| City Field (A)    | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`  |
| Score Field (A)   | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`  |

### Tenant A Leads

| Lead | Name      | Phone      | Assigned To | Follow-up  | Email           | City       | Score |
| ---- | --------- | ---------- | ----------- | ---------- | --------------- | ---------- | ----- |
| L1   | Ram Kumar | 9000000001 | Agent A1    | 2026-08-10 | ram@example.com | Chennai    | 85    |
| L2   | Ramesh    | 9000000002 | Agent A1    | 2026-07-01 | ramesh@example.com | Madurai | 72    |
| L3   | Priya     | 9000000003 | Agent A2    | null       | null            | Chennai    | 90    |
| L4   | Anand     | 9000000004 | null        | 2026-08-15 | anand@example.com | Coimbatore | 60    |
| L5   | Sita      | 9000000005 | Agent A2    | 2026-08-01 | sita@example.com | Chennai   | 78    |

### Tenant B Leads

| Lead | Name    | Phone      | Assigned To | Follow-up  | City   |
| ---- | ------- | ---------- | ----------- | ---------- | ------ |
| L6   | Vikram  | 9000000006 | Agent B1    | 2026-09-01 | Mumbai |
| L7   | Deepa   | 9000000007 | null        | null       | Delhi  |

## API Contract

### `POST /api/v1/leads/query?page=1&limit=20&sortBy=createdAt&sortDirection=desc`

**Query Params:**

| Param           | Default     | Rules                         |
| --------------- | ----------- | ----------------------------- |
| `page`          | `1`         | integer >= 1                  |
| `limit`         | `20`        | integer 1-100                 |
| `sortBy`        | `createdAt` | `createdAt` \| `followUpDate` |
| `sortDirection` | `desc`      | `asc` \| `desc`               |

**Headers (auth simulation):**

```http
x-tenant-id: <uuid>
x-user-id: <uuid>
x-user-role: owner | admin | manager | agent
```

**Body:**

```json
{
  "q": "ram",
  "logic": "AND",
  "filters": [
    {
      "fieldId": "assignedTo",
      "fieldType": "string",
      "condition": "is",
      "value": "33333333-3333-3333-3333-333333333333",
      "inputType": "multiselect"
    }
  ]
}
```

## Example Curls

### 1. Admin: City contains Chennai AND assigned to Agent A2

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=1&limit=20' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-user-id: 66666666-6666-6666-6666-666666666666' \
  -H 'x-user-role: admin' \
  -d '{
    "logic": "AND",
    "filters": [
      {
        "fieldId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "fieldType": "string",
        "condition": "contain",
        "value": "Chennai"
      },
      {
        "fieldId": "assignedTo",
        "fieldType": "string",
        "condition": "is",
        "value": "44444444-4444-4444-4444-444444444444",
        "inputType": "multiselect"
      }
    ]
  }'
```

Expected: L3 (Priya), L5 (Sita)

### 2. Agent A1: search "Ram" (should only see own leads)

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=1&limit=20&sortBy=followUpDate&sortDirection=asc' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-user-id: 33333333-3333-3333-3333-333333333333' \
  -H 'x-user-role: agent' \
  -d '{ "q": "Ram" }'
```

Expected: L1 (Ram Kumar), L2 (Ramesh)

### 3. Admin: name contain Ram OR name contain Sita

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=1&limit=20' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-user-id: 66666666-6666-6666-6666-666666666666' \
  -H 'x-user-role: admin' \
  -d '{
    "logic": "OR",
    "filters": [
      {
        "fieldId": "name",
        "fieldType": "string",
        "condition": "contain",
        "value": "Ram"
      },
      {
        "fieldId": "name",
        "fieldType": "string",
        "condition": "contain",
        "value": "Sita"
      }
    ]
  }'
```

Expected: L1 (Ram Kumar), L2 (Ramesh), L5 (Sita)

### 4. Admin: free-text search by phone

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=1&limit=20' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-user-id: 66666666-6666-6666-6666-666666666666' \
  -H 'x-user-role: admin' \
  -d '{ "q": "9000000003" }'
```

Expected: L3 (Priya)

### 5. Missing auth headers

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=1&limit=20' \
  -H 'content-type: application/json' \
  -d '{ "q": "Ram" }'
```

Expected: 401 error

## CRUD Endpoints

In addition to the query endpoint, the leads resource supports full CRUD. All endpoints require the same auth headers (`x-tenant-id`, `x-user-id`, `x-user-role`).

| Method | Path                 | Description                        | Permission                          |
| ------ | -------------------- | ---------------------------------- | ----------------------------------- |
| `GET`  | `/api/v1/leads/:id`  | Fetch a single lead                | Any authenticated role (tenant-scoped) |
| `POST` | `/api/v1/leads`       | Create a new lead                  | Any role (agents must self-assign)  |
| `PUT`  | `/api/v1/leads/:id`  | Update a lead                      | owner/admin/manager; agent if assigned to them |
| `DELETE` | `/api/v1/leads/:id` | Delete a lead (and its custom field values) | owner/admin/manager only |

**Permission rules:**
- **owner / admin / manager** — full read/write/delete on all leads in their tenant
- **agent** — can read any lead in the tenant, create leads assigned to self (or unassigned), update leads assigned to them, but **cannot delete** and cannot update leads assigned to others

**Create body:**

```json
{
  "name": "New Lead",
  "phone": "9000000001",
  "countryCode": "+91",
  "email": "new@example.com",
  "assignedTo": "33333333-3333-3333-3333-333333333333",
  "followUpDate": "2026-09-15"
}
```

`email`, `assignedTo`, and `followUpDate` are optional. `countryCode` defaults to `+91`. `e164` is computed as `countryCode + phone`.

**Update body:** any subset of the fields above. At least one field is required.

**Example: Create a lead**

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-user-id: 66666666-6666-6666-6666-666666666666' \
  -H 'x-user-role: admin' \
  -d '{ "name": "New Lead", "phone": "9000000001", "email": "new@example.com" }'
```

## Design Decisions

### Empty Value Semantics
- `is empty` = column IS NULL OR column = ''
- `is not empty` = column IS NOT NULL AND column != ''
- This covers both NULL and empty string cases, which is common in CRM data

### Custom Field Filters: EXISTS/NOT EXISTS
Custom fields use EAV pattern with `EXISTS`/`NOT EXISTS` subqueries. This avoids row explosion that would happen with LEFT JOINs when a lead has multiple custom field values. For `is not` and `does not contain`, a single `NOT EXISTS` subquery with the matching condition is used (e.g., "no row with this value" = lead either has different value or no value at all).

### Id-then-Hydrate Pattern
1. First query: SELECT matching lead IDs with WHERE/ORDER BY/LIMIT
2. Second query: SELECT full lead rows by IN (ids)
3. Third query: SELECT custom field values for those leads in batch

This prevents N+1 queries and avoids row multiplication from JOINs.

### Case-Insensitive Matching (SQLite)
SQLite's `LIKE` is case-sensitive by default. All string comparisons use `LOWER()` on both sides for proper case-insensitive behavior, matching PostgreSQL's `ILIKE` semantics.

### Agent Visibility
Agents only see leads where `assigned_to = their userId`. NULL `assigned_to` values don't match any specific agent, so unassigned leads are invisible to agents.

### Multiselect Semantics
- `assignedTo is "id1,id2"` → matches leads assigned to ANY of the IDs
- `assignedTo is not "id1,id2"` → matches leads NOT assigned to ANY of the IDs (NULL counts as "not matching")

### Nulls Last for followUpDate ASC
When sorting by followUpDate ascending, leads without a follow-up date appear last. This is the most practical behavior for CRM agents.

### Null Safety for "is not" / "does not contain"
Per spec, null values should be considered "not equal" to any specific value. So `email is not "ram@example.com"` includes Priya (null email). Similarly, `does not contain` uses null-safe comparison.

## Suggested Indexes for Production (Postgres)

```sql
CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX idx_leads_tenant_assigned ON leads(tenant_id, assigned_to);
CREATE INDEX idx_leads_tenant_created ON leads(tenant_id, created_at);
CREATE INDEX idx_cf_tenant ON custom_fields(tenant_id, status);
CREATE INDEX idx_cfv_lead_field ON lead_custom_field_values(lead_id, field_id);
CREATE INDEX idx_cfv_field_value ON lead_custom_field_values(field_id, value);
```

## What I Would Improve With Another Day

1. **Postgres migration**: Move from SQLite to Postgres for production-grade concurrent access
2. **OpenAPI/Swagger**: Add auto-generated API docs
3. **Rate limiting**: Redis-based rate limiting per tenant
4. **JWT authentication**: Real auth with token validation
5. **Custom field metadata caching**: Cache custom field definitions to avoid repeated lookups
6. **Cursor-based pagination**: More efficient than offset for large datasets
7. **Boolean `is false` on custom fields**: Currently treats "false" as "NOT true"; could be more precise
