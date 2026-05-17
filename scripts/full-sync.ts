import Airtable from 'airtable';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

async function getSheetData(spreadsheetId: string): Promise<string[][]> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A:ZZ' });
  return res.data.values || [];
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

// Normalize DM status
function normalizeDMStatus(raw: string): { status: string; exclude: boolean } {
  const s = (raw || '').toLowerCase();
  if (s.includes('cancel') || s.includes('issue')) return { status: 'cancelled', exclude: true };
  if (s.includes('completed')) return { status: 'completed', exclude: false };
  if (s.includes('all details')) return { status: 'ready', exclude: false };
  if (s.includes('pending')) return { status: 'pending_details', exclude: false };
  if (s.includes('not started')) return { status: 'not_started', exclude: false };
  return { status: 'pending_details', exclude: false };
}

// Normalize Digital status
function normalizeDigitalStatus(raw: string): string {
  const s = (raw || '').toLowerCase();
  if (s.includes('completed')) return 'completed';
  if (s.includes('running')) return 'running';
  if (s.includes('ready')) return 'ready';
  if (s.includes('issue')) return 'issues';
  if (s.includes('creatives') || s.includes('uploaded')) return 'in_progress';
  return 'not_started';
}

async function clearTable(name: string) {
  const records = await base(name).select().all();
  for (let i = 0; i < records.length; i += 10) {
    await base(name).destroy(records.slice(i, i + 10).map(r => r.id));
  }
  return records.length;
}

async function main() {
  console.log('=== FULL SYNC WITH CORRECT STATUS ===\n');
  
  // Load all sheets
  console.log('Loading sheets...');
  const dmRows = await getSheetData(process.env.SHEET_ID_DIRECT_MAILING!);
  const digRows = await getSheetData(process.env.SHEET_ID_DIGITAL_JOBS!);
  const mainRows = await getSheetData(process.env.SHEET_ID_MAIN_ORDER!);
  
  // Parse Direct Mail
  const dmHeaders = dmRows[0];
  const dmData = dmRows.slice(1).map(row => {
    const obj: any = {};
    dmHeaders.forEach((h, i) => obj[h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `col${i}`] = row[i] || '');
    obj.raw_status = row[0] || ''; // Column 0 is status
    return obj;
  }).filter(d => d.order_number?.trim());
  
  // Parse Digital
  const digHeaders = digRows[0];
  const digData = digRows.slice(1).map(row => {
    const obj: any = {};
    digHeaders.forEach((h, i) => obj[h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')] = row[i] || '');
    return obj;
  }).filter(d => d.advisor_name?.trim());
  
  // Parse Main Orders for deadlines
  const mainHeaders = mainRows[0];
  const mainData = mainRows.slice(1).map(row => {
    const obj: any = {};
    mainHeaders.forEach((h, i) => obj[h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')] = row[i] || '');
    return obj;
  });
  
  // Build deadline lookup by order number
  const deadlineLookup = new Map<string, { approval: string; sent: string }>();
  mainData.forEach(m => {
    if (m.order_number) {
      deadlineLookup.set(m.order_number.trim(), {
        approval: m.client_approval_deadline || '',
        sent: m.order_sent_deadline || '',
      });
    }
  });
  
  console.log(`Direct Mail: ${dmData.length}, Digital: ${digData.length}, Main: ${mainData.length}`);
  
  // Build orders from Direct Mail (source of truth)
  const orders: any[] = [];
  const advisorSet = new Set<string>();
  const groupSet = new Set<string>();
  
  for (const dm of dmData) {
    const { status, exclude } = normalizeDMStatus(dm.raw_status);
    if (exclude) continue;
    
    const orderNum = dm.order_number?.trim();
    const deadlines = deadlineLookup.get(orderNum) || { approval: '', sent: '' };
    
    // Find matching digital job
    const digitalJob = digData.find(d => d.order_number?.trim() === orderNum);
    const digitalStatus = digitalJob ? normalizeDigitalStatus(digitalJob.status) : null;
    
    const advisorName = dm.advisor_name?.trim() || '';
    const groupName = dm.group_name?.trim() || '';
    
    if (advisorName) advisorSet.add(advisorName);
    if (groupName) groupSet.add(groupName);
    
    orders.push({
      order_number: parseInt(orderNum) || 0,
      advisor_name: advisorName,
      group_name: groupName,
      first_event_date: parseDate(dm.first_event_date || dm.first_event_date_25),
      second_event_date: parseDate(dm.second_event_date),
      third_event_date: parseDate(dm.third_event_date),
      fourth_event_date: parseDate(dm.fourth_event_date),
      venue_name: dm.venue_name_room_if_not_different || '',
      venue_address: dm.venue_address || '',
      start_time: dm.start_time || '',
      end_time: dm.end_time || '',
      charity: dm.charity || '',
      class_type: dm.class_type || '',
      mailing_quantity: parseInt(dm.mailing_quantity?.replace(/,/g, '')) || 0,
      mailer_type: dm.mailer_type || '',
      landing_page_url: dm.landing_page_url_direct || '',
      market: dm.market || '',
      office_location: dm.office_location || '',
      registration_phone: '', // Will get from client data
      needs_direct_mail: dm.needs_direct_mail === 'TRUE',
      needs_digital: dm.needs_digital === 'TRUE',
      dm_status: status,
      digital_status: digitalStatus,
      approval_deadline: deadlines.approval,
      send_deadline: deadlines.sent,
      first_event_room: dm.first_event_room || '',
      second_event_room: dm.second_event_room || '',
    });
  }
  
  console.log(`\nValid orders: ${orders.length}`);
  console.log(`Advisors: ${advisorSet.size}, Groups: ${groupSet.size}`);
  
  // Status breakdown
  const statusCounts: Record<string, number> = {};
  orders.forEach(o => {
    statusCounts[o.dm_status] = (statusCounts[o.dm_status] || 0) + 1;
  });
  console.log('\nStatus breakdown:');
  Object.entries(statusCounts).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
  
  // Clear and sync Airtable
  console.log('\n--- Syncing Airtable ---\n');
  
  // Groups
  console.log('Groups...');
  await clearTable('Groups');
  const groupRecords = Array.from(groupSet).filter(g => g).map(name => ({ fields: { Name: name } }));
  for (let i = 0; i < groupRecords.length; i += 10) {
    await base('Groups').create(groupRecords.slice(i, i + 10));
  }
  console.log(`  Created ${groupRecords.length}`);
  
  // Advisors
  console.log('Advisors...');
  await clearTable('Advisors');
  const advisorRecords = Array.from(advisorSet).filter(a => a).map(name => {
    const order = orders.find(o => o.advisor_name === name);
    return {
      fields: {
        advisor_name: name,
        group_name: order?.group_name || '',
        business_name: order?.group_name || name,
      }
    };
  });
  for (let i = 0; i < advisorRecords.length; i += 10) {
    await base('Advisors').create(advisorRecords.slice(i, i + 10));
  }
  console.log(`  Created ${advisorRecords.length}`);
  
  // Orders
  console.log('Orders...');
  await clearTable('Orders');
  const orderRecords = orders.filter(o => o.order_number > 0).map(o => ({
    fields: {
      order_number: o.order_number,
      advisor: o.advisor_name,
      group_name: o.group_name,
      first_event_date: o.first_event_date,
      second_event_date: o.second_event_date,
      venue_name: o.venue_name,
      venue_address: o.venue_address,
      start_time: o.start_time,
      end_time: o.end_time,
      market: o.market,
      office_location: o.office_location,
      mailing_quantity: o.mailing_quantity,
      mailer_type: o.mailer_type,
      landing_page_url: o.landing_page_url,
      needs_direct_mail: o.needs_direct_mail,
      needs_digital: o.needs_digital,
      status: o.dm_status,
      digital_budget: 0,
    }
  }));
  
  let created = 0;
  for (let i = 0; i < orderRecords.length; i += 10) {
    try {
      await base('Orders').create(orderRecords.slice(i, i + 10));
      created += Math.min(10, orderRecords.length - i);
    } catch (e: any) {
      // Try one by one
      for (const r of orderRecords.slice(i, i + 10)) {
        try {
          await base('Orders').create([r]);
          created++;
        } catch {}
      }
    }
  }
  console.log(`  Created ${created}`);
  
  // Digital Jobs
  console.log('Digital Jobs...');
  await clearTable('Digital_Jobs');
  const digitalRecords = digData.filter(d => {
    const status = normalizeDigitalStatus(d.status);
    return status !== 'issues';
  }).map(d => ({
    fields: {
      order_number: parseInt(d.order_number) || 0,
      advisor_name: d.advisor_name || '',
      group_name: d.group_name || '',
      first_event_date: parseDate(d.first_event_date),
      second_event_date: parseDate(d.second_event_date),
      location_name: d.location_name_room || '',
      location_address: d.location_address || '',
      start_time: d.start_time || '',
      end_time: d.end_time || '',
      class_type: d.class_type || '',
      landing_page_url: d.landing_page_url || '',
      max_budget: parseFloat(d.max_budget?.replace(/[$,]/g, '')) || 0,
      status: normalizeDigitalStatus(d.status),
    }
  }));
  
  created = 0;
  for (let i = 0; i < digitalRecords.length; i += 10) {
    try {
      await base('Digital_Jobs').create(digitalRecords.slice(i, i + 10));
      created += Math.min(10, digitalRecords.length - i);
    } catch (e: any) {
      for (const r of digitalRecords.slice(i, i + 10)) {
        try { await base('Digital_Jobs').create([r]); created++; } catch {}
      }
    }
  }
  console.log(`  Created ${created}`);
  
  console.log('\n=== SYNC COMPLETE ===');
}

main().catch(console.error);
