import Airtable from 'airtable';

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PAT 
}).base(process.env.AIRTABLE_BASE_ID!);

// ============ TYPES ============

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
  first_event_room: string;
  second_event_room: string;
  status: string;
  event_notes: string;
  proof_file: any[];
  proof_status: string;
  created_at: string;
}

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
  main_contact_name: string;
  main_contact_email: string;
  main_contact_phone: string;
  usual_mailing_quantity: number;
  default_digital_budget: number;
}

export interface AirtableGroup {
  id: string;
  name: string;
  website: string;
  registration_phone: string;
  registration_url: string;
  responsibility: string;
}

export interface AirtableDigitalJob {
  id: string;
  order_number: number;
  status: string;
  advisor_name: string;
  group_name: string;
  first_event_date: string | null;
  second_event_date: string | null;
  location_name: string;
  location_address: string;
  start_time: string;
  end_time: string;
  class_type: string;
  qa_status: string;
  tp_status: string;
  landing_page_url: string;
  max_budget: number;
}

export interface AirtableDirectMailJob {
  id: string;
  order_number: number;
  status: string;
  advisor_name: string;
  group_name: string;
  first_event_date: string | null;
  second_event_date: string | null;
  market: string;
  office_location: string;
  charity: string;
  class_type: string;
  quantity: number;
  mailer_type: string;
  landing_page_url: string;
  venue_name: string;
  venue_address: string;
  start_time: string;
  end_time: string;
  proof_file: any[];
  proof_status: string;
}

// ============ FETCHERS ============

export async function getOrders(): Promise<AirtableOrder[]> {
  const records = await base('Orders').select({
    sort: [{ field: 'first_event_date', direction: 'asc' }],
  }).all();
  
  // Get linked group and advisor names
  const groupIds = new Set<string>();
  const advisorIds = new Set<string>();
  records.forEach(r => {
    const g = r.get('Group') as string[] || [];
    const a = r.get('Advisor_Link') as string[] || [];
    g.forEach(id => groupIds.add(id));
    a.forEach(id => advisorIds.add(id));
  });
  
  // Fetch linked records
  const groupMap = new Map<string, string>();
  const advisorMap = new Map<string, string>();
  
  if (groupIds.size > 0) {
    const groups = await base('Groups').select({
      filterByFormula: `OR(${[...groupIds].map(id => `RECORD_ID()='${id}'`).join(',')})`,
    }).all();
    groups.forEach(g => groupMap.set(g.id, g.get('Name') as string || ''));
  }
  
  if (advisorIds.size > 0) {
    const advisors = await base('Advisors').select({
      filterByFormula: `OR(${[...advisorIds].map(id => `RECORD_ID()='${id}'`).join(',')})`,
    }).all();
    advisors.forEach(a => advisorMap.set(a.id, a.get('advisor_name') as string || ''));
  }
  
  return records.map(r => ({
    id: r.id,
    order_number: r.get('order_number') as number || 0,
    advisor: r.get('advisor') as string || '',
    group_name: r.get('group_name') as string || '',
    first_event_date: r.get('first_event_date') as string || null,
    second_event_date: r.get('second_event_date') as string || null,
    third_event_date: r.get('third_event_date') as string || null,
    fourth_event_date: r.get('fourth_event_date') as string || null,
    needs_direct_mail: r.get('needs_direct_mail') as boolean || false,
    needs_digital: r.get('needs_digital') as boolean || false,
    market: r.get('market') as string || '',
    office_location: r.get('office_location') as string || '',
    class_type: r.get('class_type') as string || '',
    mailing_quantity: r.get('mailing_quantity') as number || 0,
    mailer_type: r.get('mailer_type') as string || '',
    digital_budget: r.get('digital_budget') as number || 0,
    landing_page_url: r.get('landing_page_url') as string || '',
    venue_name: r.get('venue_name') as string || '',
    venue_address: r.get('venue_address') as string || '',
    start_time: r.get('start_time') as string || '',
    end_time: r.get('end_time') as string || '',
    first_event_room: r.get('first_event_room') as string || '',
    second_event_room: r.get('second_event_room') as string || '',
    status: r.get('status') as string || 'pending',
    event_notes: r.get('event_notes') as string || '',
    proof_file: r.get('proof_file') as any[] || [],
    proof_status: r.get('proof_status') as string || '',
    created_at: r.get('created_at') as string || '',
  }));
}

export async function getOrder(id: string): Promise<AirtableOrder | null> {
  try {
    const r = await base('Orders').find(id);
    return {
      id: r.id,
      order_number: r.get('order_number') as number || 0,
      advisor: r.get('advisor') as string || '',
      group_name: r.get('group_name') as string || '',
      first_event_date: r.get('first_event_date') as string || null,
      second_event_date: r.get('second_event_date') as string || null,
      third_event_date: r.get('third_event_date') as string || null,
      fourth_event_date: r.get('fourth_event_date') as string || null,
      needs_direct_mail: r.get('needs_direct_mail') as boolean || false,
      needs_digital: r.get('needs_digital') as boolean || false,
      market: r.get('market') as string || '',
      office_location: r.get('office_location') as string || '',
      class_type: r.get('class_type') as string || '',
      mailing_quantity: r.get('mailing_quantity') as number || 0,
      mailer_type: r.get('mailer_type') as string || '',
      digital_budget: r.get('digital_budget') as number || 0,
      landing_page_url: r.get('landing_page_url') as string || '',
      venue_name: r.get('venue_name') as string || '',
      venue_address: r.get('venue_address') as string || '',
      start_time: r.get('start_time') as string || '',
      end_time: r.get('end_time') as string || '',
      first_event_room: r.get('first_event_room') as string || '',
      second_event_room: r.get('second_event_room') as string || '',
      status: r.get('status') as string || 'pending',
      event_notes: r.get('event_notes') as string || '',
      proof_file: r.get('proof_file') as any[] || [],
      proof_status: r.get('proof_status') as string || '',
      created_at: r.get('created_at') as string || '',
    };
  } catch {
    return null;
  }
}

export async function getAdvisors(): Promise<AirtableAdvisor[]> {
  const records = await base('Advisors').select({
    sort: [{ field: 'advisor_name', direction: 'asc' }],
  }).all();
  
  return records.map(r => ({
    id: r.id,
    advisor_name: r.get('advisor_name') as string || '',
    group_name: r.get('group_name') as string || '',
    business_name: r.get('business_name') as string || '',
    business_website: r.get('business_website') as string || '',
    business_address: r.get('business_address') as string || '',
    business_city: r.get('business_city') as string || '',
    business_state: r.get('business_state') as string || '',
    mailer_return_address: r.get('mailer_return_address') as string || '',
    registration_phone: r.get('registration_phone') as string || '',
    website_registration_direct: r.get('website_registration_direct') as string || '',
    main_contact_name: r.get('main_contact_name') as string || '',
    main_contact_email: r.get('main_contact_email') as string || '',
    main_contact_phone: r.get('main_contact_phone') as string || '',
    usual_mailing_quantity: r.get('usual_mailing_quantity') as number || 0,
    default_digital_budget: r.get('default_digital_budget') as number || 0,
  }));
}

export async function getGroups(): Promise<AirtableGroup[]> {
  const records = await base('Groups').select({
    sort: [{ field: 'Name', direction: 'asc' }],
  }).all();
  
  return records.map(r => ({
    id: r.id,
    name: r.get('Name') as string || '',
    website: r.get('Website') as string || '',
    registration_phone: r.get('Registration Phone') as string || '',
    registration_url: r.get('Registration URL') as string || '',
    responsibility: r.get('Responsibility') as string || '',
  }));
}

export async function getDigitalJobs(): Promise<AirtableDigitalJob[]> {
  const records = await base('Digital_Jobs').select({
    sort: [{ field: 'first_event_date', direction: 'asc' }],
  }).all();
  
  return records.map(r => ({
    id: r.id,
    order_number: r.get('order_number') as number || 0,
    status: r.get('status') as string || '',
    advisor_name: r.get('advisor_name') as string || '',
    group_name: r.get('group_name') as string || '',
    first_event_date: r.get('first_event_date') as string || null,
    second_event_date: r.get('second_event_date') as string || null,
    location_name: r.get('location_name') as string || '',
    location_address: r.get('location_address') as string || '',
    start_time: r.get('start_time') as string || '',
    end_time: r.get('end_time') as string || '',
    class_type: r.get('class_type') as string || '',
    qa_status: r.get('qa_status') as string || '',
    tp_status: r.get('tp_status') as string || '',
    landing_page_url: r.get('landing_page_url') as string || '',
    max_budget: r.get('max_budget') as number || 0,
  }));
}

export async function getDirectMailJobs(): Promise<AirtableDirectMailJob[]> {
  const records = await base('Direct_Mail_Jobs').select({
    sort: [{ field: 'First Event Date', direction: 'asc' }],
  }).all();
  
  return records.map(r => ({
    id: r.id,
    order_number: r.get('order_number') as number || 0,
    status: r.get('status') as string || '',
    advisor_name: r.get('Advisor Name') as string || '',
    group_name: r.get('Group Name') as string || '',
    first_event_date: r.get('First Event Date') as string || null,
    second_event_date: r.get('Second Event Date') as string || null,
    market: r.get('Market') as string || '',
    office_location: r.get('Office Location') as string || '',
    charity: r.get('Charity') as string || '',
    class_type: r.get('Class Type') as string || '',
    quantity: r.get('quantity') as number || 0,
    mailer_type: r.get('Mailer Type') as string || '',
    landing_page_url: r.get('Landing Page URL') as string || '',
    venue_name: r.get('Venue Name') as string || '',
    venue_address: r.get('Venue Address') as string || '',
    start_time: r.get('Start Time') as string || '',
    end_time: r.get('End Time') as string || '',
    proof_file: r.get('proof_file') as any[] || [],
    proof_status: r.get('proof_status') as string || '',
  }));
}

// ============ STATS ============

export async function getStats() {
  const orders = await getOrders();
  const advisors = await getAdvisors();
  const digitalJobs = await getDigitalJobs();
  const directMailJobs = await getDirectMailJobs();
  
  const now = new Date();
  const futureOrders = orders.filter(o => {
    if (!o.first_event_date) return false;
    return new Date(o.first_event_date) > now;
  });
  
  return {
    totalOrders: orders.length,
    totalAdvisors: advisors.length,
    futureOrders: futureOrders.length,
    digitalJobs: digitalJobs.length,
    directMailJobs: directMailJobs.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };
}
