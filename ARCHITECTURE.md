# SeminarFlow Architecture & Execution Guide

## Overview

SeminarFlow is an operations dashboard for Power Mailers Plus, managing workshop orders, advisors, and direct mail campaigns. **This document is the single source of truth for development.**

---

## 🚨 CRITICAL RULES (READ FIRST)

### Status Source of Truth
```
STATUS comes from Direct_Mail_Jobs.status, NOT Orders table
- "Mailed" → status: "completed"
- Anything else → status: "active"
```

### Region Field
```
REGION = office_location field
- Values: "Dallas", "St. Louis", "Rolling Meadows", "Oak Brook", "Connecticut", "Maryland", etc.
- Derived from venue address state + advisor location
- NOT the same as venue state
```

### Default View
```
Orders list shows ONLY:
- status !== 'completed'
- isPast === false
- Sorted by weeksOut ascending (nearest first)
```

### Group Merging
```
FTA offices merged under one "FTA" group:
- FTA Chicago, FTA STL, FTA TX, FTA Dallas, FTA Nashville → all "FTA"
- office_location distinguishes regions within FTA
```

---

## Data Source

**Airtable Base:** `appeEmOJVXDJ0WPF4`

### Table Hierarchy
```
GROUPS ──────────────────────────────────────────────────────────────────┐
│ (FTA, SAM-RIA, Arrive Financial)                                       │
│                                                                        │
├── REGIONS                                                              │
│   (Dallas, St. Louis, Rolling Meadows, Connecticut, Maryland)          │
│                                                                        │
├── ADVISORS                                                             │
│   (FTA TX, William Warner, Danny Bullock)                              │
│   │                                                                    │
│   └── ORDERS ──────────────────────────────────────────────────────────┤
│       (order 927, order 884)                                           │
│       │                                                                │
│       ├── DIRECT_MAIL_JOBS  ← SOURCE OF TRUTH FOR STATUS               │
│       │   (status, quantity, mail_date)                                │
│       │                                                                │
│       ├── INVOICES                                                     │
│       │                                                                │
│       └── PROOFS                                                       │
│                                                                        │
└── CHARITIES                                                            │
    (Crisis Nursery, Township of Schaumburg, North Texas Food Bank)     ─┘
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16 + React + Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Airtable (via `airtable` npm package) |
| Deployment | Vercel (production), localhost:3000 (dev) |

---

## File Structure

```
seminar-flow/
├── src/
│   ├── app/
│   │   ├── (admin)/admin/           # Admin dashboard routes
│   │   │   ├── page.tsx             # /admin - Dashboard
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx         # /admin/orders - List
│   │   │   │   └── [orderId]/
│   │   │   │       └── page.tsx     # /admin/orders/:id - Detail
│   │   │   ├── advisors/
│   │   │   │   ├── page.tsx         # /admin/advisors - List
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx     # /admin/advisors/:id - Detail
│   │   │   └── calendar/
│   │   │       └── page.tsx         # /admin/calendar
│   │   │
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── orders/route.ts      # GET /api/admin/orders
│   │       │   ├── advisors/route.ts    # GET /api/admin/advisors
│   │       │   └── stats/route.ts       # GET /api/admin/stats
│   │       └── orders/
│   │           └── [orderId]/route.ts   # GET /api/orders/:id
│   │
│   └── lib/
│       ├── airtable.ts              # ALL Airtable integration
│       └── utils.ts                 # Utility functions
│
├── scripts/                         # Data linking/fixing scripts
│   ├── link-groups.js
│   ├── link-regions.js
│   └── fix-data.js
│
├── .env.local                       # AIRTABLE_PAT, AIRTABLE_BASE_ID
├── ARCHITECTURE.md                  # THIS FILE
└── package.json
```

---

## API Endpoints

### GET /api/admin/orders

Returns lightweight order list for UI rendering.

**Query Params:**
- `includePast=true` - Include past events
- `includeCompleted=true` - Include mailed orders

**Response (28KB, not 184KB):**
```json
{
  "orders": [
    {
      "id": "rec...",
      "order_number": 927,
      "advisor": "FTA TX",
      "group_name": "FTA",
      "office_location": "Dallas",      // ← REGION
      "first_event_date": "2026-06-02",
      "second_event_date": "2026-06-04",
      "venue_name": "Dallas College",
      "venue_address": "...",
      "start_time": "6:00 PM",
      "end_time": "7:30 PM",
      "charity": "",
      "landing_page_url": "https://...",
      "class_type": "R90",
      "mailing_quantity": 8000,
      "status": "active",               // ← FROM DM JOBS
      "daysUntilEvent": 15,
      "isPast": false,
      "isUrgent": false,
      "weeksOut": 3                     // ← CALCULATED
    }
  ],
  "count": 56
}
```

### GET /api/admin/orders/:id

Returns full order detail with all linked data.

### GET /api/admin/stats

```json
{
  "totalOrders": 273,
  "activeOrders": 56,
  "pastOrders": 217,
  "byStatus": { "active": 219, "completed": 54 },
  "byGroup": [
    { "name": "FTA", "active": 25, "past": 102, "regions": 8, "charities": 3 }
  ]
}
```

### GET /api/admin/advisors

Returns advisor list with order counts.

---

## UI Components

### Orders List (`/admin/orders`)

| Column | Field | Notes |
|--------|-------|-------|
| Order # | `order_number` | Numeric ID |
| Advisor | `advisor` | Name or office (FTA TX) |
| Region | `office_location` | **NOT venue state** |
| Event Date | `first_event_date` | Formatted |
| Venue | `venue_name` | Truncated |
| Weeks | `weeksOut` | Color-coded urgency |

**Status Filters:** All, Active, Completed

**Sort Options:** Date ↑, Date ↓, Order # ↓

**Checkbox:** Include Past Events

### Order Detail (`/admin/orders/:id`)

Shows full order with:
- Advisor info (contact, phone)
- Group info (registration URL)
- Region
- Charity
- Direct Mail Jobs (with status)
- Invoices
- Proofs

---

## Status Logic

```typescript
// In airtable.ts
const dmStatus = directMailJobs[0]?.status || '';
const status = dmStatus === 'Mailed' ? 'completed' : 'active';
```

**UI Labels:**
- `active` → "Active" (blue badge)
- `completed` → "Mailed" (green badge)

---

## Running Locally

```bash
cd seminar-flow
npm install
npm run dev
# → http://localhost:3000
```

**Environment variables (.env.local):**
```
AIRTABLE_PAT=pat...
AIRTABLE_BASE_ID=appeEmOJVXDJ0WPF4
```

---

## Data Scripts

Run from `seminar-flow/` directory:

```bash
# Link orders to advisors, groups
node scripts/link-airtable.js

# Add office_location to orders based on venue state
node scripts/add-office-location.js

# Link regions and charities to groups
node scripts/link-groups.js

# Verify data connections
node scripts/verify.js
```

---

## Current Stats

| Entity | Count |
|--------|-------|
| Orders | 273 (56 active, 217 past) |
| Advisors | 54 |
| Groups | 31 |
| Regions | 14 |
| FTA Orders | 127 (25 active) |
| SAM-RIA Orders | 37 (10 active) |

---

## Known Issues

1. **16 orphaned orders** - No group in source data, shown as "Unknown"
2. **Some orders missing office_location** - Need manual region assignment

---

## Development Checklist

Before making changes:
- [ ] Read this document
- [ ] Check which field is source of truth (status from DM Jobs, region from office_location)
- [ ] Keep API responses lightweight (no nested objects in list views)
- [ ] Test locally before committing

After changes:
- [ ] Run `npm run build` to check for errors
- [ ] Test at http://localhost:3000
- [ ] Commit with descriptive message
