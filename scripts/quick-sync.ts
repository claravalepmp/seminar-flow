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

function getStatus(raw: string): { status: string; exclude: boolean } {
  const s = (raw || '').toLowerCase();
  if (s.includes('cancel') || (s.includes('issue') && !s.includes('pending'))) {
    return { status: 'cancelled', exclude: true };
  }
  if (s.includes('completed')) return { status: 'completed', exclude: false };
  if (s.includes('all details')) return { status: 'ready', exclude: false };
  if (s.includes('pending')) return { status: 'pending_details', exclude: false };
  if (s.includes('not started')) return { status: 'not_started', exclude: false };
  return { status: 'not_started', exclude: false };
}

async function main() {
  console.log('Quick sync...\n');
  
  const dmRows = await getSheetData(process.env.SHEET_ID_DIRECT_MAILING!);
  
  // Parse - column 0 is status, column 2 is order number
  const orders = dmRows.slice(1).map(row => {
    const { status, exclude } = getStatus(row[0] || '');
    return {
      raw_status: row[0] || '',
      status,
      exclude,
      order_number: parseInt(row[2]) || 0,
      advisor_name: row[4] || '',
      group_name: row[5] || '',
      first_event_date: parseDate(row[6]),
      charity: row[12] || '',
      class_type: row[13] || '',
      mailing_quantity: parseInt((row[14] || '').replace(/,/g, '')) || 0,
      mailer_type: row[15] || '',
      landing_page_url: row[18] || '',
      venue_name: row[20] || '',
      venue_address: row[21] || '',
      start_time: row[22] || '',
      end_time: row[23] || '',
      second_event_date: parseDate(row[27]),
      market: row[10] || '',
    };
  }).filter(o => o.order_number > 0 && !o.exclude);
  
  console.log(`Valid orders: ${orders.length}`);
  
  // Status counts
  const counts: Record<string, number> = {};
  orders.forEach(o => counts[o.status] = (counts[o.status] || 0) + 1);
  console.log('Status:', counts);
  
  // Clear and create orders
  console.log('\nClearing orders...');
  const existing = await base('Orders').select().all();
  for (let i = 0; i < existing.length; i += 10) {
    await base('Orders').destroy(existing.slice(i, i + 10).map(r => r.id));
  }
  
  console.log('Creating orders...');
  let created = 0;
  for (let i = 0; i < orders.length; i += 10) {
    const batch = orders.slice(i, i + 10).map(o => ({
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
        mailing_quantity: o.mailing_quantity,
        mailer_type: o.mailer_type,
        landing_page_url: o.landing_page_url,
        status: o.status === 'completed' ? 'completed' : 'pending',
        needs_direct_mail: true,
        needs_digital: true,
      }
    }));
    
    try {
      await base('Orders').create(batch);
      created += batch.length;
      process.stdout.write('.');
    } catch (e) {
      for (const r of batch) {
        try { await base('Orders').create([r]); created++; } catch {}
      }
    }
  }
  
  console.log(`\nCreated ${created} orders`);
}

main().catch(console.error);
