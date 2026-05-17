# SeminarFlow Architecture & Execution Guide

## Overview

SeminarFlow is an operations dashboard for Power Mailers Plus, managing workshop orders, advisors, and direct mail campaigns.

## Data Source

**Airtable Base:** `appeEmOJVXDJ0WPF4`

### Tables & Relationships

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     GROUPS      │────▶│    ADVISORS     │────▶│     ORDERS      │
│  (FTA, SAM-RIA) │     │ (FTA Chicago,   │     │  (order 927)    │
│                 │     │  William Warner)│     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       ▼
        │                       │              ┌─────────────────┐
        │                       └─────────────▶│ DIRECT_MAIL_JOBS│ ◀── SOURCE OF TRUTH
        │                                      │  (status, qty)  │     FOR STATUS
        │                                      └─────────────────┘
        ▼                                              │
┌─────────────────┐                                    │
│    REGIONS      │◀───────────────────────────────────┘
│ (Dallas, STL,   │
│  Rolling Meadows│
└─────────────────┘
        │
        ▼
┌─────────────────┐
│   CHARITIES     │
│ (Crisis Nursery,│
│  North TX Food) │
└─────────────────┘
```

### Critical Rules

1. **STATUS comes from Direct_Mail_Jobs.status, NOT Orders.status**
   - "Mailed" → completed
   - Anything else → active

2. **REGION is `office_location` field** (Dallas, St. Louis, Rolling Meadows, Oak Brook, etc.)
   - Derived from advisor name + venue address

3. **Only show upcoming orders** (not past, not completed)
   - Default filter: weeksOut >= 0 AND status !== 'completed'

4. **FTA offices are merged under one FTA group**
   - FTA Chicago, FTA STL, FTA TX, FTA Dallas, FTA Nashville → all under "FTA"

## Tech Stack

- **Frontend:** Next.js 16 + React + Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Airtable (via `airtable` npm package)
- **Deployment:** Local dev at http://localhost:3000

## File Structure

```
seminar-flow/
├── src/
│   ├── app/
│   │   ├── (admin)/admin/
│   │   │   ├── orders/          # Orders list & detail
│   │   │   │   ├── page.tsx     # /admin/orders - list view
│   │   │   │   └── [orderId]/   # /admin/orders/:id - detail
│   │   │   ├── advisors/        # Advisors list & detail
│   │   │   ├── calendar/        # Calendar view
│   │   │   └── page.tsx         # /admin - dashboard
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── orders/route.ts    # GET /api/admin/orders
│   │       │   ├── advisors/route.ts  # GET /api/admin/advisors
│   │       │   └── stats/route.ts     # GET /api/admin/stats
│   │       └── orders/[orderId]/route.ts
│   └── lib/
│       └── airtable.ts          # ALL Airtable integration
├── .env.local                   # AIRTABLE_PAT, AIRTABLE_BASE_ID
└── scripts/                     # Data linking scripts
```

## Key APIs

### GET /api/admin/orders
Returns upcoming active orders, sorted by weeksOut.

**Response:**
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
      "weeksOut": 3,                     // ← Weeks until event
      "status": "active",                // ← From DM Jobs
      "venue_name": "...",
      "direct_mail_jobs": [...],
      "advisor_data": {...},
      "group_data": {...}
    }
  ],
  "count": 56
}
```

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

## UI Components

### Orders List Page (`/admin/orders`)

| Column | Source |
|--------|--------|
| Order # | `order_number` |
| Advisor | `advisor` |
| Region | `office_location` ← **NOT venue state** |
| Event Date | `first_event_date` |
| Venue | `venue_name` |
| Weeks | `weeksOut` (calculated) |

**Default filters:**
- Only show `status !== 'completed'`
- Only show `isPast === false`
- Sort by `weeksOut` ascending (nearest first)

### Order Detail Page (`/admin/orders/:id`)

Shows all linked data:
- Advisor info (contact, phone, return address)
- Group info (registration phone, URL)
- Region
- Charity
- Direct Mail Jobs (with status)
- Invoices
- Proofs

## Current Issues to Fix

1. **Orders page may show blank** - Check browser console for React errors
2. **16 orphaned orders** have no group - show as "Unknown"

## Running Locally

```bash
cd seminar-flow
npm run dev
# → http://localhost:3000
```

## Airtable Linking Scripts

```bash
# Fix data links
node scripts/link-airtable.js      # Link Orders → Advisors, Groups
node scripts/link-groups.js        # Link Regions/Charities → Groups
node scripts/add-office-location.js # Add office_location to orders
```
