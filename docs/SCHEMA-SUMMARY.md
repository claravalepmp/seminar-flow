# Airtable Schema Restructure — Complete

## What Was Done (May 14, 2026)

### Tables Created
| Table | Records | Purpose |
|-------|---------|---------|
| **Venues** | 168 | Seminar locations extracted from Orders |
| **Events_v2** | 402 | Individual seminar dates, normalized from Orders |

### Key Improvements

**Before:**
- 4 date columns per Order (first_event_date, second_event_date, etc.)
- Venue info stored as text in Orders
- Clients and Advisors tables duplicated data
- No aggregation/rollup fields

**After:**
- One row per event in Events_v2 table
- Venues normalized with reusable records
- Events linked to Orders and Venues
- Ready for rollup fields

## Current Schema (13 Tables)

```
GROUPS (25) ──────────────────────────────────┐
  │                                            │
  ├─→ REGIONS (14+) ←── CHARITIES (6)         │
  │       │                                    │
  │       └─→ VENUES (168) ←─┐                 │
  │                          │                 │
CLIENTS (43) ─→ ORDERS (205) ─→ EVENTS_v2 (402)
  "Advisors"       │
                   ├─→ DIRECT_MAIL_JOBS
                   ├─→ DIGITAL_JOBS  
                   ├─→ CREATIVES
                   └─→ INVOICES

REGISTRATIONS ←── (link to Events_v2 pending)
```

## Cleanup Tasks Remaining

### 1. Table Renaming (Airtable UI)
- [ ] Rename "Clients" → "Advisors" (it has the actual advisor contacts)
- [ ] Delete old "Advisors" table (duplicates Groups)
- [ ] Delete old "Events" table (replaced by Events_v2)

### 2. Add Rollup Fields (Airtable UI)
| Table | Field | Formula |
|-------|-------|---------|
| Groups | Total Advisors | COUNT(Clients) |
| Groups | Total Orders | Rollup through Clients |
| Regions | Total Orders | COUNT(Orders) |
| Regions | Total Venues | COUNT(Venues) |
| Clients | Total Orders | COUNT(Orders) |
| Clients | Total Mailings | SUM(Orders→mailing_quantity) |
| Orders | Event Count | COUNT(Events_v2) |
| Orders | First Event | MIN(Events_v2→Date) |

### 3. Link Registrations to Events_v2
Currently Registrations links to old Events table. Update to Events_v2.

### 4. Set Order Statuses
- 48 orders with future dates → "Active" or "Scheduled"
- 157 orders with past dates → "Sent" or "Completed"

## Data Quality Notes

**Groups table has issues:**
- 5 true multi-advisor firms (FTA, SAM RIA, AdvisorMax, Arrive, Scout)
- 20 solo advisors incorrectly listed as "Groups"
- Consider: move solo advisors to Clients table

**Duplicate records in old Advisors table:**
- 28 of 39 records duplicate Groups
- Safe to delete after verification

## Access

- **Airtable Base:** https://airtable.com/appeEmOJVXDJ0WPF4
- **Schema Doc:** seminar-flow/docs/airtable-schema-v2.md
- **Scripts:** seminar-flow/scripts/

## Scripts Available

```bash
# Analyze current state
node scripts/analyze-and-clean.js

# Run cleanup (already executed)
node scripts/execute-cleanup.js --execute

# Migrate schema (venues, etc.)
node scripts/migrate-schema-v2.js
```
