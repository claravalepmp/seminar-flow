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
};

// ============ HELPERS ============

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
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
}

export async function loadFullDatabase(): Promise<FullDatabase> {
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
  ]);

  const toMap = (records: any[]) => {
    const map = new Map<string, any>();
    records.forEach(r => map.set(r.id, { id: r.id, ...r.fields }));
    return map;
  };

  return {
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
  };
}

// ============ ENRICHED ORDER ============

export interface EnrichedOrder {
  id: string;
  order_number: number;
  advisor: string;
  group_name: string;
  // Event dates
  first_event_date: string | null;
  second_event_date: string | null;
  third_event_date: string | null;
  fourth_event_date: string | null;
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
  // Marketing
  needs_direct_mail: boolean;
  needs_digital: boolean;
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
  overall_priority: string;
  order_summary: string;
  // Notes
  event_notes: string;
  // Timestamps
  created_at: string;
  last_modified_at: string;
  proof_approved_at: string;
  // Computed
  daysUntilEvent: number | null;
  isPast: boolean;
  isUrgent: boolean;
  // LINKED DATA - Advisor
  advisor_data: {
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
    main_contact_name: string;
    main_contact_email: string;
    main_contact_phone: string;
    secondary_contact_name: string;
    secondary_contact_email: string;
    cc_emails: string;
    usual_mailing_quantity: number;
    default_digital_budget: number;
    direct_mailer_rate: number;
    order_instructions: string;
    client_notes: string;
    ein: string;
    disclaimer: string;
  } | null;
  // LINKED DATA - Group
  group_data: {
    id: string;
    name: string;
    website: string;
    registration_phone: string;
    registration_url: string;
    address: string;
    responsibility: string;
  } | null;
  // LINKED DATA - Region
  region_data: {
    id: string;
    name: string;
    state: string;
    default_quantity: number;
  } | null;
  // LINKED DATA - Charity
  charity_data: {
    id: string;
    name: string;
    short_name: string;
  } | null;
  // LINKED DATA - Digital Jobs
  digital_jobs: Array<{
    id: string;
    order_number: number;
    status: string;
    qa_status: string;
    tp_status: string;
    landing_page_url: string;
    max_budget: number;
    notes: string;
    first_event_date: string;
    second_event_date: string;
  }>;
  // LINKED DATA - Direct Mail Jobs
  direct_mail_jobs: Array<{
    id: string;
    job_name: string;
    order_number: number;
    status: string;
    print_date: string;
    mail_date: string;
    quantity: number;
    targeting_criteria: string;
    creative_code: string;
    proof_status: string;
    proof_feedback: string;
  }>;
  // LINKED DATA - Proofs
  proofs: Array<{
    id: string;
    name: string;
    notes: string;
    status: string;
    proof_version: number;
    proof_status: string;
    proof_feedback: string;
    approved_at: string;
    uploaded_at: string;
  }>;
  // LINKED DATA - Invoices
  invoices: Array<{
    id: string;
    invoice_number: string;
    order_number: number;
    status: string;
    sent_date: string;
    paid_date: string;
    total_invoice: number;
    invoiced_direct_mail: number;
    invoiced_digital: number;
  }>;
}

export async function getEnrichedOrders(): Promise<EnrichedOrder[]> {
  const db = await loadFullDatabase();
  const enrichedOrders: EnrichedOrder[] = [];

  for (const [id, order] of db.orders) {
    const firstEventDate = parseDate(order.first_event_date);
    const daysUntilEventVal = daysUntil(firstEventDate);
    const isPast = daysUntilEventVal !== null && daysUntilEventVal < 0;
    const isUrgent = !isPast && daysUntilEventVal !== null && daysUntilEventVal <= 7;

    // Get linked advisor
    const advisorIds = getLinkedIds(order.Advisor_Link || order.client);
    let advisorData = null;
    if (advisorIds.length > 0) {
      const adv = db.advisors.get(advisorIds[0]);
      if (adv) {
        advisorData = {
          id: adv.id,
          advisor_name: adv.advisor_name || '',
          group_name: adv.group_name || '',
          business_name: adv.business_name || '',
          business_website: adv.business_website || '',
          business_address: adv.business_address || '',
          business_city: adv.business_city || '',
          business_state: adv.business_state || '',
          mailer_return_address: adv.mailer_return_address || '',
          registration_phone: adv.registration_phone || '',
          website_registration_direct: adv.website_registration_direct || '',
          website_registration_digital: adv.website_registration_digital || '',
          main_contact_name: adv.main_contact_name || '',
          main_contact_email: adv.main_contact_email || '',
          main_contact_phone: adv.main_contact_phone || '',
          secondary_contact_name: adv.secondary_contact_name || '',
          secondary_contact_email: adv.secondary_contact_email || '',
          cc_emails: adv.cc_emails || '',
          usual_mailing_quantity: adv.usual_mailing_quantity || 0,
          default_digital_budget: adv.default_digital_budget || 0,
          direct_mailer_rate: adv.direct_mailer_rate || 0,
          order_instructions: adv.order_instructions || '',
          client_notes: adv.client_notes || '',
          ein: adv.ein || '',
          disclaimer: adv.disclaimer || '',
        };
      }
    }

    // Get linked group
    const groupIds = getLinkedIds(order.Group);
    let groupData = null;
    if (groupIds.length > 0) {
      const grp = db.groups.get(groupIds[0]);
      if (grp) {
        groupData = {
          id: grp.id,
          name: grp.Name || '',
          website: grp.Website || '',
          registration_phone: grp['Registration Phone'] || '',
          registration_url: grp['Registration URL'] || '',
          address: grp.Address || '',
          responsibility: grp.Responsibility || '',
        };
      }
    }

    // Get linked region
    const regionIds = getLinkedIds(order.Region);
    let regionData = null;
    if (regionIds.length > 0) {
      const reg = db.regions.get(regionIds[0]);
      if (reg) {
        regionData = {
          id: reg.id,
          name: reg.Name || '',
          state: reg.State || '',
          default_quantity: reg['Default Quantity'] || 0,
        };
      }
    }

    // Get linked charity
    const charityIds = getLinkedIds(order.Charity);
    let charityData = null;
    if (charityIds.length > 0) {
      const chr = db.charities.get(charityIds[0]);
      if (chr) {
        charityData = {
          id: chr.id,
          name: chr.Name || '',
          short_name: chr['Short Name'] || '',
        };
      }
    }

    // Get linked digital jobs
    const digitalJobIds = getLinkedIds(order.Digital_Jobs);
    const digitalJobs = digitalJobIds.map(djId => {
      const dj = db.digitalJobs.get(djId);
      if (!dj) return null;
      return {
        id: dj.id,
        order_number: dj.order_number || 0,
        status: dj.status || '',
        qa_status: dj.qa_status || '',
        tp_status: dj.tp_status || '',
        landing_page_url: dj.landing_page_url || '',
        max_budget: dj.max_budget || 0,
        notes: dj.notes || '',
        first_event_date: dj.first_event_date || '',
        second_event_date: dj.second_event_date || '',
      };
    }).filter(Boolean) as any[];

    // Get linked direct mail jobs
    const dmJobIds = getLinkedIds(order.Direct_Mail_Jobs);
    const directMailJobs = dmJobIds.map(dmId => {
      const dm = db.directMailJobs.get(dmId);
      if (!dm) return null;
      return {
        id: dm.id,
        job_name: dm.job_name || '',
        order_number: dm.order_number || 0,
        status: dm.status || '',
        print_date: dm.print_date || '',
        mail_date: dm.mail_date || '',
        quantity: dm.quantity || 0,
        targeting_criteria: dm.targeting_criteria || '',
        creative_code: dm.creative_code || '',
        proof_status: dm.proof_status || '',
        proof_feedback: dm.proof_feedback || '',
      };
    }).filter(Boolean) as any[];

    // Get linked proofs
    const proofIds = getLinkedIds(order.Proofs);
    const proofs = proofIds.map(pId => {
      const p = db.proofs.get(pId);
      if (!p) return null;
      return {
        id: p.id,
        name: p.Name || '',
        notes: p.Notes || '',
        status: p.Status || '',
        proof_version: p.proof_version || 0,
        proof_status: p.proof_status || '',
        proof_feedback: p.proof_feedback || '',
        approved_at: p.approved_at || '',
        uploaded_at: p.uploaded_at || '',
      };
    }).filter(Boolean) as any[];

    // Get linked invoices
    const invoiceIds = getLinkedIds(order.Invoices);
    const invoices = invoiceIds.map(iId => {
      const inv = db.invoices.get(iId);
      if (!inv) return null;
      return {
        id: inv.id,
        invoice_number: inv.invoice_number || '',
        order_number: inv.order_number || 0,
        status: inv.status || '',
        sent_date: inv.sent_date || '',
        paid_date: inv.paid_date || '',
        total_invoice: inv.total_invoice || 0,
        invoiced_direct_mail: inv.invoiced_direct_mail || 0,
        invoiced_digital: inv.invoiced_digital || 0,
      };
    }).filter(Boolean) as any[];

    enrichedOrders.push({
      id,
      order_number: order.order_number || 0,
      advisor: order.advisor || '',
      group_name: order.group_name || '',
      first_event_date: order.first_event_date || null,
      second_event_date: order.second_event_date || null,
      third_event_date: order.third_event_date || null,
      fourth_event_date: order.fourth_event_date || null,
      first_event_room: order.first_event_room || '',
      second_event_room: order.second_event_room || '',
      third_event_room: order.third_event_room || '',
      fourth_event_room: order.fourth_event_room || '',
      venue_name: order.venue_name || '',
      venue_address: order.venue_address || '',
      start_time: order.start_time || '',
      end_time: order.end_time || '',
      needs_direct_mail: order.needs_direct_mail || false,
      needs_digital: order.needs_digital || false,
      mailing_quantity: order.mailing_quantity || 0,
      mailer_type: order.mailer_type || '',
      digital_budget: order.digital_budget || 0,
      landing_page_url: order.landing_page_url || '',
      class_type: order.class_type || '',
      market: order.market || '',
      office_location: order.office_location || '',
      order_office_location: order.order_office_location || '',
      status: order.status || 'pending',
      proof_status: order.proof_status || '',
      proof_feedback: order.proof_feedback || '',
      overall_priority: typeof order.overall_priority === 'string' ? order.overall_priority : '',
      order_summary: typeof order.order_summary === 'string' ? order.order_summary : '',
      event_notes: order.event_notes || '',
      created_at: order.created_at || '',
      last_modified_at: order.last_modified_at || '',
      proof_approved_at: order.proof_approved_at || '',
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

// ============ ENRICHED ADVISOR ============

export interface EnrichedAdvisor {
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
  main_contact_name: string;
  main_contact_email: string;
  main_contact_phone: string;
  secondary_contact_name: string;
  secondary_contact_email: string;
  cc_emails: string;
  usual_mailing_quantity: number;
  default_digital_budget: number;
  direct_mailer_rate: number;
  order_instructions: string;
  client_notes: string;
  ein: string;
  disclaimer: string;
  preferred_mailer_topics: string;
  mailer_type_used: string;
  direct_mail_discounts: string;
  start_orders_before_paid: boolean;
  non_profit_status: boolean;
  // Linked group data
  group_data: {
    id: string;
    name: string;
    website: string;
    registration_phone: string;
    registration_url: string;
    address: string;
    responsibility: string;
  } | null;
  // Stats
  orderCount: number;
  activeOrderCount: number;
  totalMailQuantity: number;
  // Linked orders summary
  orders: Array<{
    id: string;
    order_number: number;
    first_event_date: string | null;
    venue_name: string;
    class_type: string;
    mailing_quantity: number;
    status: string;
    daysUntil: number | null;
    isPast: boolean;
  }>;
  // Linked venues
  venues: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
  }>;
  // Linked charities
  charities: Array<{
    id: string;
    name: string;
    short_name: string;
  }>;
}

export async function getEnrichedAdvisors(): Promise<EnrichedAdvisor[]> {
  const db = await loadFullDatabase();
  const enrichedAdvisors: EnrichedAdvisor[] = [];

  for (const [id, adv] of db.advisors) {
    // Get linked group
    const groupIds = getLinkedIds(adv.group);
    let groupData = null;
    if (groupIds.length > 0) {
      const grp = db.groups.get(groupIds[0]);
      if (grp) {
        groupData = {
          id: grp.id,
          name: grp.Name || '',
          website: grp.Website || '',
          registration_phone: grp['Registration Phone'] || '',
          registration_url: grp['Registration URL'] || '',
          address: grp.Address || '',
          responsibility: grp.Responsibility || '',
        };
      }
    }

    // Get linked orders
    const orderIds = getLinkedIds(adv.Orders);
    const orders = orderIds.map(oId => {
      const o = db.orders.get(oId);
      if (!o) return null;
      const firstEventDate = parseDate(o.first_event_date);
      const daysUntilVal = daysUntil(firstEventDate);
      return {
        id: o.id,
        order_number: o.order_number || 0,
        first_event_date: o.first_event_date || null,
        venue_name: o.venue_name || '',
        class_type: o.class_type || '',
        mailing_quantity: o.mailing_quantity || 0,
        status: o.status || '',
        daysUntil: daysUntilVal,
        isPast: daysUntilVal !== null && daysUntilVal < 0,
      };
    }).filter(Boolean) as any[];

    const activeOrders = orders.filter(o => !o.isPast && o.status !== 'completed' && o.status !== 'cancelled');
    const totalMail = orders.reduce((sum, o) => sum + o.mailing_quantity, 0);

    // Get linked venues
    const venueIds = getLinkedIds(adv.Venues);
    const venues = venueIds.map(vId => {
      const v = db.venues.get(vId);
      if (!v) return null;
      return {
        id: v.id,
        name: v.Name || '',
        address: v.Address || '',
        city: v.City || '',
        state: v.State || '',
      };
    }).filter(Boolean) as any[];

    // Get linked charities
    const charityIds = getLinkedIds(adv.Charities);
    const charities = charityIds.map(cId => {
      const c = db.charities.get(cId);
      if (!c) return null;
      return {
        id: c.id,
        name: c.Name || '',
        short_name: c['Short Name'] || '',
      };
    }).filter(Boolean) as any[];

    enrichedAdvisors.push({
      id,
      advisor_name: adv.advisor_name || '',
      group_name: adv.group_name || '',
      business_name: adv.business_name || '',
      business_website: adv.business_website || '',
      business_address: adv.business_address || '',
      business_city: adv.business_city || '',
      business_state: adv.business_state || '',
      mailer_return_address: adv.mailer_return_address || '',
      registration_phone: adv.registration_phone || '',
      website_registration_direct: adv.website_registration_direct || '',
      website_registration_digital: adv.website_registration_digital || '',
      main_contact_name: adv.main_contact_name || '',
      main_contact_email: adv.main_contact_email || '',
      main_contact_phone: adv.main_contact_phone || '',
      secondary_contact_name: adv.secondary_contact_name || '',
      secondary_contact_email: adv.secondary_contact_email || '',
      cc_emails: adv.cc_emails || '',
      usual_mailing_quantity: adv.usual_mailing_quantity || 0,
      default_digital_budget: adv.default_digital_budget || 0,
      direct_mailer_rate: adv.direct_mailer_rate || 0,
      order_instructions: adv.order_instructions || '',
      client_notes: adv.client_notes || '',
      ein: adv.ein || '',
      disclaimer: adv.disclaimer || '',
      preferred_mailer_topics: adv.preferred_mailer_topics || '',
      mailer_type_used: adv.mailer_type_used || '',
      direct_mail_discounts: adv.direct_mail_discounts || '',
      start_orders_before_paid: adv.start_orders_before_paid || false,
      non_profit_status: adv.non_profit_status || false,
      group_data: groupData,
      orderCount: orders.length,
      activeOrderCount: activeOrders.length,
      totalMailQuantity: totalMail,
      orders,
      venues,
      charities,
    });
  }

  // Sort by active orders
  enrichedAdvisors.sort((a, b) => b.activeOrderCount - a.activeOrderCount);

  return enrichedAdvisors;
}

export async function getEnrichedAdvisor(id: string): Promise<EnrichedAdvisor | null> {
  const advisors = await getEnrichedAdvisors();
  return advisors.find(a => a.id === id) || null;
}

// ============ STATS ============

export async function getOrderStats() {
  const orders = await getEnrichedOrders();
  const advisors = await getEnrichedAdvisors();

  const activeOrders = orders.filter(o => !o.isPast && o.status !== 'completed' && o.status !== 'cancelled');
  const pastOrders = orders.filter(o => o.isPast || o.status === 'completed');
  const urgentOrders = orders.filter(o => o.isUrgent);

  const byStatus: Record<string, number> = {};
  orders.forEach(o => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });

  const groupStats: Record<string, { active: number; past: number; urgent: number; totalMail: number }> = {};
  orders.forEach(o => {
    const group = o.group_name || 'Unknown';
    if (!groupStats[group]) {
      groupStats[group] = { active: 0, past: 0, urgent: 0, totalMail: 0 };
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

  const byGroup = Object.entries(groupStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.active - a.active);

  const totalMailPieces = orders.reduce((sum, o) => sum + o.mailing_quantity, 0);
  const groups = [...new Set(orders.map(o => o.group_name).filter(Boolean))].sort();

  return {
    totalOrders: orders.length,
    activeOrders: activeOrders.length,
    pastOrders: pastOrders.length,
    urgentOrders: urgentOrders.length,
    totalMailPieces,
    totalAdvisors: advisors.length,
    digitalJobs: orders.filter(o => o.needs_digital).length,
    directMailJobs: orders.filter(o => o.needs_direct_mail).length,
    byStatus,
    byGroup,
    groups,
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

  return {
    venues: venues.map(v => v.Name).filter(Boolean),
    venuesFull: venues.map(v => ({
      id: v.id,
      name: v.Name || '',
      full_name: v['Full Name'] || '',
      address: v.Address || '',
      city: v.City || '',
      state: v.State || '',
      zip: v.Zip || '',
      default_room: v['Default Room'] || '',
      capacity: v.Capacity || 0,
    })),
    charities: charities.map(c => c.Name).filter(Boolean),
    charitiesFull: charities.map(c => ({
      id: c.id,
      name: c.Name || '',
      short_name: c['Short Name'] || '',
    })),
    classTypes: [...new Set(orders.map(o => o.class_type).filter(Boolean))].sort(),
    groups: groups.map(g => g.Name).filter(Boolean),
    groupsFull: groups.map(g => ({
      id: g.id,
      name: g.Name || '',
      website: g.Website || '',
      registration_phone: g['Registration Phone'] || '',
      registration_url: g['Registration URL'] || '',
      address: g.Address || '',
      responsibility: g.Responsibility || '',
    })),
    regions: regions.map(r => r.Name).filter(Boolean),
    regionsFull: regions.map(r => ({
      id: r.id,
      name: r.Name || '',
      state: r.State || '',
      default_quantity: r['Default Quantity'] || 0,
    })),
    markets: [...new Set(orders.map(o => o.market).filter(Boolean))].sort(),
    officeLocations: [...new Set(orders.map(o => o.office_location).filter(Boolean))].sort(),
    mailerTypes: [...new Set(orders.map(o => o.mailer_type).filter(Boolean))].sort(),
  };
}

// ============ SINGLE RECORD LOOKUPS ============

export async function getEnrichedOrder(id: string): Promise<EnrichedOrder | null> {
  const orders = await getEnrichedOrders();
  return orders.find(o => o.id === id) || null;
}

export async function getEnrichedOrderByNumber(orderNumber: number): Promise<EnrichedOrder | null> {
  const orders = await getEnrichedOrders();
  return orders.find(o => o.order_number === orderNumber) || null;
}
