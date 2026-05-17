import Airtable from 'airtable';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

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

function parseDate(dateStr: string): string | null {
  if (!dateStr?.trim()) return null;
  const cleaned = dateStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '').trim();
  try {
    const d = new Date(cleaned);
    if (d.getFullYear() > 2000) return d.toISOString().split('T')[0];
  } catch { }
  return null;
}

// Map class types to Airtable allowed values
function mapClassType(classType: string): string | null {
  const ct = classType?.toLowerCase().trim() || '';
  if (ct.includes('r90')) return 'R90';
  if (ct.includes('r101')) return 'R101';
  if (ct.includes('ss101') || ct.includes('ss 101') || ct.includes('social security')) return 'SS101';
  if (ct.includes('w101') || ct.includes('w 101') || ct.includes('wealth 101')) return 'W101';
  if (ct.includes('w&t') || ct.includes('wat') || ct.includes('wine') || ct.includes('women')) return 'W&T101';
  // Skip others that don't match
  return null;
}

function mapDMClassType(classType: string): string | null {
  const ct = classType?.toLowerCase().trim() || '';
  if (ct.includes('r90')) return 'R90';
  if (ct.includes('r101')) return 'R101';
  if (ct.includes('ss101') || ct.includes('ss 101') || ct.includes('social security')) return 'SS101';
  if (ct.includes('w101') || ct.includes('w 101') || ct.includes('wealth')) return 'W101';
  if (ct.includes('w&t') || ct.includes('wat') || ct.includes('wine') || ct.includes('women')) return 'WAT';
  return null;
}

async function clearTable(tableName: string) {
  console.log(`  Clearing ${tableName}...`);
  try {
    const records = await base(tableName).select().all();
    if (records.length === 0) return;
    for (let i = 0; i < records.length; i += 10) {
      const batch = records.slice(i, i + 10).map(r => r.id);
      await base(tableName).destroy(batch);
    }
    console.log(`  Cleared ${records.length} records`);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
}

async function createRecords(tableName: string, records: any[], batchSize = 10) {
  console.log(`  Creating ${records.length} records in ${tableName}...`);
  let created = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try {
      await base(tableName).create(batch.map(r => ({ fields: r })));
      created += batch.length;
    } catch (e: any) {
      // Try one by one on error
      for (const r of batch) {
        try {
          await base(tableName).create([{ fields: r }]);
          created++;
        } catch (e2: any) {
          // Skip problematic records silently
        }
      }
    }
  }
  
  console.log(`  Created ${created} records`);
  return created;
}

async function main() {
  console.log('=== AIRTABLE SYNC V2 ===\n');
  
  // Load Google Sheets
  console.log('Loading Google Sheets...');
  const mainOrderRows = await getSheetData(process.env.SHEET_ID_MAIN_ORDER!);
  const directMailRows = await getSheetData(process.env.SHEET_ID_DIRECT_MAILING!);
  const digitalJobRows = await getSheetData(process.env.SHEET_ID_DIGITAL_JOBS!);
  
  const mainOrders = parseRows<any>(mainOrderRows).filter(o => o.order_number?.trim());
  const directMailOrders = parseRows<any>(directMailRows).filter(o => o.order_number?.trim());
  const digitalJobs = parseRows<any>(digitalJobRows).filter(o => o.advisor_name?.trim());
  
  console.log(`  Main Orders: ${mainOrders.length}`);
  console.log(`  Direct Mailing: ${directMailOrders.length}`);
  console.log(`  Digital Jobs: ${digitalJobs.length}`);
  
  // Re-sync Orders with proper class type mapping
  console.log('\n--- Re-syncing Orders with fixed class types ---');
  await clearTable('Orders');
  
  const activeOrders = mainOrders.filter(o => {
    const status = o.status?.toLowerCase() || '';
    return !status.includes('cancel');
  });
  
  const orderRecords = activeOrders.map(o => {
    const classType = mapClassType(o.class_type);
    const rec: any = {
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
      mailing_quantity: parseInt(o.mailing_quantity?.replace(/,/g, '')) || 0,
      mailer_type: o.mailer_type || '',
      landing_page_url: o.landing_page_url_direct || '',
      venue_name: o.venue_name_room_if_not_different || o.venue_name || '',
      venue_address: o.venue_address || '',
      start_time: o.start_time || '',
      end_time: o.end_time || '',
      first_event_room: o.first_event_room || '',
      second_event_room: o.second_event_room || '',
      event_notes: o.order_instructions_always_double_click_to_see_all_notes_even_if_empty || '',
      status: mapOrderStatus(o.status),
    };
    if (classType) rec.class_type = classType;
    return rec;
  });
  
  await createRecords('Orders', orderRecords);
  
  // Re-sync Direct_Mail_Jobs
  console.log('\n--- Re-syncing Direct_Mail_Jobs ---');
  await clearTable('Direct_Mail_Jobs');
  
  const dmRecords = directMailOrders.map(d => {
    const classType = mapDMClassType(d.class_type);
    const rec: any = {
      order_number: parseInt(d.order_number) || 0,
      'Advisor Name': d.advisor_name || '',
      'Group Name': d.group_name || '',
      'First Event Date': parseDate(d.first_event_date),
      'Second Event Date': parseDate(d.second_event_date),
      Market: d.market || '',
      'Office Location': d.office_location || '',
      Charity: d.charity || '',
      quantity: parseInt(d.mailing_quantity?.replace(/,/g, '')) || 0,
      'Mailer Type': d.mailer_type || '',
      'Landing Page URL': d.landing_page_url_direct || '',
      'Venue Name': d.venue_name_room_if_not_different || '',
      'Venue Address': d.venue_address || '',
      'Start Time': d.start_time || '',
      'End Time': d.end_time || '',
      status: mapDMStatus(d.status || d[''] || ''),
    };
    if (classType) rec['Class Type'] = classType;
    return rec;
  });
  
  await createRecords('Direct_Mail_Jobs', dmRecords);
  
  console.log('\n=== SYNC V2 COMPLETE ===');
  
  // Final counts
  console.log('\nFinal record counts:');
  for (const t of ['Orders', 'Advisors', 'Groups', 'Direct_Mail_Jobs', 'Digital_Jobs']) {
    const records = await base(t).select().all();
    console.log(`  ${t}: ${records.length}`);
  }
}

function mapOrderStatus(status: string): string {
  const s = status?.toLowerCase() || '';
  if (s.includes('sent') || s.includes('completed')) return 'completed';
  if (s.includes('issue')) return 'pending';
  if (s.includes('proof')) return 'in_progress';
  if (s.includes('detail')) return 'in_progress';
  return 'pending';
}

function mapDMStatus(status: string): string {
  const s = status?.toLowerCase() || '';
  if (s.includes('completed') || s.includes('mailed')) return 'Mailed';
  if (s.includes('printer')) return 'At Printer';
  if (s.includes('ready')) return 'List Ready';
  return 'Pending List';
}

main().catch(console.error);
