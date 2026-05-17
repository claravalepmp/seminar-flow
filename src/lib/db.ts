// Local storage "database" - swap for Supabase/Airtable later
// Proper PMP data model with groups, regions, charities

import type { Advisor, Order, OrderStatus } from '@/types';

const STORAGE_KEYS = {
  advisorGroups: 'pmp_advisor_groups',
  advisors: 'pmp_advisors',
  regions: 'pmp_regions',
  charities: 'pmp_charities',
  orders: 'pmp_orders',
  initialized: 'pmp_db_v2',
};

// ============ TYPES ============

export interface AdvisorGroup {
  group_id: string;
  name: string;
  registration_phone: string;
  registration_url: string;
  region_ids: string[];  // Which regions this group can use
  created_at: string;
}

export interface Region {
  region_id: string;
  name: string;
  state?: string;
  charity_ids: string[];
  created_at: string;
}

export interface Charity {
  charity_id: string;
  name: string;
  region_id: string;  // Primary region
  created_at: string;
}

// PMP Class Types
export const CLASS_TYPES = [
  { value: 'R90', label: 'R90 - Retirement 90' },
  { value: 'R101', label: 'R101 - Retirement 101' },
  { value: 'SS101', label: 'SS101 - Social Security 101' },
  { value: 'W101', label: 'W101 - Women & Wealth 101' },
  { value: 'TAX', label: 'TAX - Tax Planning' },
  { value: 'ESTATE', label: 'ESTATE - Estate Planning' },
  { value: 'CUSTOM', label: 'CUSTOM - Custom Workshop' },
];

// Mail piece types
export const MAIL_PIECES = [
  { value: 'postcard_standard', label: 'Standard Postcard' },
  { value: 'postcard_jumbo', label: 'Jumbo Postcard' },
  { value: 'letter_standard', label: 'Standard Letter' },
  { value: 'letter_personalized', label: 'Personalized Letter' },
  { value: 'tbd', label: 'TBD - Decide Later' },
];

// ============ SEED DATA ============

const SAMPLE_CHARITIES: Charity[] = [
  // FTA Dallas
  { charity_id: 'chr_ntfb', name: 'North Texas Food Bank', region_id: 'reg_dallas', created_at: '2024-01-01T00:00:00Z' },
  // FTA Chicago - Rolling Meadows
  { charity_id: 'chr_schaumburg', name: 'Township of Schaumburg', region_id: 'reg_chicago_rm', created_at: '2024-01-01T00:00:00Z' },
  // FTA Chicago - Oak Brook
  { charity_id: 'chr_hcs', name: 'HCS Family Services', region_id: 'reg_chicago_ob', created_at: '2024-01-01T00:00:00Z' },
  // FTA St. Louis
  { charity_id: 'chr_crisis', name: 'Crisis Nursery', region_id: 'reg_stlouis', created_at: '2024-01-01T00:00:00Z' },
  { charity_id: 'chr_glened', name: 'Glen-Ed Pantry', region_id: 'reg_stlouis', created_at: '2024-01-01T00:00:00Z' },
  // SAM RIA regions
  { charity_id: 'chr_ct_food', name: 'Connecticut Food Bank', region_id: 'reg_connecticut', created_at: '2024-01-01T00:00:00Z' },
  { charity_id: 'chr_md_food', name: 'Maryland Food Bank', region_id: 'reg_maryland', created_at: '2024-01-01T00:00:00Z' },
  { charity_id: 'chr_pa_food', name: 'Greater Pittsburgh Food Bank', region_id: 'reg_pennsylvania', created_at: '2024-01-01T00:00:00Z' },
  // Other
  { charity_id: 'chr_mi_food', name: 'Food Bank of Eastern Michigan', region_id: 'reg_michigan', created_at: '2024-01-01T00:00:00Z' },
  { charity_id: 'chr_fl_food', name: 'Feeding Florida', region_id: 'reg_florida', created_at: '2024-01-01T00:00:00Z' },
];

const SAMPLE_REGIONS: Region[] = [
  // FTA Regions
  { region_id: 'reg_dallas', name: 'Dallas / Plano', state: 'TX', charity_ids: ['chr_ntfb'], created_at: '2024-01-01T00:00:00Z' },
  { region_id: 'reg_chicago_rm', name: 'Chicago - Rolling Meadows', state: 'IL', charity_ids: ['chr_schaumburg'], created_at: '2024-01-01T00:00:00Z' },
  { region_id: 'reg_chicago_ob', name: 'Chicago - Oak Brook', state: 'IL', charity_ids: ['chr_hcs'], created_at: '2024-01-01T00:00:00Z' },
  { region_id: 'reg_stlouis', name: 'St. Louis', state: 'MO', charity_ids: ['chr_crisis', 'chr_glened'], created_at: '2024-01-01T00:00:00Z' },
  // SAM RIA Regions
  { region_id: 'reg_connecticut', name: 'Connecticut', state: 'CT', charity_ids: ['chr_ct_food'], created_at: '2024-01-01T00:00:00Z' },
  { region_id: 'reg_maryland', name: 'Maryland', state: 'MD', charity_ids: ['chr_md_food'], created_at: '2024-01-01T00:00:00Z' },
  { region_id: 'reg_pennsylvania', name: 'Pennsylvania', state: 'PA', charity_ids: ['chr_pa_food'], created_at: '2024-01-01T00:00:00Z' },
  // Other regions
  { region_id: 'reg_michigan', name: 'Michigan', state: 'MI', charity_ids: ['chr_mi_food'], created_at: '2024-01-01T00:00:00Z' },
  { region_id: 'reg_florida', name: 'Florida', state: 'FL', charity_ids: ['chr_fl_food'], created_at: '2024-01-01T00:00:00Z' },
];

const SAMPLE_ADVISOR_GROUPS: AdvisorGroup[] = [
  {
    group_id: 'grp_fta',
    name: 'FTA (Financial Tax Advisors)',
    registration_phone: '(800) 555-1234',
    registration_url: 'https://register.ftadvisors.com',
    region_ids: ['reg_dallas', 'reg_chicago_rm', 'reg_chicago_ob', 'reg_stlouis'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    group_id: 'grp_sam',
    name: 'SAM RIA (Sentinel Asset Management)',
    registration_phone: '(800) 555-2345',
    registration_url: 'https://register.samria.com',
    region_ids: ['reg_connecticut', 'reg_maryland', 'reg_pennsylvania'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    group_id: 'grp_lawrence',
    name: 'Lawrence Retirement Group',
    registration_phone: '(214) 555-3456',
    registration_url: 'https://lawrenceretirement.com/register',
    region_ids: ['reg_dallas'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    group_id: 'grp_otoole',
    name: "O'Toole Financial Group",
    registration_phone: '(305) 555-4567',
    registration_url: 'https://otoolefinancial.com/seminars',
    region_ids: ['reg_florida'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    group_id: 'grp_bone',
    name: 'Bone Asset Management',
    registration_phone: '(313) 555-5678',
    registration_url: 'https://boneasset.com/events',
    region_ids: ['reg_michigan'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    group_id: 'grp_demo',
    name: 'Demo Group',
    registration_phone: '(555) 555-0000',
    registration_url: 'https://demo.powermailers.com/register',
    region_ids: ['reg_dallas', 'reg_connecticut', 'reg_florida'],
    created_at: '2024-01-01T00:00:00Z',
  },
];

const SAMPLE_ADVISORS: Advisor[] = [
  // FTA - Financial Tax Advisors (Dallas, Chicago, St. Louis)
  {
    advisor_id: 'adv_fta_dallas',
    advisor_name: 'FTA Dallas',
    company_name: 'Financial Tax Advisors',
    email: 'dallas@ftadvisors.com',
    phone: '(214) 555-0100',
    group_id: 'grp_fta',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    advisor_id: 'adv_fta_chicago',
    advisor_name: 'FTA Chicago',
    company_name: 'Financial Tax Advisors',
    email: 'chicago@ftadvisors.com',
    phone: '(312) 555-0100',
    group_id: 'grp_fta',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    advisor_id: 'adv_fta_stlouis',
    advisor_name: 'FTA St. Louis',
    company_name: 'Financial Tax Advisors',
    email: 'stlouis@ftadvisors.com',
    phone: '(314) 555-0100',
    group_id: 'grp_fta',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  // SAM RIA - Will Warner
  {
    advisor_id: 'adv_sam_will',
    advisor_name: 'Will Warner',
    company_name: 'Sentinel Asset Management',
    email: 'will@samria.com',
    phone: '(203) 555-0200',
    group_id: 'grp_sam',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  // Lawrence Retirement Group - J. Lawrence (Dallas area)
  {
    advisor_id: 'adv_lawrence',
    advisor_name: 'J. Lawrence',
    company_name: 'Lawrence Retirement Group',
    email: 'jlawrence8311@gmail.com',
    phone: '(214) 555-0300',
    group_id: 'grp_lawrence',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  // O'Toole Financial - Sean O'Toole (Florida)
  {
    advisor_id: 'adv_otoole',
    advisor_name: 'Sean O\'Toole',
    company_name: 'O\'Toole Financial Group',
    email: 'sean@otoolefinancial.com',
    phone: '(305) 555-0400',
    group_id: 'grp_otoole',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  // Bone Asset - Rick Bone (Michigan)
  {
    advisor_id: 'adv_bone_rick',
    advisor_name: 'Rick Bone',
    company_name: 'Bone Asset Management',
    email: 'rick@boneasset.com',
    phone: '(313) 555-0500',
    group_id: 'grp_bone',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  // Demo
  {
    advisor_id: 'demo',
    advisor_name: 'Demo User',
    company_name: 'Demo Financial Group',
    email: 'demo@powermailers.com',
    phone: '(555) 555-0000',
    group_id: 'grp_demo',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const SAMPLE_ORDERS: Order[] = [
  {
    order_id: 'ord_2601',
    order_number: 2601,
    advisor_id: 'adv_lawrence',
    event_type: 'R90',
    region_id: 'reg_dallas',
    charity_id: 'chr_ntfb',
    first_event_date: '2026-06-15',
    first_event_time: '18:30',
    first_event_end_time: '20:00',
    second_event_date: '2026-06-17',
    second_event_time: '18:30',
    second_event_end_time: '20:00',
    venue_name: 'Hilton Garden Inn - Conference Room A',
    address: '1234 Main Street, Dallas, TX 75201',
    mail_piece: 'postcard_standard',
    mailing_quantity: 8000,
    digital_budget: '1500',
    status: 'in_design',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
  },
  {
    order_id: 'ord_2602',
    order_number: 2602,
    advisor_id: 'adv_fta_rick',
    event_type: 'SS101',
    region_id: 'reg_dallas',
    charity_id: 'chr_ntfb',
    first_event_date: '2026-07-10',
    first_event_time: '10:00',
    first_event_end_time: '11:30',
    second_event_date: '2026-07-12',
    second_event_time: '10:00',
    second_event_end_time: '11:30',
    venue_name: 'Dallas College Richland - Room 204',
    address: '12800 Abrams Rd, Dallas, TX 75243',
    mail_piece: 'tbd',
    mailing_quantity: 10000,
    digital_budget: '2000',
    status: 'pending_orders',
    created_at: '2026-05-05T00:00:00Z',
    updated_at: '2026-05-05T00:00:00Z',
  },
  {
    order_id: 'ord_2603',
    order_number: 2603,
    advisor_id: 'adv_sam_will',
    event_type: 'W101',
    region_id: 'reg_connecticut',
    charity_id: 'chr_ct_food',
    first_event_date: '2026-09-20',
    first_event_time: '14:00',
    first_event_end_time: '15:30',
    venue_name: 'Stamford Public Library - Community Room',
    address: '63 Tresser Blvd, Stamford, CT 06901',
    mail_piece: 'letter_personalized',
    mailing_quantity: 9000,
    digital_budget: '1800',
    status: 'approval_requested',
    proof_url: 'https://drive.google.com/file/d/example/view',
    created_at: '2026-04-15T00:00:00Z',
    updated_at: '2026-05-12T00:00:00Z',
  },
];

// ============ INIT ============

export function initDB() {
  if (typeof window === 'undefined') return;
  
  const initialized = localStorage.getItem(STORAGE_KEYS.initialized);
  if (initialized) return;
  
  localStorage.setItem(STORAGE_KEYS.charities, JSON.stringify(SAMPLE_CHARITIES));
  localStorage.setItem(STORAGE_KEYS.regions, JSON.stringify(SAMPLE_REGIONS));
  localStorage.setItem(STORAGE_KEYS.advisorGroups, JSON.stringify(SAMPLE_ADVISOR_GROUPS));
  localStorage.setItem(STORAGE_KEYS.advisors, JSON.stringify(SAMPLE_ADVISORS));
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(SAMPLE_ORDERS));
  localStorage.setItem(STORAGE_KEYS.initialized, 'true');
}

export function resetDB() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.initialized);
  localStorage.removeItem(STORAGE_KEYS.charities);
  localStorage.removeItem(STORAGE_KEYS.regions);
  localStorage.removeItem(STORAGE_KEYS.advisorGroups);
  localStorage.removeItem(STORAGE_KEYS.advisors);
  localStorage.removeItem(STORAGE_KEYS.orders);
  initDB();
}

// ============ CHARITIES ============

export function getCharities(): Charity[] {
  if (typeof window === 'undefined') return [];
  initDB();
  const data = localStorage.getItem(STORAGE_KEYS.charities);
  return data ? JSON.parse(data) : [];
}

export function getCharitiesByRegion(regionId: string): Charity[] {
  return getCharities().filter(c => c.region_id === regionId);
}

export function getCharity(id: string): Charity | null {
  return getCharities().find(c => c.charity_id === id) || null;
}

// ============ REGIONS ============

export function getRegions(): Region[] {
  if (typeof window === 'undefined') return [];
  initDB();
  const data = localStorage.getItem(STORAGE_KEYS.regions);
  return data ? JSON.parse(data) : [];
}

export function getRegion(id: string): Region | null {
  return getRegions().find(r => r.region_id === id) || null;
}

export function getRegionsByIds(ids: string[]): Region[] {
  const regions = getRegions();
  return regions.filter(r => ids.includes(r.region_id));
}

// ============ ADVISOR GROUPS ============

export function getAdvisorGroups(): AdvisorGroup[] {
  if (typeof window === 'undefined') return [];
  initDB();
  const data = localStorage.getItem(STORAGE_KEYS.advisorGroups);
  return data ? JSON.parse(data) : [];
}

export function getAdvisorGroup(id: string): AdvisorGroup | null {
  return getAdvisorGroups().find(g => g.group_id === id) || null;
}

// ============ ADVISORS ============

export function getAdvisors(): Advisor[] {
  if (typeof window === 'undefined') return [];
  initDB();
  const data = localStorage.getItem(STORAGE_KEYS.advisors);
  return data ? JSON.parse(data) : [];
}

export function getAdvisor(id: string): Advisor | null {
  const advisors = getAdvisors();
  return advisors.find(a => a.advisor_id === id || a.email === id) || null;
}

export function getAdvisorByEmail(email: string): Advisor | null {
  const advisors = getAdvisors();
  return advisors.find(a => a.email.toLowerCase() === email.toLowerCase()) || null;
}

export function getAdvisorWithGroup(advisorId: string): (Advisor & { group?: AdvisorGroup }) | null {
  const advisor = getAdvisor(advisorId);
  if (!advisor) return null;
  const group = advisor.group_id ? getAdvisorGroup(advisor.group_id) ?? undefined : undefined;
  return { ...advisor, group };
}

export function getRegionsForAdvisor(advisorId: string): Region[] {
  const advisor = getAdvisor(advisorId);
  if (!advisor?.group_id) return [];
  const group = getAdvisorGroup(advisor.group_id);
  if (!group) return [];
  return getRegionsByIds(group.region_ids);
}

// ============ ORDERS ============

export function getOrders(): Order[] {
  if (typeof window === 'undefined') return [];
  initDB();
  const data = localStorage.getItem(STORAGE_KEYS.orders);
  return data ? JSON.parse(data) : [];
}

export function getOrder(id: string): Order | null {
  const orders = getOrders();
  return orders.find(o => o.order_id === id) || null;
}

export function getOrdersByAdvisor(advisorId: string): Order[] {
  const orders = getOrders();
  return orders.filter(o => o.advisor_id === advisorId);
}

export function createOrder(order: Partial<Order> & { advisor_id: string }): Order {
  const orders = getOrders();
  const maxNumber = orders.reduce((max, o) => Math.max(max, o.order_number || 0), 2600);
  
  const newOrder: Order = {
    order_id: `ord_${Date.now()}`,
    order_number: maxNumber + 1,
    advisor_id: order.advisor_id,
    event_type: order.event_type || '',
    region_id: order.region_id,
    charity_id: order.charity_id,
    first_event_date: order.first_event_date || '',
    first_event_time: order.first_event_time,
    first_event_end_time: order.first_event_end_time,
    second_event_date: order.second_event_date,
    second_event_time: order.second_event_time,
    second_event_end_time: order.second_event_end_time,
    venue_name: order.venue_name,
    address: order.address,
    mail_piece: order.mail_piece || 'tbd',
    mailing_quantity: order.mailing_quantity || 8000,
    digital_budget: order.digital_budget,
    status: 'pending_orders' as OrderStatus,
    client_notes: order.client_notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  orders.push(newOrder);
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
  return newOrder;
}

export function updateOrder(id: string, updates: Partial<Order>): Order | null {
  const orders = getOrders();
  const index = orders.findIndex(o => o.order_id === id);
  if (index === -1) return null;
  
  orders[index] = {
    ...orders[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
  return orders[index];
}

// ============ STATS ============

export function getStats() {
  const orders = getOrders();
  const advisors = getAdvisors();
  
  return {
    totalOrders: orders.length,
    totalAdvisors: advisors.length,
    pendingOrders: orders.filter(o => o.status === 'pending_orders').length,
    inDesign: orders.filter(o => o.status === 'in_design').length,
    needsApproval: orders.filter(o => o.status === 'approval_requested').length,
    approved: orders.filter(o => o.status === 'approved').length,
    campaignRunning: orders.filter(o => o.status === 'campaign_running').length,
    complete: orders.filter(o => o.status === 'complete').length,
  };
}
