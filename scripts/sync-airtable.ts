import Airtable from 'airtable';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const AIRTABLE_PAT = process.env.AIRTABLE_PAT!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

// Google Sheets setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  return new google.auth.JWT({ email, key, scopes: SCOPES });
}

async function getSheetData(spreadsheetId: string): Promise<string[][]> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A:ZZ' });
  return response.data.values || [];
}

function parseRows<T>(rows: string[][]): T[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => 
    h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  );
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj as T;
  });
}

// Parse date strings to ISO format
function parseDate(dateStr: string): string | null {
  if (!dateStr?.trim()) return null;
  const cleaned = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '').trim();
  try {
    const d = new Date(cleaned);
    if (d.getFullYear() > 2000) return d.toISOString().split('T')[0];
  } catch { }
  return null;
}

// Get unique advisors from orders
function extractAdvisors(orders: any[]): Map<string, any> {
  const advisorMap = new Map();
  for (const o of orders) {
    const name = o.advisor_name?.trim();
    if (!name) continue;
    if (!advisorMap.has(name)) {
      advisorMap.set(name, {
        advisor_name: name,
        group_name: o.group_name || '',
        office_location: o.office_location || '',
      });
    }
  }
  return advisorMap;
}

// Get unique groups
function extractGroups(orders: any[]): Map<string, any> {
  const groupMap = new Map();
  for (const o of orders) {
    const name = o.group_name?.trim();
    if (!name) continue;
    if (!groupMap.has(name)) {
      groupMap.set(name, { name });
    }
  }
  return groupMap;
}

async function countRecords(tableName: string): Promise<number> {
  try {
    const records = await base(tableName).select().all();
    return records.length;
  } catch (e) {
    return -1;
  }
}

async function clearTable(tableName: string) {
  console.log(`  Clearing ${tableName}...`);
  try {
    const records = await base(tableName).select().all();
    if (records.length === 0) return;
    
    // Delete in batches of 10
    for (let i = 0; i < records.length; i += 10) {
      const batch = records.slice(i, i + 10).map(r => r.id);
      await base(tableName).destroy(batch);
    }
    console.log(`  Cleared ${records.length} records from ${tableName}`);
  } catch (e: any) {
    console.log(`  Error clearing ${tableName}: ${e.message}`);
  }
}

async function createRecords(tableName: string, records: any[], batchSize = 10) {
  console.log(`  Creating ${records.length} records in ${tableName}...`);
  const created: string[] = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try {
      const result = await base(tableName).create(batch.map(r => ({ fields: r })));
      created.push(...result.map(r => r.id));
    } catch (e: any) {
      console.log(`  Error batch ${i}: ${e.message}`);
    }
  }
  
  console.log(`  Created ${created.length} records`);
  return created;
}

async function main() {
  console.log('=== AIRTABLE SYNC FROM GOOGLE SHEETS ===\n');
  
  // Check current counts
  console.log('Current record counts:');
  const tables = ['Orders', 'Advisors', 'Groups', 'Direct_Mail_Jobs', 'Digital_Jobs'];
  for (const t of tables) {
    const count = await countRecords(t);
    console.log(`  ${t}: ${count}`);
  }
  
  // Load Google Sheets data
  console.log('\nLoading Google Sheets...');
  
  const mainOrderRows = await getSheetData(process.env.SHEET_ID_MAIN_ORDER!);
  const directMailRows = await getSheetData(process.env.SHEET_ID_DIRECT_MAILING!);
  const digitalJobRows = await getSheetData(process.env.SHEET_ID_DIGITAL_JOBS!);
  
  const mainOrders = parseRows<any>(mainOrderRows).filter(o => o.order_number?.trim());
  const directMailOrders = parseRows<any>(directMailRows).filter(o => o.order_number?.trim());
  const digitalJobs = parseRows<any>(digitalJobRows).filter(o => o.advisor_name?.trim());
  
  console.log(`  Main Orders: ${mainOrders.length}`);
  console.log(`  Direct Mailing: ${directMailOrders.length}`);
  console.log(`  Digital Jobs: ${digitalJobs.length}`);
  
  // Extract advisors and groups from ALL sheets
  const allOrders = [...mainOrders, ...directMailOrders, ...digitalJobs];
  const advisors = extractAdvisors(allOrders);
  const groups = extractGroups(allOrders);
  
  console.log(`\nExtracted: ${advisors.size} advisors, ${groups.size} groups`);
  
  // Clear and sync
  console.log('\n--- Syncing Groups ---');
  await clearTable('Groups');
  const groupRecords = Array.from(groups.values()).map(g => ({
    Name: g.name,
  }));
  await createRecords('Groups', groupRecords);
  
  console.log('\n--- Syncing Advisors ---');
  await clearTable('Advisors');
  const advisorRecords = Array.from(advisors.values()).map(a => ({
    advisor_name: a.advisor_name,
    group_name: a.group_name,
    business_name: a.group_name || a.advisor_name,
  }));
  await createRecords('Advisors', advisorRecords);
  
  console.log('\n--- Syncing Orders ---');
  await clearTable('Orders');
  
  // Filter to non-cancelled, recent/future orders
  const activeOrders = mainOrders.filter(o => {
    const status = o.status?.toLowerCase() || '';
    if (status.includes('cancel')) return false;
    return true;
  });
  
  console.log(`  Active orders (non-cancelled): ${activeOrders.length}`);
  
  const orderRecords = activeOrders.slice(0, 500).map(o => ({
    order_number: parseInt(o.order_number) || 0,
    advisor: o.advisor_name || '',
    group_name: o.group_name || '',
    first_event_date: parseDate(o.first_event_date || o.first_class_day),
    second_event_date: parseDate(o.second_event_date),
    third_event_date: parseDate(o.third_event_date),
    fourth_event_date: parseDate(o.fourth_event_date),
    needs_direct_mail: true,
    needs_digital: true,
    market: o.office_location || '',
    office_location: o.office_location || '',
    class_type: o.class_type || '',
    mailing_quantity: parseInt(o.mailing_quantity?.replace(/,/g, '')) || 0,
    mailer_type: o.mailer_type || '',
    landing_page_url: o.landing_page_url_direct || '',
    venue_name: o.venue_name_room_if_not_different || o.venue_name || '',
    venue_address: o.venue_address || '',
    start_time: o.start_time || '',
    end_time: o.end_time || '',
    first_event_room: o.first_event_room || '',
    second_event_room: o.second_event_room || '',
    third_event_room: o.third_event_room || '',
    fourth_event_room: o.fourth_event_room || '',
    status: mapStatus(o.status),
    event_notes: o.order_instructions_always_double_click_to_see_all_notes_even_if_empty || '',
  }));
  
  await createRecords('Orders', orderRecords);
  
  console.log('\n--- Syncing Digital_Jobs ---');
  await clearTable('Digital_Jobs');
  
  const digitalRecords = digitalJobs.slice(0, 500).map(d => ({
    order_number: parseInt(d.order_number) || 0,
    advisor_name: d.advisor_name || '',
    group_name: d.group_name || '',
    first_event_date: parseDate(d.first_event_date),
    second_event_date: parseDate(d.second_event_date),
    location_name: d.location_name_room || d.venue_name || '',
    location_address: d.location_address || d.venue_address || '',
    start_time: d.start_time || '',
    end_time: d.end_time || '',
    class_type: d.class_type || '',
    landing_page_url: d.landing_page_url || '',
    max_budget: parseFloat(d.max_budget?.replace(/[$,]/g, '')) || 0,
    status: mapDigitalStatus(d.status),
  }));
  
  await createRecords('Digital_Jobs', digitalRecords);
  
  console.log('\n--- Syncing Direct_Mail_Jobs ---');
  await clearTable('Direct_Mail_Jobs');
  
  const dmRecords = directMailOrders.slice(0, 500).map(d => ({
    order_number: parseInt(d.order_number) || 0,
    'Advisor Name': d.advisor_name || '',
    'Group Name': d.group_name || '',
    'First Event Date': parseDate(d.first_event_date),
    'Second Event Date': parseDate(d.second_event_date),
    Market: d.market || '',
    'Office Location': d.office_location || '',
    Charity: d.charity || '',
    'Class Type': d.class_type || '',
    quantity: parseInt(d.mailing_quantity?.replace(/,/g, '')) || 0,
    'Mailer Type': d.mailer_type || '',
    'Landing Page URL': d.landing_page_url_direct || '',
    'Venue Name': d.venue_name_room_if_not_different || '',
    'Venue Address': d.venue_address || '',
    'Start Time': d.start_time || '',
    'End Time': d.end_time || '',
    status: mapDMStatus(d.status || d[''] || ''),
  }));
  
  await createRecords('Direct_Mail_Jobs', dmRecords);
  
  console.log('\n=== SYNC COMPLETE ===');
}

function mapStatus(status: string): string {
  const s = status?.toLowerCase() || '';
  if (s.includes('sent') || s.includes('completed')) return 'completed';
  if (s.includes('issue')) return 'pending';
  if (s.includes('proof')) return 'in_progress';
  if (s.includes('detail')) return 'in_progress';
  if (s.includes('not started')) return 'pending';
  return 'pending';
}

function mapDigitalStatus(status: string): string {
  const s = status?.toLowerCase() || '';
  if (s.includes('completed')) return 'Completed';
  if (s.includes('running')) return 'Active';
  if (s.includes('ready')) return 'Active';
  if (s.includes('issue')) return 'QA Pending';
  return 'New';
}

function mapDMStatus(status: string): string {
  const s = status?.toLowerCase() || '';
  if (s.includes('completed') || s.includes('mailed')) return 'Mailed';
  if (s.includes('printer')) return 'At Printer';
  if (s.includes('ready')) return 'List Ready';
  return 'Pending List';
}

main().catch(console.error);
