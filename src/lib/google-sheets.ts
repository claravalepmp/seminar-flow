import { google } from 'googleapis';

// Sheet IDs
const DIRECT_MAILING_SHEET_ID = '1TO7awD6tA2UdgWTl1cr5ec9C0nl56huBmFLL_mgateg';
const MAIN_ORDER_SHEET_ID = '1psPEGyNVpbQiWWtZgpMLU2GhE2AngjnEfBbrwV3ruWs';

// Sheet names
const DIRECT_MAILING_SHEET_NAME = 'Main Orders - ONLY ONE USED';
const MAIN_ORDER_SHEET_NAME = 'Direct Mail - Cam';

// Status categories for UI filtering
const STATUS_CATEGORIES: Record<string, string> = {
  'Not Started': 'pending',
  'Pending Details': 'pending',
  'All Details Added': 'ready',
  'Order Completed': 'completed',
  'Order Canceled': 'canceled',
  'Issues': 'issues',
};

export interface Order {
  id: string;
  orderNumber: number;
  status: string;
  statusCategory: string;
  advisor: string;
  groupName: string;
  officeLocation: string;
  market: string;
  // Event dates
  firstEventDate: string | null;
  secondEventDate: string | null;
  thirdEventDate: string | null;
  fourthEventDate: string | null;
  // Venue
  venueName: string;
  venueAddress: string;
  firstEventRoom: string;
  secondEventRoom: string;
  // Timing
  startTime: string;
  endTime: string;
  // Content
  charity: string;
  classType: string;
  notes: string;
  // Mail details
  mailingQuantity: number;
  mailerType: string;
  // URLs & Contact
  landingPageUrl: string;
  registrationPhone: string;
  // Deadlines from Main Order sheet
  clientApprovalDeadline: string | null;
  orderSentDeadline: string | null;
  // Job flags
  needsDirectMail: boolean;
  needsDigital: boolean;
  digitalBudget: number;
  // Computed
  daysUntilEvent: number | null;
  daysUntilDeadline: number | null;
  isPast: boolean;
  isUrgent: boolean;
}

// Get Google Sheets auth
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// Parse date string to Date object
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const cleaned = dateStr.trim();
  if (!cleaned) return null;
  
  // Try parsing directly
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;
  
  return null;
}

// Calculate days between now and a date
function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Parse boolean from sheet value
function parseBool(val: string | undefined | null): boolean {
  if (!val) return false;
  const v = val.toString().toUpperCase().trim();
  return v === 'TRUE' || v === 'YES' || v === '1';
}

// Parse number from sheet value
function parseNum(val: string | undefined | null): number {
  if (!val) return 0;
  const cleaned = val.toString().replace(/[^0-9.-]/g, '');
  return parseInt(cleaned, 10) || 0;
}

// Fetch deadlines and phone numbers from Main Order sheet
async function fetchMainOrderData(): Promise<Map<number, { clientApproval: string | null; orderSent: string | null; phone: string | null }>> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: MAIN_ORDER_SHEET_ID,
    range: MAIN_ORDER_SHEET_NAME,
  });
  
  const rows = response.data.values || [];
  const map = new Map<number, { clientApproval: string | null; orderSent: string | null; phone: string | null }>();
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const orderNum = parseNum(row[1]); // Column B: Order Number
    if (orderNum > 0) {
      map.set(orderNum, {
        clientApproval: row[5]?.trim() || null,  // Column F: Client Approval Deadline
        orderSent: row[6]?.trim() || null,       // Column G: Order Sent Deadline
        phone: row[18]?.trim() || null,          // Column S: Registration Phone Number
      });
    }
  }
  
  return map;
}

// Fetch all orders from Direct Mailing sheet
export async function getOrdersWithDeadlines(): Promise<Order[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Fetch both sheets in parallel
  const [dmResponse, mainOrderData] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: DIRECT_MAILING_SHEET_ID,
      range: DIRECT_MAILING_SHEET_NAME,
    }),
    fetchMainOrderData(),
  ]);
  
  const rows = dmResponse.data.values || [];
  const orders: Order[] = [];
  
  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    // Column indices (0-based):
    // A(0): Status, B(1): Added to Sheets, C(2): Order Number, D(3): Responsibility
    // E(4): Advisor Name, F(5): Group Name, G(6): First Event Date
    // H(7): Needs Direct Mail, I(8): Needs Digital, J(9): Needs Google Sheet
    // K(10): Market, L(11): Office Location, M(12): Charity, N(13): Class Type
    // O(14): Mailing Quantity, P(15): Mailer Type, Q(16): Mailer Return Address
    // R(17): Digital Budget, S(18): Landing Page URL (Direct), T(19): Landing Page URL (Digital)
    // U(20): Venue Name & Room, V(21): Venue Address, W(22): Start Time, X(23): End Time
    // Y(24): Notes, Z(25): First Event date (dup), AA(26): First Event Room
    // AB(27): Second Event Date, AC(28): Second Event Room
    // AD(29): Third Event date, AE(30): Third Event Room
    // AF(31): Fourth Event date, AG(32): Fourth Event Room
    
    const orderNumber = parseNum(row[2]);
    if (orderNumber <= 0) continue; // Skip rows without order number
    
    const status = (row[0] || '').trim();
    // Skip empty status or weird combined statuses (clean data only)
    const validStatuses = ['Not Started', 'Pending Details', 'All Details Added', 'Order Completed', 'Order Canceled', 'Issues'];
    const primaryStatus = validStatuses.find(s => status.includes(s)) || 'Not Started';
    const statusCategory = STATUS_CATEGORIES[primaryStatus] || 'pending';
    
    // Parse event dates
    const firstEventDate = parseDate(row[6]);
    const secondEventDate = parseDate(row[27]);
    const thirdEventDate = parseDate(row[29]);
    const fourthEventDate = parseDate(row[31]);
    
    // Get earliest upcoming event date
    const eventDates = [firstEventDate, secondEventDate, thirdEventDate, fourthEventDate].filter(Boolean) as Date[];
    const nextEvent = eventDates.length > 0 ? eventDates.reduce((a, b) => a < b ? a : b) : null;
    const daysUntilEventVal = daysUntil(nextEvent);
    
    // Get deadline info from Main Order sheet
    const deadlineInfo = mainOrderData.get(orderNumber);
    const clientApprovalDeadline = deadlineInfo?.clientApproval || null;
    const orderSentDeadline = deadlineInfo?.orderSent || null;
    const registrationPhone = deadlineInfo?.phone || '';
    
    // Parse approval deadline for urgency calculation
    const approvalDate = parseDate(clientApprovalDeadline);
    const daysUntilDeadlineVal = daysUntil(approvalDate);
    
    // Determine if past or urgent
    const isPast = daysUntilEventVal !== null && daysUntilEventVal < 0;
    const isUrgent = !isPast && daysUntilEventVal !== null && daysUntilEventVal <= 7;
    
    orders.push({
      id: `dm-${orderNumber}`,
      orderNumber,
      status: primaryStatus,
      statusCategory,
      advisor: (row[4] || '').trim(),
      groupName: (row[5] || '').trim(),
      officeLocation: (row[11] || '').trim(),
      market: (row[10] || '').trim(),
      firstEventDate: row[6]?.trim() || null,
      secondEventDate: row[27]?.trim() || null,
      thirdEventDate: row[29]?.trim() || null,
      fourthEventDate: row[31]?.trim() || null,
      venueName: (row[20] || '').trim(),
      venueAddress: (row[21] || '').trim(),
      firstEventRoom: (row[26] || '').trim(),
      secondEventRoom: (row[28] || '').trim(),
      startTime: (row[22] || '').trim(),
      endTime: (row[23] || '').trim(),
      charity: (row[12] || '').trim(),
      classType: (row[13] || '').trim(),
      notes: (row[24] || '').trim(),
      mailingQuantity: parseNum(row[14]),
      mailerType: (row[15] || '').trim(),
      landingPageUrl: (row[18] || row[19] || '').trim(),
      registrationPhone,
      clientApprovalDeadline,
      orderSentDeadline,
      needsDirectMail: parseBool(row[7]),
      needsDigital: parseBool(row[8]),
      digitalBudget: parseNum(row[17]),
      daysUntilEvent: daysUntilEventVal,
      daysUntilDeadline: daysUntilDeadlineVal,
      isPast,
      isUrgent,
    });
  }
  
  // Sort: urgent first, then by days until event
  orders.sort((a, b) => {
    // Canceled/completed go to end
    if (a.statusCategory === 'canceled' && b.statusCategory !== 'canceled') return 1;
    if (b.statusCategory === 'canceled' && a.statusCategory !== 'canceled') return -1;
    if (a.statusCategory === 'completed' && b.statusCategory !== 'completed') return 1;
    if (b.statusCategory === 'completed' && a.statusCategory !== 'completed') return -1;
    
    // Past events go after upcoming
    if (a.isPast && !b.isPast) return 1;
    if (!a.isPast && b.isPast) return -1;
    
    // Urgent first
    if (a.isUrgent && !b.isUrgent) return -1;
    if (!a.isUrgent && b.isUrgent) return 1;
    
    // Then by days until event
    const aDays = a.daysUntilEvent ?? 999;
    const bDays = b.daysUntilEvent ?? 999;
    return aDays - bDays;
  });
  
  return orders;
}

// Calculate stats from orders
export function getOrderStats(orders: Order[]) {
  const now = new Date();
  
  const activeOrders = orders.filter(o => 
    !o.isPast && 
    o.statusCategory !== 'completed' && 
    o.statusCategory !== 'canceled'
  );
  
  const pastOrders = orders.filter(o => 
    o.isPast || o.statusCategory === 'completed'
  );
  
  const urgentOrders = orders.filter(o => o.isUrgent);
  
  // Count by status
  const byStatus: Record<string, number> = {};
  orders.forEach(o => {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  });
  
  // Count by group
  const groupStats: Record<string, { active: number; past: number; urgent: number; totalMail: number }> = {};
  orders.forEach(o => {
    const group = o.groupName || 'Unknown';
    if (!groupStats[group]) {
      groupStats[group] = { active: 0, past: 0, urgent: 0, totalMail: 0 };
    }
    if (!o.isPast && o.statusCategory !== 'completed' && o.statusCategory !== 'canceled') {
      groupStats[group].active++;
    }
    if (o.isPast || o.statusCategory === 'completed') {
      groupStats[group].past++;
    }
    if (o.isUrgent) {
      groupStats[group].urgent++;
    }
    groupStats[group].totalMail += o.mailingQuantity;
  });
  
  const byGroup = Object.entries(groupStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.active - a.active);
  
  // Total mail pieces
  const totalMailPieces = orders.reduce((sum, o) => sum + o.mailingQuantity, 0);
  
  // Unique groups
  const groups = [...new Set(orders.map(o => o.groupName).filter(Boolean))].sort();
  
  return {
    totalOrders: orders.length,
    activeOrders: activeOrders.length,
    pastOrders: pastOrders.length,
    urgentOrders: urgentOrders.length,
    totalMailPieces,
    byStatus,
    byGroup,
    groups,
  };
}

// Filter orders for client view
export function filterOrdersForClient(
  orders: Order[], 
  group?: string,
  view: 'active' | 'past' = 'active'
): Order[] {
  let filtered = orders;
  
  // Filter by group if specified
  if (group) {
    filtered = filtered.filter(o => o.groupName === group);
  }
  
  // Filter by view
  if (view === 'active') {
    filtered = filtered.filter(o => 
      !o.isPast && 
      o.statusCategory !== 'completed' && 
      o.statusCategory !== 'canceled'
    );
  } else {
    filtered = filtered.filter(o => 
      o.isPast || o.statusCategory === 'completed'
    );
  }
  
  return filtered;
}

// Get lookup data for order forms
export async function getLookupData() {
  const orders = await getOrdersWithDeadlines();
  
  // Extract unique values
  const venues = [...new Set(orders.map(o => o.venueName).filter(Boolean))].sort();
  const charities = [...new Set(orders.map(o => o.charity).filter(Boolean))].sort();
  const classTypes = [...new Set(orders.map(o => o.classType).filter(Boolean))].sort();
  const groups = [...new Set(orders.map(o => o.groupName).filter(Boolean))].sort();
  const regions = [...new Set(orders.map(o => o.market).filter(Boolean))].sort();
  
  return {
    venues,
    charities,
    classTypes,
    groups,
    regions,
  };
}
