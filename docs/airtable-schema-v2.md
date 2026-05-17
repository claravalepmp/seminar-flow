# Airtable Schema v2 — Optimized Design

## Overview

This redesign consolidates redundant tables, properly normalizes relationships, and adds rollup fields for aggregation.

## Key Changes from v1

| Issue | Solution |
|-------|----------|
| Advisors + Clients duplicate | **Merge into single Advisors table** |
| Venues stored as text in Orders | **New Venues table with reusable records** |
| 4 event date columns in Orders | **Proper Orders → Events relationship** |
| No aggregations | **Add Rollups for counts, sums, statuses** |
| Inconsistent naming | **Standardize to Title Case** |

---

## Schema Design

### 1. GROUPS (Firms/Companies)
The parent organization (FTA, SAM RIA, Bone Asset).

| Field | Type | Notes |
|-------|------|-------|
| Name | Text (Primary) | e.g., "FTA", "SAM RIA" |
| Website | URL | Company site |
| Registration Phone | Phone | Default for group |
| Registration URL | URL | Default landing page |
| Return Address | Long Text | Default mailer return |
| Responsibility | Select | Cameron, Chad, Both |
| Notes | Long Text | Special instructions |
| Regions | ← Link | Linked from Regions |
| Advisors | ← Link | Linked from Advisors |
| **Total Orders** | Rollup | COUNT(Advisors→Orders) |
| **Active Advisors** | Rollup | COUNT(Advisors WHERE Status=Active) |

---

### 2. REGIONS (Geographic Markets)
Markets where campaigns can target.

| Field | Type | Notes |
|-------|------|-------|
| Name | Text (Primary) | e.g., "Dallas", "Connecticut" |
| State | Text | 2-letter code |
| Default Mailing Qty | Number | e.g., 8000 for Dallas |
| Group | → Link | Single link to Groups |
| Default Charity | → Link | Single link to Charities |
| Venues | ← Link | Linked from Venues |
| Orders | ← Link | Linked from Orders |
| **Venue Count** | Rollup | COUNT(Venues) |
| **Orders YTD** | Rollup | COUNT(Orders WHERE Year=Current) |

---

### 3. ADVISORS (Merged: People + Office Accounts)
**Replaces both Advisors and Clients tables.**

| Field | Type | Notes |
|-------|------|-------|
| Name | Text (Primary) | e.g., "Will Warner - CT", "FTA Dallas" |
| Group | → Link | Single link to Groups |
| Primary Region | → Link | Main operating region |
| Contact Name | Text | Day-to-day contact person |
| Contact Email | Email | |
| Contact Phone | Phone | |
| Business Name | Text | Legal/DBA name |
| Business Address | Long Text | Full address |
| Registration Phone | Phone | Override group default |
| Registration URL | URL | Override group default |
| Return Address | Long Text | For mailers |
| Preferred Mailer Topics | Long Text | R90, R101, etc. |
| Default Mailing Qty | Number | |
| Default Digital Budget | Currency | |
| Direct Rate | Currency | $ per piece |
| Non-Profit Status | Checkbox | Affects postage |
| Notes | Long Text | Special instructions |
| Status | Select | Active, Inactive, Prospect |
| Created At | Created Time | |
| Orders | ← Link | Linked from Orders |
| **Total Orders** | Rollup | COUNT(Orders) |
| **Active Orders** | Rollup | COUNT(Orders WHERE Status≠Sent) |
| **Total Mailings** | Rollup | SUM(Orders→Mailing Qty) |

---

### 4. VENUES (Seminar Locations)
**NEW TABLE** — Reusable venue records.

| Field | Type | Notes |
|-------|------|-------|
| Name | Text (Primary) | e.g., "Dallas College Richland" |
| Full Name | Text | With room if standard |
| Address | Text | Street address |
| City | Text | |
| State | Text | |
| Zip | Text | |
| Default Room | Text | Common room used |
| Capacity | Number | Max attendees |
| Parking Notes | Long Text | |
| Region | → Link | Single link to Regions |
| Events | ← Link | Linked from Events |
| **Event Count** | Rollup | COUNT(Events) |
| **Last Used** | Rollup | MAX(Events→Date) |

---

### 5. CHARITIES (Non-Profits for Mailers)

| Field | Type | Notes |
|-------|------|-------|
| Name | Text (Primary) | e.g., "North Texas Food Bank" |
| Short Name | Text | For mailer space |
| EIN | Text | Tax ID if needed |
| Default Region | → Link | Primary region |
| Orders | ← Link | Orders using this charity |

---

### 6. ORDERS (Marketing Campaigns)
**Simplified** — Event details move to Events table.

| Field | Type | Notes |
|-------|------|-------|
| Order Number | Auto Number | Primary key |
| Advisor | → Link | Single link |
| Region | → Link | Or Lookup from Advisor |
| Class Type | Select | R90, R101, SS101, W101, WAT |
| Status | Select | Not Started, Pending Details, All Details Added, Manny Clickup, Issues, Sent |
| Mailing Quantity | Number | |
| Mailer Type | Text | Decided closer to send |
| Digital Budget | Currency | |
| Landing Page URL | URL | |
| Charity | → Link | Override region default |
| Notes | Long Text | |
| Proof File | Attachment | |
| Proof Status | Select | Pending, In Review, Approved, Rejected |
| Proof Feedback | Long Text | |
| Proof Approved At | Date | |
| Created At | Created Time | |
| Last Modified | Last Modified | |
| Events | ← Link | Linked from Events |
| Direct Mail Job | ← Link | |
| Digital Job | ← Link | |
| Invoice | ← Link | |
| **Event Count** | Rollup | COUNT(Events) |
| **First Event Date** | Rollup | MIN(Events→Date) |
| **Last Event Date** | Rollup | MAX(Events→Date) |
| **Total Registrations** | Rollup | SUM(Events→Registration Count) |

---

### 7. EVENTS (Individual Seminars)
**Proper normalization** — Each event date is one record.

| Field | Type | Notes |
|-------|------|-------|
| Event ID | Formula | Order# + "-" + Date |
| Order | → Link | Single link to Orders |
| Venue | → Link | Single link to Venues |
| Date | Date | |
| Start Time | Text | e.g., "6:00 PM" |
| End Time | Text | e.g., "8:00 PM" |
| Room | Text | Override venue default |
| Status | Select | Scheduled, Completed, Cancelled |
| Max Capacity | Number | Override venue default |
| Attended Count | Number | Actual attendance |
| Registrations | ← Link | |
| **Registration Count** | Rollup | COUNT(Registrations) |
| **Advisor** | Lookup | From Order→Advisor |
| **Region** | Lookup | From Order→Region |

---

### 8. REGISTRATIONS (Attendee Signups)
Keep mostly as-is.

| Field | Type | Notes |
|-------|------|-------|
| ID | Auto Number | |
| Event | → Link | |
| First Name | Text | |
| Last Name | Text | |
| Email | Email | |
| Phone | Phone | |
| Address | Text | |
| City | Text | |
| State | Text | |
| Zip | Text | |
| Source | Select | Direct Mail, Digital, Referral |
| Status | Select | Registered, Confirmed, Attended, No-Show, Cancelled |
| Guests | Number | +1s |
| Notes | Long Text | |
| Registered At | Created Time | |
| **Full Name** | Formula | First & " " & Last |
| **Event Date** | Lookup | From Event |
| **Venue** | Lookup | From Event→Venue |

---

### 9. DIRECT_MAIL_JOBS

| Field | Type | Notes |
|-------|------|-------|
| Job Name | Text (Primary) | |
| Order | → Link | |
| Creative | → Link | |
| Status | Select | Pending, List Ready, Proof Sent, Approved, At Printer, Mailed |
| Print Date | Date | |
| Mail Date | Date | |
| Quantity | Number | May differ from order qty |
| Targeting Criteria | Long Text | |
| List File | Attachment | |
| Proof File | Attachment | |
| Proof Status | Select | |
| Proof Feedback | Long Text | |

---

### 10. DIGITAL_JOBS

| Field | Type | Notes |
|-------|------|-------|
| Order | → Link | |
| Status | Select | Setup, QA, Live, Paused, Complete |
| QA Status | Select | |
| TP Status | Select | |
| Max Budget | Currency | |
| Spend | Currency | Actual spend |
| Landing Page URL | URL | |
| Notes | Long Text | |

---

### 11. CREATIVES (Mailer Templates)
Keep as-is.

---

### 12. INVOICES
Keep as-is, link to Orders and Advisors.

---

## Relationship Diagram

```
GROUPS
  ↓ has many
ADVISORS ←→ REGIONS (via Primary Region)
  ↓ places
ORDERS
  ↓ has many         ↘ uses
EVENTS ←→ VENUES     CHARITIES
  ↓ receives
REGISTRATIONS
```

## Migration Steps

1. **Create Venues table** from existing venue data in Orders
2. **Merge Clients into Advisors** — copy missing fields
3. **Create Events from Order date columns** — flatten 4 dates into 4 rows
4. **Add Rollup fields** for aggregations
5. **Delete duplicate Clients table**
6. **Update app to use new schema**

## Efficiency Gains

| Metric | Before | After |
|--------|--------|-------|
| Tables | 12 | 12 (but cleaner) |
| Duplicate data | High (Advisors/Clients) | None |
| Venue reuse | None (text fields) | Full normalization |
| Event queries | Complex (4 date columns) | Simple (one row per event) |
| Aggregations | Manual | Auto-rollups |

---

## Questions for Cameron

1. Should Advisors track multiple regions (many-to-many via junction table)?
2. Do you need separate Contact vs Billing info on Advisors?
3. Any fields from Clients that shouldn't merge into Advisors?
4. Priority: Start fresh or migrate existing data?
