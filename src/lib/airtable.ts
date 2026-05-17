import Airtable from 'airtable';

// Configure Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_PAT,
}).base(process.env.AIRTABLE_BASE_ID!);

// Table references
const tables = {
  orders: base('Orders'),
  groups: base('Groups'),
  regions: base('Regions'),
  charities: base('Charities'),
  advisors: base('Advisors'),
  digitalJobs: base('Digital_Jobs'),
  directMailJobs: base('Direct_Mail_Jobs'),
  venues: base('Venues'),
  proofs: base('Proofs'),
  invoices: base('Invoices'),
  creatives: base('Creatives'),
  mailerTypes: base('Mailer_Types'),
};

// ============ HELPERS ============

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateStr(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getLinkedIds(field: any): string[] {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  return [field];
}

function getStr(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val.state === 'error') return '';
  if (typeof val === 'string') return val;
  return String(val);
}

function getNum(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function getBool(val: any): boolean {
  return val === true || val === 'true' || val === 1;
}

// ============ RAW DATA FETCHERS ============

async function fetchAllRecords(table: Airtable.Table<any>) {
  const records: any[] = [];
  await table.select().eachPage((pageRecords, fetchNextPage) => {
    records.push(...pageRecords);
    fetchNextPage();
  });
  return records;
}

// ============ COMPLETE DATA LOAD ============

export interface FullDatabase {
  orders: Map<string, any>;
  advisors: Map<string, any>;
  groups: Map<string, any>;
  regions: Map<string, any>;
  charities: Map<string, any>;
  venues: Map<string, any>;
  digitalJobs: Map<string, any>;
  directMailJobs: Map<string, any>;
  proofs: Map<string, any>;
  invoices: Map<string, any>;
  creatives: Map<string, any>;
}

let cachedDb: FullDatabase | null = null;
let cacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds for dev

export async function loadFullDatabase(): Promise<FullDatabase> {
  const now = Date.now();
  if (cachedDb && (now - cacheTime) < CACHE_TTL) {
    return cachedDb;
  }

  const [
    ordersRaw,
    advisorsRaw,
    groupsRaw,
    regionsRaw,
    charitiesRaw,
    venuesRaw,
    digitalJobsRaw,
    directMailJobsRaw,
    proofsRaw,
    invoicesRaw,
    creativesRaw,
  ] = await Promise.all([
    fetchAllRecords(tables.orders),
    fetchAllRecords(tables.advisors),
    fetchAllRecords(tables.groups),
    fetchAllRecords(tables.regions),
    fetchAllRecords(tables.charities),
    fetchAllRecords(tables.venues),
    fetchAllRecords(tables.digitalJobs),
    fetchAllRecords(tables.directMailJobs),
    fetchAllRecords(tables.proofs),
    fetchAllRecords(tables.invoices),
    fetchAllRecords(tables.creatives),
  ]);

  const toMap = (records: any[]) => {
    const map = new Map<string, any>();
    records.forEach(r => map.set(r.id, { id: r.id, ...r.fields }));
    return map;
  };

  cachedDb = {
    orders: toMap(ordersRaw),
    advisors: toMap(advisorsRaw),
    groups: toMap(groupsRaw),
    regions: toMap(regionsRaw),
    charities: toMap(charitiesRaw),
    venues: toMap(venuesRaw),
    digitalJobs: toMap(digitalJobsRaw),
    directMailJobs: toMap(directMailJobsRaw),
    proofs: toMap(proofsRaw),
    invoices: toMap(invoicesRaw),
    creatives: toMap(creativesRaw),
  };
  cacheTime = now;

  return cachedDb;
}

// ============ FULL GROUP TYPE ============

export interface FullGroup {
  id: string;
  name: string;
  website: string;
  registration_phone: string;
  registration_url: string;
  address: string;
  responsibility: string;
  // Linked counts
  advisorCount: number;
  orderCount: number;
  activeOrderCount: number;
  venueCount: number;
  charityCount: number;
  // Linked IDs
  advisorIds: string[];
  orderIds: string[];
  venueIds: string[];
  charityIds: string[];
  regionIds: string[];
}

// ============ FULL REGION TYPE ============

export interface FullRegion {
  id: string;
  name: string;
  state: string;
  default_quantity: number;
  // Linked
  groupIds: string[];
  charityIds: string[];
  orderIds: string[];
  venueIds: string[];
}

// ============ FULL CHARITY TYPE ============

export interface FullCharity {
  id: string;
  name: string;
  short_name: string;
  // Linked
  regionIds: string[];
  orderIds: string[];
  clientIds: string[];
  groupIds: string[];
}

// ============ FULL VENUE TYPE ============

export interface FullVenue {
  id: string;
  name: string;
  full_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  default_room: string;
  capacity: number;
  parking_notes: string;
  // Linked
  regionIds: string[];
  clientIds: string[];
  groupIds: string[];
}

// ============ FULL CREATIVE TYPE ============

export interface FullCreative {
  id: string;
  name: string;
  code: string;
  type: string;
  topic: string;
  active: boolean;
  preview_image: any[];
  template_file: any[];
  // Linked
  directMailJobIds: string[];
  groupIds: string[];
}

// ============ FULL DIGITAL JOB TYPE ============

export interface FullDigitalJob {
  id: string;
  order_number: number;
  status: string;
  advisor_name: string;
  group_name: string;
  first_event_date: string;
  second_event_date: string;
  location_name: string;
  location_address: string;
  start_time: string;
  end_time: string;
  class_type: string;
  qa_status: string;
  tp_status: string;
  sheet_needed: boolean;
  landing_page_url: string;
  max_budget: number;
  notes: string;
  privacy_company_name: string;
  privacy_company_website: string;
  disclaimer: string;
  ethnicity_notes: string;
  status_text: string;
  // Linked IDs
  orderIds: string[];
  clientIds: string[];
  directMailJobIds: string[];
  groupIds: string[];
}

// ============ FULL DIRECT MAIL JOB TYPE ============

export interface FullDirectMailJob {
  id: string;
  job_name: string;
  order_number: number;
  status: string;
  print_date: string;
  mail_date: string;
  quantity: number;
  targeting_criteria: string;
  list_file: any[];
  creative_code: string;
  proof_file: any[];
  proof_status: string;
  proof_feedback: string;
  // Copied from order
  advisor_name: string;
  group_name: string;
  first_event_date: string;
  second_event_date: string;
  third_event_date: string;
  fourth_event_date: string;
  market: string;
  office_location: string;
  charity: string;
  class_type: string;
  mailer_type: string;
  mailer_return_address: string;
  landing_page_url: string;
  venue_name: string;
  venue_address: string;
  start_time: string;
  end_time: string;
  first_event_room: string;
  second_event_room: string;
  third_event_room: string;
  fourth_event_room: string;
  notes: string;
  responsibility: string;
  digital_budget: number;
  added_to_sheets: string;
  // Linked IDs
  orderIds: string[];
  creativeIds: string[];
  digitalJobIds: string[];
  clientIds: string[];
  groupIds: string[];
}

// ============ FULL INVOICE TYPE ============

export interface FullInvoice {
  id: string;
  invoice_number: string;
  order_number: number;
  advisor_name: string;
  group_name: string;
  status: string;
  status_text: string;
  sent_date: string;
  paid_date: string;
  first_class_day: string;
  direct_rate: number;
  mailing_quantity: number;
  direct_mail_discounts: number;
  invoiced_direct_mail: number;
  invoiced_digital: number;
  invoiced_tech_sequences: number;
  cc_processing: number;
  fl_state_tax: number;
  total_invoice: number;
  mailer_type: string;
  venue_info: string;
  // Linked IDs
  orderIds: string[];
  clientIds: string[];
  groupIds: string[];
}

// ============ FULL PROOF TYPE ============

export interface FullProof {
  id: string;
  name: string;
  notes: string;
  assignee: any;
  status: string;
  attachments: any[];
  attachment_summary: string;
  proof_file: any[];
  proof_version: number;
  proof_status: string;
  proof_feedback: string;
  approved_at: string;
  uploaded_at: string;
  // Linked IDs
  orderIds: string[];
  groupIds: string[];
}

// ============ FULL ADVISOR TYPE ============

export interface FullAdvisor {
  id: string;
  advisor_name: string;
  group_name: string;
  business_name: string;
  business_website: string;
  business_address: string;
  business_city: string;
  business_state: string;
  mailer_return_address: string;
  registration_phone: string;
  website_registration_direct: string;
  website_registration_digital: string;
  ein: string;
  disclaimer: string;
  main_contact_name: string;
  main_contact_email: string;
  main_contact_phone: string;
  secondary_contact_name: string;
  secondary_contact_email: string;
  cc_emails: string;
  preferred_mailer_topics: string;
  mailer_type_used: string;
  order_instructions: string;
  direct_mailer_rate: number;
  usual_mailing_quantity: number;
  default_digital_budget: number;
  direct_mail_discounts: string;
  start_orders_before_paid: boolean;
  non_profit_status: boolean;
  client_notes: string;
  // Stats
  orderCount: number;
  activeOrderCount: number;
  totalMailQuantity: number;
  // Linked data
  group: FullGroup | null;
  orders: FullOrder[];
  venues: FullVenue[];
  charities: FullCharity[];
  digitalJobs: FullDigitalJob[];
  directMailJobs: FullDirectMailJob[];
  invoices: FullInvoice[];
}

// ============ FULL ORDER TYPE ============

export interface FullOrder {
  id: string;
  order_number: number;
  advisor: string;
  group_name: string;
  // Event dates
  first_event_date: string;
  second_event_date: string;
  third_event_date: string;
  fourth_event_date: string;
  // Event rooms
  first_event_room: string;
  second_event_room: string;
  third_event_room: string;
  fourth_event_room: string;
  // Venue
  venue_name: string;
  venue_address: string;
  // Times
  start_time: string;
  end_time: string;
  // Marketing flags
  needs_direct_mail: boolean;
  needs_digital: boolean;
  // Mailing
  mailing_quantity: number;
  mailer_type: string;
  digital_budget: number;
  landing_page_url: string;
  // Classification
  class_type: string;
  market: string;
  office_location: string;
  order_office_location: string;
  // Status
  status: string;
  proof_status: string;
  proof_feedback: string;
  proof_approved_at: string;
  overall_priority: string;
  order_summary: string;
  // Notes
  event_notes: string;
  // Timestamps
  created_at: string;
  last_modified_at: string;
  // Proof file
  proof_file: any[];
  // Computed
  daysUntilEvent: number | null;
  isPast: boolean;
  isUrgent: boolean;
  // LINKED DATA
  advisor_data: FullAdvisor | null;
  group_data: FullGroup | null;
  region_data: FullRegion | null;
  charity_data: FullCharity | null;
  digital_jobs: FullDigitalJob[];
  direct_mail_jobs: FullDirectMailJob[];
  proofs: FullProof[];
  invoices: FullInvoice[];
}

// ============ BUILD FULL GROUP ============

function buildFullGroup(g: any, db: FullDatabase): FullGroup {
  const advisorIds = getLinkedIds(g.Clients || g.Advisors);
  const orderIds = getLinkedIds(g.Orders);
  const venueIds = getLinkedIds(g.Venues).concat(getLinkedIds(g['Venues 2']));
  const charityIds = getLinkedIds(g.Charities).concat(getLinkedIds(g['Charities 2']));
  const regionIds = getLinkedIds(g.Regions);
  
  // Count active orders
  let activeOrderCount = 0;
  orderIds.forEach(oid => {
    const o = db.orders.get(oid);
    if (o) {
      const d = parseDate(o.first_event_date);
      const days = daysUntil(d);
      const isPast = days !== null && days < 0;
      if (!isPast && o.status !== 'completed' && o.status !== 'cancelled') {
        activeOrderCount++;
      }
    }
  });

  return {
    id: g.id,
    name: getStr(g.Name),
    website: getStr(g.Website),
    registration_phone: getStr(g['Registration Phone']),
    registration_url: getStr(g['Registration URL']),
    address: getStr(g.Address),
    responsibility: getStr(g.Responsibility),
    advisorCount: advisorIds.length,
    orderCount: orderIds.length,
    activeOrderCount,
    venueCount: venueIds.length,
    charityCount: charityIds.length,
    advisorIds,
    orderIds,
    venueIds,
    charityIds,
    regionIds,
  };
}

// ============ BUILD FULL REGION ============

function buildFullRegion(r: any): FullRegion {
  return {
    id: r.id,
    name: getStr(r.Name),
    state: getStr(r.State),
    default_quantity: getNum(r['Default Quantity']),
    groupIds: getLinkedIds(r.Group),
    charityIds: getLinkedIds(r.Charities),
    orderIds: getLinkedIds(r.Orders),
    venueIds: getLinkedIds(r.Venues),
  };
}

// ============ BUILD FULL CHARITY ============

function buildFullCharity(c: any): FullCharity {
  return {
    id: c.id,
    name: getStr(c.Name),
    short_name: getStr(c['Short Name']),
    regionIds: getLinkedIds(c.Region),
    orderIds: getLinkedIds(c.Orders),
    clientIds: getLinkedIds(c.Clients),
    groupIds: getLinkedIds(c.Groups).concat(getLinkedIds(c.Group)),
  };
}

// ============ BUILD FULL VENUE ============

function buildFullVenue(v: any): FullVenue {
  return {
    id: v.id,
    name: getStr(v.Name),
    full_name: getStr(v['Full Name']),
    address: getStr(v.Address),
    city: getStr(v.City),
    state: getStr(v.State),
    zip: getStr(v.Zip),
    default_room: getStr(v['Default Room']),
    capacity: getNum(v.Capacity),
    parking_notes: getStr(v['Parking Notes']),
    regionIds: getLinkedIds(v.Region),
    clientIds: getLinkedIds(v.Clients),
    groupIds: getLinkedIds(v.Groups).concat(getLinkedIds(v.Group)),
  };
}

// ============ BUILD FULL DIGITAL JOB ============

function buildFullDigitalJob(dj: any): FullDigitalJob {
  return {
    id: dj.id,
    order_number: getNum(dj.order_number),
    status: getStr(dj.status),
    advisor_name: getStr(dj.advisor_name),
    group_name: getStr(dj.group_name),
    first_event_date: getStr(dj.first_event_date),
    second_event_date: getStr(dj.second_event_date),
    location_name: getStr(dj.location_name),
    location_address: getStr(dj.location_address),
    start_time: getStr(dj.start_time),
    end_time: getStr(dj.end_time),
    class_type: getStr(dj.class_type),
    qa_status: getStr(dj.qa_status),
    tp_status: getStr(dj.tp_status),
    sheet_needed: getBool(dj.sheet_needed),
    landing_page_url: getStr(dj.landing_page_url),
    max_budget: getNum(dj.max_budget),
    notes: getStr(dj.notes),
    privacy_company_name: getStr(dj.privacy_company_name),
    privacy_company_website: getStr(dj.privacy_company_website),
    disclaimer: getStr(dj.disclaimer),
    ethnicity_notes: getStr(dj.ethnicity_notes),
    status_text: getStr(dj.status_text),
    orderIds: getLinkedIds(dj.order).concat(getLinkedIds(dj.Orders)),
    clientIds: getLinkedIds(dj.client),
    directMailJobIds: getLinkedIds(dj.Direct_Mail_Jobs),
    groupIds: getLinkedIds(dj.Group),
  };
}

// ============ BUILD FULL DIRECT MAIL JOB ============

function buildFullDirectMailJob(dm: any): FullDirectMailJob {
  return {
    id: dm.id,
    job_name: getStr(dm.job_name),
    order_number: getNum(dm.order_number),
    status: getStr(dm.status),
    print_date: getStr(dm.print_date),
    mail_date: getStr(dm.mail_date),
    quantity: getNum(dm.quantity),
    targeting_criteria: getStr(dm.targeting_criteria),
    list_file: dm.list_file || [],
    creative_code: getStr(dm.creative_code),
    proof_file: dm.proof_file || [],
    proof_status: getStr(dm.proof_status),
    proof_feedback: getStr(dm.proof_feedback),
    advisor_name: getStr(dm['Advisor Name']),
    group_name: getStr(dm['Group Name']),
    first_event_date: getStr(dm['First Event Date'] || dm.first_event_date),
    second_event_date: getStr(dm['Second Event Date'] || dm.second_event_date),
    third_event_date: getStr(dm['Third Event Date']),
    fourth_event_date: getStr(dm['Fourth Event Date']),
    market: getStr(dm.Market),
    office_location: getStr(dm['Office Location']),
    charity: getStr(dm.Charity),
    class_type: getStr(dm['Class Type']),
    mailer_type: getStr(dm['Mailer Type']),
    mailer_return_address: getStr(dm['Mailer Return Address']),
    landing_page_url: getStr(dm['Landing Page URL']),
    venue_name: getStr(dm['Venue Name']),
    venue_address: getStr(dm['Venue Address']),
    start_time: getStr(dm['Start Time']),
    end_time: getStr(dm['End Time']),
    first_event_room: getStr(dm['First Event Room']),
    second_event_room: getStr(dm['Second Event Room']),
    third_event_room: getStr(dm['Third Event Room']),
    fourth_event_room: getStr(dm['Fourth Event Room']),
    notes: getStr(dm.Notes),
    responsibility: getStr(dm.Responsibility),
    digital_budget: getNum(dm['Digital Budget']),
    added_to_sheets: getStr(dm['Added to Sheets']),
    orderIds: getLinkedIds(dm.order),
    creativeIds: getLinkedIds(dm.creative),
    digitalJobIds: getLinkedIds(dm.Digital_Job),
    clientIds: getLinkedIds(dm.Client),
    groupIds: getLinkedIds(dm.Group),
  };
}

// ============ BUILD FULL INVOICE ============

function buildFullInvoice(inv: any): FullInvoice {
  return {
    id: inv.id,
    invoice_number: getStr(inv.invoice_number),
    order_number: getNum(inv.order_number),
    advisor_name: getStr(inv.advisor_name),
    group_name: getStr(inv.group_name),
    status: getStr(inv.status),
    status_text: getStr(inv.status_text),
    sent_date: getStr(inv.sent_date),
    paid_date: getStr(inv.paid_date),
    first_class_day: getStr(inv.first_class_day),
    direct_rate: getNum(inv.direct_rate),
    mailing_quantity: getNum(inv.mailing_quantity),
    direct_mail_discounts: getNum(inv.direct_mail_discounts),
    invoiced_direct_mail: getNum(inv.invoiced_direct_mail),
    invoiced_digital: getNum(inv.invoiced_digital),
    invoiced_tech_sequences: getNum(inv.invoiced_tech_sequences),
    cc_processing: getNum(inv.cc_processing),
    fl_state_tax: getNum(inv.fl_state_tax),
    total_invoice: getNum(inv.total_invoice),
    mailer_type: getStr(inv.mailer_type),
    venue_info: getStr(inv.venue_info),
    orderIds: getLinkedIds(inv.order).concat(getLinkedIds(inv.Orders)),
    clientIds: getLinkedIds(inv.client),
    groupIds: getLinkedIds(inv.Group),
  };
}

// ============ BUILD FULL PROOF ============

function buildFullProof(p: any): FullProof {
  return {
    id: p.id,
    name: getStr(p.Name),
    notes: getStr(p.Notes),
    assignee: p.Assignee || null,
    status: getStr(p.Status),
    attachments: p.Attachments || [],
    attachment_summary: getStr(p['Attachment Summary']),
    proof_file: p.proof_file || [],
    proof_version: getNum(p.proof_version),
    proof_status: getStr(p.proof_status),
    proof_feedback: getStr(p.proof_feedback),
    approved_at: getStr(p.approved_at),
    uploaded_at: getStr(p.uploaded_at),
    orderIds: getLinkedIds(p.Order),
    groupIds: getLinkedIds(p.Group),
  };
}

// ============ BUILD FULL CREATIVE ============

function buildFullCreative(c: any): FullCreative {
  return {
    id: c.id,
    name: getStr(c.name),
    code: getStr(c.code),
    type: getStr(c.type),
    topic: getStr(c.topic),
    active: getBool(c.active),
    preview_image: c.preview_image || [],
    template_file: c.template_file || [],
    directMailJobIds: getLinkedIds(c.Direct_Mail_Jobs),
    groupIds: getLinkedIds(c.Group),
  };
}

// ============ GET ENRICHED ORDERS ============

export async function getEnrichedOrders(): Promise<FullOrder[]> {
  const db = await loadFullDatabase();
  const enrichedOrders: FullOrder[] = [];

  // Build lookup maps for linked data
  const groupMap = new Map<string, FullGroup>();
  for (const [id, g] of db.groups) {
    groupMap.set(id, buildFullGroup(g, db));
  }

  const regionMap = new Map<string, FullRegion>();
  for (const [id, r] of db.regions) {
    regionMap.set(id, buildFullRegion(r));
  }

  const charityMap = new Map<string, FullCharity>();
  for (const [id, c] of db.charities) {
    charityMap.set(id, buildFullCharity(c));
  }

  const digitalJobMap = new Map<string, FullDigitalJob>();
  for (const [id, dj] of db.digitalJobs) {
    digitalJobMap.set(id, buildFullDigitalJob(dj));
  }

  const directMailJobMap = new Map<string, FullDirectMailJob>();
  for (const [id, dm] of db.directMailJobs) {
    directMailJobMap.set(id, buildFullDirectMailJob(dm));
  }

  const proofMap = new Map<string, FullProof>();
  for (const [id, p] of db.proofs) {
    proofMap.set(id, buildFullProof(p));
  }

  const invoiceMap = new Map<string, FullInvoice>();
  for (const [id, inv] of db.invoices) {
    invoiceMap.set(id, buildFullInvoice(inv));
  }

  for (const [id, order] of db.orders) {
    const firstEventDate = parseDate(order.first_event_date);
    const daysUntilEventVal = daysUntil(firstEventDate);
    const isPast = daysUntilEventVal !== null && daysUntilEventVal < 0;
    const isUrgent = !isPast && daysUntilEventVal !== null && daysUntilEventVal <= 7;

    // Get linked advisor (simplified for order context)
    const advisorIds = getLinkedIds(order.Advisor_Link || order.client);
    let advisorData: any = null;
    if (advisorIds.length > 0) {
      const adv = db.advisors.get(advisorIds[0]);
      if (adv) {
        advisorData = {
          id: adv.id,
          advisor_name: getStr(adv.advisor_name),
          group_name: getStr(adv.group_name),
          business_name: getStr(adv.business_name),
          business_website: getStr(adv.business_website),
          business_address: getStr(adv.business_address),
          business_city: getStr(adv.business_city),
          business_state: getStr(adv.business_state),
          mailer_return_address: getStr(adv.mailer_return_address),
          registration_phone: getStr(adv.registration_phone),
          website_registration_direct: getStr(adv.website_registration_direct),
          website_registration_digital: getStr(adv.website_registration_digital),
          main_contact_name: getStr(adv.main_contact_name),
          main_contact_email: getStr(adv.main_contact_email),
          main_contact_phone: getStr(adv.main_contact_phone),
          secondary_contact_name: getStr(adv.secondary_contact_name),
          secondary_contact_email: getStr(adv.secondary_contact_email),
          cc_emails: getStr(adv.cc_emails),
          usual_mailing_quantity: getNum(adv.usual_mailing_quantity),
          default_digital_budget: getNum(adv.default_digital_budget),
          direct_mailer_rate: getNum(adv.direct_mailer_rate),
          order_instructions: getStr(adv.order_instructions),
          client_notes: getStr(adv.client_notes),
          ein: getStr(adv.ein),
          disclaimer: getStr(adv.disclaimer),
          preferred_mailer_topics: getStr(adv.preferred_mailer_topics),
          mailer_type_used: getStr(adv.mailer_type_used),
          direct_mail_discounts: getStr(adv.direct_mail_discounts),
          start_orders_before_paid: getBool(adv.start_orders_before_paid),
          non_profit_status: getBool(adv.non_profit_status),
        };
      }
    }

    // Get linked group
    const groupIds = getLinkedIds(order.Group);
    const groupData = groupIds.length > 0 ? groupMap.get(groupIds[0]) || null : null;

    // Get linked region
    const regionIds = getLinkedIds(order.Region);
    const regionData = regionIds.length > 0 ? regionMap.get(regionIds[0]) || null : null;

    // Get linked charity
    const charityIds = getLinkedIds(order.Charity);
    const charityData = charityIds.length > 0 ? charityMap.get(charityIds[0]) || null : null;

    // Get linked digital jobs
    const djIds = getLinkedIds(order.Digital_Jobs);
    const digitalJobs = djIds.map(djId => digitalJobMap.get(djId)).filter(Boolean) as FullDigitalJob[];

    // Get linked direct mail jobs
    const dmIds = getLinkedIds(order.Direct_Mail_Jobs);
    const directMailJobs = dmIds.map(dmId => directMailJobMap.get(dmId)).filter(Boolean) as FullDirectMailJob[];

    // Get linked proofs
    const proofIds = getLinkedIds(order.Proofs);
    const proofs = proofIds.map(pId => proofMap.get(pId)).filter(Boolean) as FullProof[];

    // Get linked invoices
    const invIds = getLinkedIds(order.Invoices).concat(getLinkedIds(order['Invoices 2']));
    const invoices = invIds.map(iId => invoiceMap.get(iId)).filter(Boolean) as FullInvoice[];

    enrichedOrders.push({
      id,
      order_number: getNum(order.order_number),
      advisor: getStr(order.advisor),
      group_name: getStr(order.group_name),
      first_event_date: getStr(order.first_event_date),
      second_event_date: getStr(order.second_event_date),
      third_event_date: getStr(order.third_event_date),
      fourth_event_date: getStr(order.fourth_event_date),
      first_event_room: getStr(order.first_event_room),
      second_event_room: getStr(order.second_event_room),
      third_event_room: getStr(order.third_event_room),
      fourth_event_room: getStr(order.fourth_event_room),
      venue_name: getStr(order.venue_name),
      venue_address: getStr(order.venue_address),
      start_time: getStr(order.start_time),
      end_time: getStr(order.end_time),
      needs_direct_mail: getBool(order.needs_direct_mail),
      needs_digital: getBool(order.needs_digital),
      mailing_quantity: getNum(order.mailing_quantity),
      mailer_type: getStr(order.mailer_type),
      digital_budget: getNum(order.digital_budget),
      landing_page_url: getStr(order.landing_page_url),
      class_type: getStr(order.class_type),
      market: getStr(order.market),
      office_location: getStr(order.office_location),
      order_office_location: getStr(order.order_office_location),
      status: getStr(order.status) || 'pending',
      proof_status: getStr(order.proof_status),
      proof_feedback: getStr(order.proof_feedback),
      proof_approved_at: getStr(order.proof_approved_at),
      overall_priority: getStr(order.overall_priority),
      order_summary: getStr(order.order_summary),
      event_notes: getStr(order.event_notes),
      created_at: getStr(order.created_at),
      last_modified_at: getStr(order.last_modified_at),
      proof_file: order.proof_file || [],
      daysUntilEvent: daysUntilEventVal,
      isPast,
      isUrgent,
      advisor_data: advisorData,
      group_data: groupData,
      region_data: regionData,
      charity_data: charityData,
      digital_jobs: digitalJobs,
      direct_mail_jobs: directMailJobs,
      proofs,
      invoices,
    });
  }

  // Sort: urgent first, then by days until event
  enrichedOrders.sort((a, b) => {
    if (a.status === 'cancelled' && b.status !== 'cancelled') return 1;
    if (b.status === 'cancelled' && a.status !== 'cancelled') return -1;
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    if (a.isPast && !b.isPast) return 1;
    if (!a.isPast && b.isPast) return -1;
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    const aDays = a.daysUntilEvent ?? 999;
    const bDays = b.daysUntilEvent ?? 999;
    return aDays - bDays;
  });

  return enrichedOrders;
}

// ============ GET ENRICHED ADVISORS ============

export async function getEnrichedAdvisors(): Promise<FullAdvisor[]> {
  const db = await loadFullDatabase();
  const enrichedAdvisors: FullAdvisor[] = [];

  // Build lookup maps
  const groupMap = new Map<string, FullGroup>();
  for (const [id, g] of db.groups) {
    groupMap.set(id, buildFullGroup(g, db));
  }

  const venueMap = new Map<string, FullVenue>();
  for (const [id, v] of db.venues) {
    venueMap.set(id, buildFullVenue(v));
  }

  const charityMap = new Map<string, FullCharity>();
  for (const [id, c] of db.charities) {
    charityMap.set(id, buildFullCharity(c));
  }

  const digitalJobMap = new Map<string, FullDigitalJob>();
  for (const [id, dj] of db.digitalJobs) {
    digitalJobMap.set(id, buildFullDigitalJob(dj));
  }

  const directMailJobMap = new Map<string, FullDirectMailJob>();
  for (const [id, dm] of db.directMailJobs) {
    directMailJobMap.set(id, buildFullDirectMailJob(dm));
  }

  const invoiceMap = new Map<string, FullInvoice>();
  for (const [id, inv] of db.invoices) {
    invoiceMap.set(id, buildFullInvoice(inv));
  }

  for (const [id, adv] of db.advisors) {
    // Get linked group
    const groupIds = getLinkedIds(adv.group);
    const group = groupIds.length > 0 ? groupMap.get(groupIds[0]) || null : null;

    // Get linked orders and build simplified order list
    const orderIds = getLinkedIds(adv.Orders).concat(getLinkedIds(adv['Orders 2']));
    const orders: FullOrder[] = [];
    let totalMailQty = 0;
    let activeCount = 0;

    for (const oid of orderIds) {
      const o = db.orders.get(oid);
      if (!o) continue;

      const firstEventDate = parseDate(o.first_event_date);
      const daysVal = daysUntil(firstEventDate);
      const isPast = daysVal !== null && daysVal < 0;
      const isUrgent = !isPast && daysVal !== null && daysVal <= 7;

      if (!isPast && o.status !== 'completed' && o.status !== 'cancelled') {
        activeCount++;
      }

      totalMailQty += getNum(o.mailing_quantity);

      orders.push({
        id: o.id,
        order_number: getNum(o.order_number),
        advisor: getStr(o.advisor),
        group_name: getStr(o.group_name),
        first_event_date: getStr(o.first_event_date),
        second_event_date: getStr(o.second_event_date),
        third_event_date: getStr(o.third_event_date),
        fourth_event_date: getStr(o.fourth_event_date),
        first_event_room: getStr(o.first_event_room),
        second_event_room: getStr(o.second_event_room),
        third_event_room: getStr(o.third_event_room),
        fourth_event_room: getStr(o.fourth_event_room),
        venue_name: getStr(o.venue_name),
        venue_address: getStr(o.venue_address),
        start_time: getStr(o.start_time),
        end_time: getStr(o.end_time),
        needs_direct_mail: getBool(o.needs_direct_mail),
        needs_digital: getBool(o.needs_digital),
        mailing_quantity: getNum(o.mailing_quantity),
        mailer_type: getStr(o.mailer_type),
        digital_budget: getNum(o.digital_budget),
        landing_page_url: getStr(o.landing_page_url),
        class_type: getStr(o.class_type),
        market: getStr(o.market),
        office_location: getStr(o.office_location),
        order_office_location: getStr(o.order_office_location),
        status: getStr(o.status) || 'pending',
        proof_status: getStr(o.proof_status),
        proof_feedback: getStr(o.proof_feedback),
        proof_approved_at: getStr(o.proof_approved_at),
        overall_priority: getStr(o.overall_priority),
        order_summary: getStr(o.order_summary),
        event_notes: getStr(o.event_notes),
        created_at: getStr(o.created_at),
        last_modified_at: getStr(o.last_modified_at),
        proof_file: o.proof_file || [],
        daysUntilEvent: daysVal,
        isPast,
        isUrgent,
        advisor_data: null,
        group_data: null,
        region_data: null,
        charity_data: null,
        digital_jobs: [],
        direct_mail_jobs: [],
        proofs: [],
        invoices: [],
      });
    }

    // Get linked venues
    const venueIds = getLinkedIds(adv.Venues);
    const venues = venueIds.map(vid => venueMap.get(vid)).filter(Boolean) as FullVenue[];

    // Get linked charities
    const charityIds = getLinkedIds(adv.Charities);
    const charities = charityIds.map(cid => charityMap.get(cid)).filter(Boolean) as FullCharity[];

    // Get linked digital jobs
    const djIds = getLinkedIds(adv.Digital_Jobs);
    const digitalJobs = djIds.map(djId => digitalJobMap.get(djId)).filter(Boolean) as FullDigitalJob[];

    // Get linked direct mail jobs
    const dmIds = getLinkedIds(adv.Direct_Mail_Jobs);
    const directMailJobs = dmIds.map(dmId => directMailJobMap.get(dmId)).filter(Boolean) as FullDirectMailJob[];

    // Get linked invoices
    const invIds = getLinkedIds(adv.Invoices);
    const invoices = invIds.map(iId => invoiceMap.get(iId)).filter(Boolean) as FullInvoice[];

    enrichedAdvisors.push({
      id,
      advisor_name: getStr(adv.advisor_name),
      group_name: getStr(adv.group_name),
      business_name: getStr(adv.business_name),
      business_website: getStr(adv.business_website),
      business_address: getStr(adv.business_address),
      business_city: getStr(adv.business_city),
      business_state: getStr(adv.business_state),
      mailer_return_address: getStr(adv.mailer_return_address),
      registration_phone: getStr(adv.registration_phone),
      website_registration_direct: getStr(adv.website_registration_direct),
      website_registration_digital: getStr(adv.website_registration_digital),
      ein: getStr(adv.ein),
      disclaimer: getStr(adv.disclaimer),
      main_contact_name: getStr(adv.main_contact_name),
      main_contact_email: getStr(adv.main_contact_email),
      main_contact_phone: getStr(adv.main_contact_phone),
      secondary_contact_name: getStr(adv.secondary_contact_name),
      secondary_contact_email: getStr(adv.secondary_contact_email),
      cc_emails: getStr(adv.cc_emails),
      preferred_mailer_topics: getStr(adv.preferred_mailer_topics),
      mailer_type_used: getStr(adv.mailer_type_used),
      order_instructions: getStr(adv.order_instructions),
      direct_mailer_rate: getNum(adv.direct_mailer_rate),
      usual_mailing_quantity: getNum(adv.usual_mailing_quantity),
      default_digital_budget: getNum(adv.default_digital_budget),
      direct_mail_discounts: getStr(adv.direct_mail_discounts),
      start_orders_before_paid: getBool(adv.start_orders_before_paid),
      non_profit_status: getBool(adv.non_profit_status),
      client_notes: getStr(adv.client_notes),
      orderCount: orders.length,
      activeOrderCount: activeCount,
      totalMailQuantity: totalMailQty,
      group,
      orders,
      venues,
      charities,
      digitalJobs,
      directMailJobs,
      invoices,
    });
  }

  // Sort by active orders
  enrichedAdvisors.sort((a, b) => b.activeOrderCount - a.activeOrderCount || a.advisor_name.localeCompare(b.advisor_name));

  return enrichedAdvisors;
}

// ============ GET ENRICHED GROUPS ============

export async function getEnrichedGroups(): Promise<FullGroup[]> {
  const db = await loadFullDatabase();
  const groups: FullGroup[] = [];

  for (const [id, g] of db.groups) {
    groups.push(buildFullGroup(g, db));
  }

  groups.sort((a, b) => b.activeOrderCount - a.activeOrderCount || a.name.localeCompare(b.name));
  return groups;
}

// ============ SINGLE RECORD LOOKUPS ============

export async function getEnrichedOrder(id: string): Promise<FullOrder | null> {
  const orders = await getEnrichedOrders();
  return orders.find(o => o.id === id) || null;
}

export async function getEnrichedOrderByNumber(orderNumber: number): Promise<FullOrder | null> {
  const orders = await getEnrichedOrders();
  return orders.find(o => o.order_number === orderNumber) || null;
}

export async function getEnrichedAdvisor(id: string): Promise<FullAdvisor | null> {
  const advisors = await getEnrichedAdvisors();
  return advisors.find(a => a.id === id) || null;
}

export async function getEnrichedGroup(id: string): Promise<FullGroup | null> {
  const groups = await getEnrichedGroups();
  return groups.find(g => g.id === id) || null;
}

// ============ STATS ============

export async function getOrderStats() {
  const orders = await getEnrichedOrders();
  const advisors = await getEnrichedAdvisors();
  const groups = await getEnrichedGroups();

  const activeOrders = orders.filter(o => !o.isPast && o.status !== 'completed' && o.status !== 'cancelled');
  const pastOrders = orders.filter(o => o.isPast || o.status === 'completed');
  const urgentOrders = orders.filter(o => o.isUrgent);

  const byStatus: Record<string, number> = {};
  orders.forEach(o => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });

  const groupStats: Record<string, { active: number; past: number; urgent: number; totalMail: number; regions: number; charities: number }> = {};
  orders.forEach(o => {
    // Use linked group name, fall back to text field
    const group = o.group_data?.name || o.group_name || 'Unknown';
    if (!groupStats[group]) {
      groupStats[group] = { active: 0, past: 0, urgent: 0, totalMail: 0, regions: 0, charities: 0 };
    }
    if (!o.isPast && o.status !== 'completed' && o.status !== 'cancelled') {
      groupStats[group].active++;
    }
    if (o.isPast || o.status === 'completed') {
      groupStats[group].past++;
    }
    if (o.isUrgent) {
      groupStats[group].urgent++;
    }
    groupStats[group].totalMail += o.mailing_quantity;
  });

  // Add region/charity counts from groups
  groups.forEach(g => {
    if (groupStats[g.name]) {
      groupStats[g.name].regions = g.regionIds?.length || 0;
      groupStats[g.name].charities = g.charityIds?.length || 0;
    }
  });

  const byGroup = Object.entries(groupStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.active - a.active);

  const totalMailPieces = orders.reduce((sum, o) => sum + o.mailing_quantity, 0);
  const groupNames = [...new Set(orders.map(o => o.group_name).filter(Boolean))].sort();

  return {
    totalOrders: orders.length,
    activeOrders: activeOrders.length,
    pastOrders: pastOrders.length,
    urgentOrders: urgentOrders.length,
    totalMailPieces,
    totalAdvisors: advisors.length,
    totalGroups: groups.length,
    digitalJobs: orders.filter(o => o.needs_digital).length,
    directMailJobs: orders.filter(o => o.needs_direct_mail).length,
    byStatus,
    byGroup,
    groups: groupNames,
  };
}

// ============ LOOKUPS ============

export async function getLookupData() {
  const db = await loadFullDatabase();

  const orders = Array.from(db.orders.values());
  const charities = Array.from(db.charities.values());
  const venues = Array.from(db.venues.values());
  const regions = Array.from(db.regions.values());
  const groups = Array.from(db.groups.values());
  const advisors = Array.from(db.advisors.values());

  return {
    venues: venues.map(v => getStr(v.Name)).filter(Boolean).sort(),
    venuesFull: venues.map(v => buildFullVenue(v)),
    charities: charities.map(c => getStr(c.Name)).filter(Boolean).sort(),
    charitiesFull: charities.map(c => buildFullCharity(c)),
    classTypes: [...new Set(orders.map(o => getStr(o.class_type)).filter(Boolean))].sort(),
    groups: groups.map(g => getStr(g.Name)).filter(Boolean).sort(),
    groupsFull: groups.map(g => buildFullGroup(g, db)),
    regions: regions.map(r => getStr(r.Name)).filter(Boolean).sort(),
    regionsFull: regions.map(r => buildFullRegion(r)),
    advisors: advisors.map(a => getStr(a.advisor_name)).filter(Boolean).sort(),
    markets: [...new Set(orders.map(o => getStr(o.market)).filter(Boolean))].sort(),
    officeLocations: [...new Set(orders.map(o => getStr(o.office_location)).filter(Boolean))].sort(),
    mailerTypes: [...new Set(orders.map(o => getStr(o.mailer_type)).filter(Boolean))].sort(),
    orderOfficeLocations: [...new Set(orders.map(o => getStr(o.order_office_location)).filter(Boolean))].sort(),
  };
}
