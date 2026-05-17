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

// ============ TYPES ============

export interface AirtableAdvisor {
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
  orderCount?: number;
  activeOrderCount?: number;
}

export interface AirtableOrder {
  id: string;
  order_number: number;
  advisor: string;
  group_name: string;
  first_event_date: string | null;
  second_event_date: string | null;
  third_event_date: string | null;
  fourth_event_date: string | null;
  needs_direct_mail: boolean;
  needs_digital: boolean;
  market: string;
  office_location: string;
  class_type: string;
  mailing_quantity: number;
  mailer_type: string;
  digital_budget: number;
  landing_page_url: string;
  venue_name: string;
  venue_address: string;
  start_time: string;
  end_time: string;
  event_notes: string;
  first_event_room: string;
  second_event_room: string;
  third_event_room: string;
  fourth_event_room: string;
  status: string;
  overall_priority: string;
  order_summary: string;
  proof_status: string;
  proof_feedback: string;
  created_at: string;
  // Computed fields
  daysUntilEvent: number | null;
  isPast: boolean;
  isUrgent: boolean;
}

export interface AirtableGroup {
  id: string;
  name: string;
  website: string;
  registration_phone: string;
  registration_url: string;
  address: string;
  responsibility: string;
}

export interface AirtableRegion {
  id: string;
  name: string;
  state: string;
  default_quantity: number;
}

export interface AirtableCharity {
  id: string;
  name: string;
  short_name: string;
}

export interface AirtableVenue {
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
}

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

// ============ ADVISORS ============

export async function getAdvisors(): Promise<AirtableAdvisor[]> {
  const records = await tables.advisors.select({
    view: 'Grid view',
  }).all();
  
  return records.map(record => ({
    id: record.id,
    advisor_name: (record.get('advisor_name') as string) || '',
    group_name: (record.get('group_name') as string) || '',
    business_name: (record.get('business_name') as string) || '',
    business_website: (record.get('business_website') as string) || '',
    business_address: (record.get('business_address') as string) || '',
    business_city: (record.get('business_city') as string) || '',
    business_state: (record.get('business_state') as string) || '',
    mailer_return_address: (record.get('mailer_return_address') as string) || '',
    registration_phone: (record.get('registration_phone') as string) || '',
    website_registration_direct: (record.get('website_registration_direct') as string) || '',
    website_registration_digital: (record.get('website_registration_digital') as string) || '',
    main_contact_name: (record.get('main_contact_name') as string) || '',
    main_contact_email: (record.get('main_contact_email') as string) || '',
    main_contact_phone: (record.get('main_contact_phone') as string) || '',
    secondary_contact_name: (record.get('secondary_contact_name') as string) || '',
    secondary_contact_email: (record.get('secondary_contact_email') as string) || '',
    cc_emails: (record.get('cc_emails') as string) || '',
    usual_mailing_quantity: (record.get('usual_mailing_quantity') as number) || 0,
    default_digital_budget: (record.get('default_digital_budget') as number) || 0,
    direct_mailer_rate: (record.get('direct_mailer_rate') as number) || 0,
    order_instructions: (record.get('order_instructions') as string) || '',
    client_notes: (record.get('client_notes') as string) || '',
  }));
}

export async function getAdvisor(id: string): Promise<AirtableAdvisor | null> {
  try {
    const record = await tables.advisors.find(id);
    return {
      id: record.id,
      advisor_name: (record.get('advisor_name') as string) || '',
      group_name: (record.get('group_name') as string) || '',
      business_name: (record.get('business_name') as string) || '',
      business_website: (record.get('business_website') as string) || '',
      business_address: (record.get('business_address') as string) || '',
      business_city: (record.get('business_city') as string) || '',
      business_state: (record.get('business_state') as string) || '',
      mailer_return_address: (record.get('mailer_return_address') as string) || '',
      registration_phone: (record.get('registration_phone') as string) || '',
      website_registration_direct: (record.get('website_registration_direct') as string) || '',
      website_registration_digital: (record.get('website_registration_digital') as string) || '',
      main_contact_name: (record.get('main_contact_name') as string) || '',
      main_contact_email: (record.get('main_contact_email') as string) || '',
      main_contact_phone: (record.get('main_contact_phone') as string) || '',
      secondary_contact_name: (record.get('secondary_contact_name') as string) || '',
      secondary_contact_email: (record.get('secondary_contact_email') as string) || '',
      cc_emails: (record.get('cc_emails') as string) || '',
      usual_mailing_quantity: (record.get('usual_mailing_quantity') as number) || 0,
      default_digital_budget: (record.get('default_digital_budget') as number) || 0,
      direct_mailer_rate: (record.get('direct_mailer_rate') as number) || 0,
      order_instructions: (record.get('order_instructions') as string) || '',
      client_notes: (record.get('client_notes') as string) || '',
    };
  } catch {
    return null;
  }
}

// ============ ORDERS ============

export async function getOrders(): Promise<AirtableOrder[]> {
  const records = await tables.orders.select({
    view: 'Grid view',
  }).all();
  
  return records.map(record => {
    const firstEventDate = parseDate(record.get('first_event_date') as string);
    const daysUntilEventVal = daysUntil(firstEventDate);
    const isPast = daysUntilEventVal !== null && daysUntilEventVal < 0;
    const isUrgent = !isPast && daysUntilEventVal !== null && daysUntilEventVal <= 7;
    
    return {
      id: record.id,
      order_number: (record.get('order_number') as number) || 0,
      advisor: (record.get('advisor') as string) || '',
      group_name: (record.get('group_name') as string) || '',
      first_event_date: (record.get('first_event_date') as string) || null,
      second_event_date: (record.get('second_event_date') as string) || null,
      third_event_date: (record.get('third_event_date') as string) || null,
      fourth_event_date: (record.get('fourth_event_date') as string) || null,
      needs_direct_mail: (record.get('needs_direct_mail') as boolean) || false,
      needs_digital: (record.get('needs_digital') as boolean) || false,
      market: (record.get('market') as string) || '',
      office_location: (record.get('office_location') as string) || '',
      class_type: (record.get('class_type') as string) || '',
      mailing_quantity: (record.get('mailing_quantity') as number) || 0,
      mailer_type: (record.get('mailer_type') as string) || '',
      digital_budget: (record.get('digital_budget') as number) || 0,
      landing_page_url: (record.get('landing_page_url') as string) || '',
      venue_name: (record.get('venue_name') as string) || '',
      venue_address: (record.get('venue_address') as string) || '',
      start_time: (record.get('start_time') as string) || '',
      end_time: (record.get('end_time') as string) || '',
      event_notes: (record.get('event_notes') as string) || '',
      first_event_room: (record.get('first_event_room') as string) || '',
      second_event_room: (record.get('second_event_room') as string) || '',
      third_event_room: (record.get('third_event_room') as string) || '',
      fourth_event_room: (record.get('fourth_event_room') as string) || '',
      status: (record.get('status') as string) || 'pending',
      overall_priority: (record.get('overall_priority') as string) || '',
      order_summary: (record.get('order_summary') as string) || '',
      proof_status: (record.get('proof_status') as string) || '',
      proof_feedback: (record.get('proof_feedback') as string) || '',
      created_at: (record.get('created_at') as string) || '',
      daysUntilEvent: daysUntilEventVal,
      isPast,
      isUrgent,
    };
  });
}

export async function getOrder(id: string): Promise<AirtableOrder | null> {
  try {
    const record = await tables.orders.find(id);
    const firstEventDate = parseDate(record.get('first_event_date') as string);
    const daysUntilEventVal = daysUntil(firstEventDate);
    const isPast = daysUntilEventVal !== null && daysUntilEventVal < 0;
    const isUrgent = !isPast && daysUntilEventVal !== null && daysUntilEventVal <= 7;
    
    return {
      id: record.id,
      order_number: (record.get('order_number') as number) || 0,
      advisor: (record.get('advisor') as string) || '',
      group_name: (record.get('group_name') as string) || '',
      first_event_date: (record.get('first_event_date') as string) || null,
      second_event_date: (record.get('second_event_date') as string) || null,
      third_event_date: (record.get('third_event_date') as string) || null,
      fourth_event_date: (record.get('fourth_event_date') as string) || null,
      needs_direct_mail: (record.get('needs_direct_mail') as boolean) || false,
      needs_digital: (record.get('needs_digital') as boolean) || false,
      market: (record.get('market') as string) || '',
      office_location: (record.get('office_location') as string) || '',
      class_type: (record.get('class_type') as string) || '',
      mailing_quantity: (record.get('mailing_quantity') as number) || 0,
      mailer_type: (record.get('mailer_type') as string) || '',
      digital_budget: (record.get('digital_budget') as number) || 0,
      landing_page_url: (record.get('landing_page_url') as string) || '',
      venue_name: (record.get('venue_name') as string) || '',
      venue_address: (record.get('venue_address') as string) || '',
      start_time: (record.get('start_time') as string) || '',
      end_time: (record.get('end_time') as string) || '',
      event_notes: (record.get('event_notes') as string) || '',
      first_event_room: (record.get('first_event_room') as string) || '',
      second_event_room: (record.get('second_event_room') as string) || '',
      third_event_room: (record.get('third_event_room') as string) || '',
      fourth_event_room: (record.get('fourth_event_room') as string) || '',
      status: (record.get('status') as string) || 'pending',
      overall_priority: (record.get('overall_priority') as string) || '',
      order_summary: (record.get('order_summary') as string) || '',
      proof_status: (record.get('proof_status') as string) || '',
      proof_feedback: (record.get('proof_feedback') as string) || '',
      created_at: (record.get('created_at') as string) || '',
      daysUntilEvent: daysUntilEventVal,
      isPast,
      isUrgent,
    };
  } catch {
    return null;
  }
}

export async function getOrderByNumber(orderNumber: number): Promise<AirtableOrder | null> {
  const records = await tables.orders.select({
    filterByFormula: `{order_number} = ${orderNumber}`,
    maxRecords: 1,
  }).all();
  
  if (records.length === 0) return null;
  
  const record = records[0];
  const firstEventDate = parseDate(record.get('first_event_date') as string);
  const daysUntilEventVal = daysUntil(firstEventDate);
  const isPast = daysUntilEventVal !== null && daysUntilEventVal < 0;
  const isUrgent = !isPast && daysUntilEventVal !== null && daysUntilEventVal <= 7;
  
  return {
    id: record.id,
    order_number: (record.get('order_number') as number) || 0,
    advisor: (record.get('advisor') as string) || '',
    group_name: (record.get('group_name') as string) || '',
    first_event_date: (record.get('first_event_date') as string) || null,
    second_event_date: (record.get('second_event_date') as string) || null,
    third_event_date: (record.get('third_event_date') as string) || null,
    fourth_event_date: (record.get('fourth_event_date') as string) || null,
    needs_direct_mail: (record.get('needs_direct_mail') as boolean) || false,
    needs_digital: (record.get('needs_digital') as boolean) || false,
    market: (record.get('market') as string) || '',
    office_location: (record.get('office_location') as string) || '',
    class_type: (record.get('class_type') as string) || '',
    mailing_quantity: (record.get('mailing_quantity') as number) || 0,
    mailer_type: (record.get('mailer_type') as string) || '',
    digital_budget: (record.get('digital_budget') as number) || 0,
    landing_page_url: (record.get('landing_page_url') as string) || '',
    venue_name: (record.get('venue_name') as string) || '',
    venue_address: (record.get('venue_address') as string) || '',
    start_time: (record.get('start_time') as string) || '',
    end_time: (record.get('end_time') as string) || '',
    event_notes: (record.get('event_notes') as string) || '',
    first_event_room: (record.get('first_event_room') as string) || '',
    second_event_room: (record.get('second_event_room') as string) || '',
    third_event_room: (record.get('third_event_room') as string) || '',
    fourth_event_room: (record.get('fourth_event_room') as string) || '',
    status: (record.get('status') as string) || 'pending',
    overall_priority: (record.get('overall_priority') as string) || '',
    order_summary: (record.get('order_summary') as string) || '',
    proof_status: (record.get('proof_status') as string) || '',
    proof_feedback: (record.get('proof_feedback') as string) || '',
    created_at: (record.get('created_at') as string) || '',
    daysUntilEvent: daysUntilEventVal,
    isPast,
    isUrgent,
  };
}

export async function getOrdersForAdvisor(advisorName: string): Promise<AirtableOrder[]> {
  const records = await tables.orders.select({
    filterByFormula: `{advisor} = "${advisorName.replace(/"/g, '\\"')}"`,
  }).all();
  
  return records.map(record => {
    const firstEventDate = parseDate(record.get('first_event_date') as string);
    const daysUntilEventVal = daysUntil(firstEventDate);
    const isPast = daysUntilEventVal !== null && daysUntilEventVal < 0;
    const isUrgent = !isPast && daysUntilEventVal !== null && daysUntilEventVal <= 7;
    
    return {
      id: record.id,
      order_number: (record.get('order_number') as number) || 0,
      advisor: (record.get('advisor') as string) || '',
      group_name: (record.get('group_name') as string) || '',
      first_event_date: (record.get('first_event_date') as string) || null,
      second_event_date: (record.get('second_event_date') as string) || null,
      third_event_date: (record.get('third_event_date') as string) || null,
      fourth_event_date: (record.get('fourth_event_date') as string) || null,
      needs_direct_mail: (record.get('needs_direct_mail') as boolean) || false,
      needs_digital: (record.get('needs_digital') as boolean) || false,
      market: (record.get('market') as string) || '',
      office_location: (record.get('office_location') as string) || '',
      class_type: (record.get('class_type') as string) || '',
      mailing_quantity: (record.get('mailing_quantity') as number) || 0,
      mailer_type: (record.get('mailer_type') as string) || '',
      digital_budget: (record.get('digital_budget') as number) || 0,
      landing_page_url: (record.get('landing_page_url') as string) || '',
      venue_name: (record.get('venue_name') as string) || '',
      venue_address: (record.get('venue_address') as string) || '',
      start_time: (record.get('start_time') as string) || '',
      end_time: (record.get('end_time') as string) || '',
      event_notes: (record.get('event_notes') as string) || '',
      first_event_room: (record.get('first_event_room') as string) || '',
      second_event_room: (record.get('second_event_room') as string) || '',
      third_event_room: (record.get('third_event_room') as string) || '',
      fourth_event_room: (record.get('fourth_event_room') as string) || '',
      status: (record.get('status') as string) || 'pending',
      overall_priority: (record.get('overall_priority') as string) || '',
      order_summary: (record.get('order_summary') as string) || '',
      proof_status: (record.get('proof_status') as string) || '',
      proof_feedback: (record.get('proof_feedback') as string) || '',
      created_at: (record.get('created_at') as string) || '',
      daysUntilEvent: daysUntilEventVal,
      isPast,
      isUrgent,
    };
  });
}

// ============ GROUPS ============

export async function getGroups(): Promise<AirtableGroup[]> {
  const records = await tables.groups.select({
    view: 'Grid view',
  }).all();
  
  return records.map(record => ({
    id: record.id,
    name: (record.get('Name') as string) || '',
    website: (record.get('Website') as string) || '',
    registration_phone: (record.get('Registration Phone') as string) || '',
    registration_url: (record.get('Registration URL') as string) || '',
    address: (record.get('Address') as string) || '',
    responsibility: (record.get('Responsibility') as string) || '',
  }));
}

// ============ REGIONS ============

export async function getRegions(): Promise<AirtableRegion[]> {
  const records = await tables.regions.select({
    view: 'Grid view',
  }).all();
  
  return records.map(record => ({
    id: record.id,
    name: (record.get('Name') as string) || '',
    state: (record.get('State') as string) || '',
    default_quantity: (record.get('Default Quantity') as number) || 0,
  }));
}

// ============ CHARITIES ============

export async function getCharities(): Promise<AirtableCharity[]> {
  const records = await tables.charities.select({
    view: 'Grid view',
  }).all();
  
  return records.map(record => ({
    id: record.id,
    name: (record.get('Name') as string) || '',
    short_name: (record.get('Short Name') as string) || '',
  }));
}

// ============ VENUES ============

export async function getVenues(): Promise<AirtableVenue[]> {
  const records = await tables.venues.select({
    view: 'Grid view',
  }).all();
  
  return records.map(record => ({
    id: record.id,
    name: (record.get('Name') as string) || '',
    full_name: (record.get('Full Name') as string) || '',
    address: (record.get('Address') as string) || '',
    city: (record.get('City') as string) || '',
    state: (record.get('State') as string) || '',
    zip: (record.get('Zip') as string) || '',
    default_room: (record.get('Default Room') as string) || '',
    capacity: (record.get('Capacity') as number) || 0,
    parking_notes: (record.get('Parking Notes') as string) || '',
  }));
}

// ============ STATS ============

export async function getOrderStats() {
  const orders = await getOrders();
  
  const activeOrders = orders.filter(o => !o.isPast && o.status !== 'completed' && o.status !== 'cancelled');
  const pastOrders = orders.filter(o => o.isPast || o.status === 'completed');
  const urgentOrders = orders.filter(o => o.isUrgent);
  
  // Count by status
  const byStatus: Record<string, number> = {};
  orders.forEach(o => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });
  
  // Count by group
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
  
  // Count advisors
  const advisors = await getAdvisors();
  
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
  const [orders, charities, venues, regions] = await Promise.all([
    getOrders(),
    getCharities(),
    getVenues(),
    getRegions(),
  ]);
  
  return {
    venues: venues.map(v => v.name).filter(Boolean),
    charities: charities.map(c => c.name).filter(Boolean),
    classTypes: [...new Set(orders.map(o => o.class_type).filter(Boolean))].sort(),
    groups: [...new Set(orders.map(o => o.group_name).filter(Boolean))].sort(),
    regions: regions.map(r => r.name).filter(Boolean),
  };
}
