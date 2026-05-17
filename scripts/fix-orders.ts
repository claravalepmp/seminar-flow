import Airtable from 'airtable';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
function getGoogleAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
}

async function getSheetData(spreadsheetId: string): Promise<string[][]> {
  const sheets = google.sheets({ version: 'v4', auth: getGoogleAuth() });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A:ZZ' });
  return response.data.values || [];
}

function parseRows(rows: string[][]): any[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return rows.slice(1).map(row => {
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
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

async function main() {
  console.log('Loading Direct Mail sheet...');
  const dmRows = await getSheetData(process.env.SHEET_ID_DIRECT_MAILING!);
  const dmOrders = parseRows(dmRows).filter(o => o.order_number?.trim());
  console.log(`${dmOrders.length} orders`);

  // Clear and recreate orders - skip class_type to avoid select issues
  console.log('Clearing Orders...');
  const existing = await base('Orders').select().all();
  for (let i = 0; i < existing.length; i += 10) {
    await base('Orders').destroy(existing.slice(i, i + 10).map(r => r.id));
  }
  console.log(`Cleared ${existing.length}`);

  // Filter: exclude Issues (cancelled), include all others
  const validOrders = dmOrders.filter(o => {
    const status = (o[''] || o.status || '').toLowerCase();
    return !status.includes('issue'); // Issues = cancelled
  });
  console.log(`Valid orders (excluding cancelled): ${validOrders.length}`);

  // Create orders without class_type (avoid single select issues)
  console.log('Creating orders...');
  let created = 0;
  for (let i = 0; i < validOrders.length; i += 10) {
    const batch = validOrders.slice(i, i + 10).map(o => {
      const status = (o[''] || o.status || '').toLowerCase();
      const isSent = status.includes('sent') || status.includes('completed') || status.includes('mailed');
      
      return {
        fields: {
          order_number: parseInt(o.order_number) || 0,
          advisor: o.advisor_name || '',
          group_name: o.group_name || '',
          first_event_date: parseDate(o.first_event_date),
          second_event_date: parseDate(o.second_event_date),
          market: o.market || '',
          office_location: o.office_location || '',
          mailing_quantity: parseInt(o.mailing_quantity?.replace(/,/g, '')) || 0,
          mailer_type: o.mailer_type || '',
          landing_page_url: o.landing_page_url_direct || '',
          venue_name: o.venue_name_room_if_not_different || '',
          venue_address: o.venue_address || '',
          start_time: o.start_time || '',
          end_time: o.end_time || '',
          status: isSent ? 'completed' : 'pending',
          needs_direct_mail: true,
          needs_digital: true,
        }
      };
    }).filter(r => r.fields.order_number > 0);
    
    try {
      await base('Orders').create(batch);
      created += batch.length;
      process.stdout.write('.');
    } catch (e: any) {
      console.log(`\nBatch error: ${e.message}`);
      // Try one by one
      for (const r of batch) {
        try {
          await base('Orders').create([r]);
          created++;
        } catch {}
      }
    }
  }
  
  console.log(`\nCreated ${created} orders`);
  
  // Count sent vs active
  const allOrders = await base('Orders').select().all();
  const sent = allOrders.filter(o => o.get('status') === 'completed').length;
  const active = allOrders.filter(o => o.get('status') !== 'completed').length;
  console.log(`\nSent (completed): ${sent}`);
  console.log(`Active (homepage): ${active}`);
}

main().catch(console.error);
