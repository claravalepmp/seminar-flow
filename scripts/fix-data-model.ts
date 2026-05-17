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

async function clearTable(tableName: string) {
  console.log(`  Clearing ${tableName}...`);
  const records = await base(tableName).select().all();
  if (records.length === 0) return;
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10).map(r => r.id);
    await base(tableName).destroy(batch);
  }
  console.log(`  Cleared ${records.length} records`);
}

async function createRecords(tableName: string, records: any[]) {
  console.log(`  Creating ${records.length} records in ${tableName}...`);
  let created = 0;
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    try {
      await base(tableName).create(batch.map(r => ({ fields: r })));
      created += batch.length;
      process.stdout.write('.');
    } catch (e: any) {
      // Try one by one
      for (const r of batch) {
        try {
          await base(tableName).create([{ fields: r }]);
          created++;
        } catch {}
      }
    }
  }
  console.log(` ${created} created`);
  return created;
}

// Normalize status from Direct Mail / Digital sheets
// "Issues" = Cancelled (exclude)
// "Order Sent" / "Order Completed" / "Campaign Completed" = Done
function normalizeStatus(dmStatus: string, digitalStatus: string): { status: string; isCancelled: boolean; isSent: boolean } {
  const dm = (dmStatus || '').toLowerCase();
  const dg = (digitalStatus || '').toLowerCase();
  
  // Issues = Cancelled
  if (dm.includes('issue') || dg.includes('issue')) {
    return { status: 'cancelled', isCancelled: true, isSent: false };
  }
  
  // Order Sent / Completed
  if (dm.includes('order sent') || dm.includes('completed') || dm.includes('mailed') ||
      dg.includes('completed') || dg.includes('campaign completed')) {
    return { status: 'sent', isCancelled: false, isSent: true };
  }
  
  // Campaign Running
  if (dg.includes('running') || dg.includes('active')) {
    return { status: 'running', isCancelled: false, isSent: false };
  }
  
  // At Printer / List Ready
  if (dm.includes('printer') || dm.includes('list ready') || dm.includes('ready')) {
    return { status: 'at_printer', isCancelled: false, isSent: false };
  }
  
  // Tech Ready / Creatives
  if (dg.includes('tech ready') || dg.includes('creatives')) {
    return { status: 'in_progress', isCancelled: false, isSent: false };
  }
  
  // Pending / Not Started
  return { status: 'pending', isCancelled: false, isSent: false };
}

async function main() {
  console.log('=== FIX DATA MODEL ===\n');
  console.log('Status source: Direct Mail + Digital sheets only');
  console.log('Issues = Cancelled (excluded)');
  console.log('Order Sent = filtered from homepage\n');
  
  // Load sheets
  console.log('Loading Google Sheets...');
  const directMailRows = await getSheetData(process.env.SHEET_ID_DIRECT_MAILING!);
  const digitalJobRows = await getSheetData(process.env.SHEET_ID_DIGITAL_JOBS!);
  
  const directMailOrders = parseRows<any>(directMailRows).filter(o => o.order_number?.trim());
  const digitalJobs = parseRows<any>(digitalJobRows).filter(o => o.advisor_name?.trim());
  
  console.log(`  Direct Mailing: ${directMailOrders.length} orders`);
  console.log(`  Digital Jobs: ${digitalJobs.length} jobs`);
  
  // Build order lookup by order_number from Direct Mail
  // This is the source of truth for orders
  const orderMap = new Map<string, any>();
  
  for (const dm of directMailOrders) {
    const orderNum = dm.order_number?.trim();
    if (!orderNum) continue;
    
    // Find matching digital job
    const matchingDigital = digitalJobs.find(d => 
      d.order_number?.trim() === orderNum || 
      (d.advisor_name === dm.advisor_name && d.first_event_date === dm.first_event_date)
    );
    
    const dmStatus = dm[''] || dm.status || ''; // First column is often status
    const digitalStatus = matchingDigital?.status || '';
    
    const { status, isCancelled, isSent } = normalizeStatus(dmStatus, digitalStatus);
    
    // Skip cancelled orders
    if (isCancelled) continue;
    
    orderMap.set(orderNum, {
      order_number: parseInt(orderNum) || 0,
      advisor_name: dm.advisor_name || '',
      group_name: dm.group_name || '',
      first_event_date: parseDate(dm.first_event_date),
      second_event_date: parseDate(dm.second_event_date),
      market: dm.market || '',
      office_location: dm.office_location || '',
      charity: dm.charity || '',
      class_type: dm.class_type || '',
      mailing_quantity: parseInt(dm.mailing_quantity?.replace(/,/g, '')) || 0,
      mailer_type: dm.mailer_type || '',
      digital_budget: parseFloat(matchingDigital?.max_budget?.replace(/[$,]/g, '') || '0') || 0,
      landing_page_url: dm.landing_page_url_direct || matchingDigital?.landing_page_url || '',
      venue_name: dm.venue_name_room_if_not_different || matchingDigital?.location_name_room || '',
      venue_address: dm.venue_address || matchingDigital?.location_address || '',
      start_time: dm.start_time || matchingDigital?.start_time || '',
      end_time: dm.end_time || matchingDigital?.end_time || '',
      status,
      is_sent: isSent,
      dm_status: dmStatus,
      digital_status: digitalStatus,
    });
  }
  
  console.log(`\nCombined orders (excluding cancelled): ${orderMap.size}`);
  
  // Count by status
  const statusCounts: Record<string, number> = {};
  const sentCount = Array.from(orderMap.values()).filter(o => o.is_sent).length;
  const activeCount = Array.from(orderMap.values()).filter(o => !o.is_sent).length;
  
  orderMap.forEach(o => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });
  
  console.log('Status breakdown:');
  Object.entries(statusCounts).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
  console.log(`\nSent (hidden from homepage): ${sentCount}`);
  console.log(`Active (shown on homepage): ${activeCount}`);
  
  // Extract unique advisors and groups
  const advisorMap = new Map<string, any>();
  const groupMap = new Map<string, string>();
  
  orderMap.forEach(o => {
    const advisorName = o.advisor_name?.trim();
    const groupName = o.group_name?.trim();
    
    if (advisorName && !advisorMap.has(advisorName)) {
      advisorMap.set(advisorName, {
        advisor_name: advisorName,
        group_name: groupName || '',
        business_name: groupName || advisorName,
      });
    }
    
    if (groupName && !groupMap.has(groupName)) {
      groupMap.set(groupName, groupName);
    }
  });
  
  console.log(`\nUnique advisors: ${advisorMap.size}`);
  console.log(`Unique groups: ${groupMap.size}`);
  
  // Sync to Airtable
  console.log('\n--- Syncing to Airtable ---\n');
  
  // Groups
  console.log('Groups:');
  await clearTable('Groups');
  const groupRecords = Array.from(groupMap.values()).map(name => ({ Name: name }));
  await createRecords('Groups', groupRecords);
  
  // Advisors
  console.log('\nAdvisors:');
  await clearTable('Advisors');
  const advisorRecords = Array.from(advisorMap.values());
  await createRecords('Advisors', advisorRecords);
  
  // Orders
  console.log('\nOrders:');
  await clearTable('Orders');
  const orderRecords = Array.from(orderMap.values()).map(o => ({
    order_number: o.order_number,
    advisor: o.advisor_name,
    group_name: o.group_name,
    first_event_date: o.first_event_date,
    second_event_date: o.second_event_date,
    market: o.market,
    office_location: o.office_location,
    class_type: mapClassType(o.class_type),
    mailing_quantity: o.mailing_quantity,
    mailer_type: o.mailer_type,
    digital_budget: o.digital_budget,
    landing_page_url: o.landing_page_url,
    venue_name: o.venue_name,
    venue_address: o.venue_address,
    start_time: o.start_time,
    end_time: o.end_time,
    status: mapAirtableStatus(o.status),
    needs_direct_mail: true,
    needs_digital: o.digital_budget > 0 || o.digital_status,
  }));
  await createRecords('Orders', orderRecords.filter(o => o.order_number > 0));
  
  console.log('\n=== DONE ===');
}

function mapClassType(ct: string): string | undefined {
  const c = (ct || '').toLowerCase();
  if (c.includes('r90')) return 'R90';
  if (c.includes('r101')) return 'R101';
  if (c.includes('ss101') || c.includes('ss 101') || c.includes('social security')) return 'SS101';
  if (c.includes('w101') || c.includes('w 101')) return 'W101';
  if (c.includes('w&t') || c.includes('wat')) return 'W&T101';
  return undefined;
}

function mapAirtableStatus(status: string): string {
  switch (status) {
    case 'sent': return 'completed';
    case 'running': return 'in_progress';
    case 'at_printer': return 'in_progress';
    case 'in_progress': return 'in_progress';
    default: return 'pending';
  }
}

main().catch(console.error);
