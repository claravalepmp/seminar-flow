require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, opts);
  return resp.json();
}

async function metaApi(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/${path}`, opts);
  return resp.json();
}

async function getAllRecords(tableId) {
  let all = [], offset = null;
  do {
    const url = offset ? `${tableId}?offset=${offset}` : tableId;
    const data = await api(url);
    all.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return all;
}

async function batchCreate(tableId, records) {
  const created = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10).map(fields => ({ fields }));
    const data = await api(tableId, 'POST', { records: batch });
    if (data.records) created.push(...data.records);
    if (data.error) console.log(`  Error: ${data.error.message}`);
  }
  return created;
}

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  return google.sheets({ version: 'v4', auth });
}

async function fetchSheet(sheets, id, range) {
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: id, range });
  return resp.data.values || [];
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseMoney(str) {
  if (!str) return null;
  return parseFloat(String(str).replace(/[$,]/g, '')) || null;
}

function str(val) {
  if (Array.isArray(val)) return val[0] || '';
  return String(val || '').trim();
}

async function main() {
  const sheets = await getSheets();
  
  // Get tables
  const meta = await metaApi('tables');
  const T = {};
  const fieldIds = {};
  meta.tables.forEach(t => {
    T[t.name] = t.id;
    fieldIds[t.name] = {};
    t.fields.forEach(f => fieldIds[t.name][f.name] = f.id);
  });

  // ============ STEP 1: Update Digital_Jobs status field with all options ============
  console.log('=== UPDATING SELECT OPTIONS ===');
  
  const digitalStatusId = fieldIds.Digital_Jobs?.status;
  if (digitalStatusId) {
    const allStatuses = ['New', 'QA Pending', 'TP Pending', 'Active', 'Completed', 'Cancelled',
      'Campaign Completed', 'Campaign Running', 'Tech Ready', 'Issues', 'Uploaded to Drive', 'Creatives In Sheet'];
    
    const result = await metaApi(`tables/${T.Digital_Jobs}/fields/${digitalStatusId}`, 'PATCH', {
      options: { choices: allStatuses.map(name => ({ name })) }
    });
    console.log(`  Digital_Jobs.status: ${result.error ? result.error.message : 'updated'}`);
  }
  
  const invoiceStatusId = fieldIds.Invoices?.status;
  if (invoiceStatusId) {
    const allStatuses = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Not Started', 'In Progress', 'Complete'];
    
    const result = await metaApi(`tables/${T.Invoices}/fields/${invoiceStatusId}`, 'PATCH', {
      options: { choices: allStatuses.map(name => ({ name })) }
    });
    console.log(`  Invoices.status: ${result.error ? result.error.message : 'updated'}`);
  }

  // ============ STEP 2: Build lookups ============
  console.log('\n=== BUILDING LOOKUPS ===');
  
  const existingOrders = await getAllRecords(T.Orders);
  const orderByNumber = {};
  existingOrders.forEach(o => {
    if (o.fields?.order_number) orderByNumber[o.fields.order_number] = o.id;
  });
  console.log(`  Orders: ${Object.keys(orderByNumber).length}`);
  
  const existingClients = await getAllRecords(T.Clients);
  const clientByGroup = {};
  existingClients.forEach(c => {
    const group = str(c.fields?.group_name).toLowerCase();
    if (group) clientByGroup[group] = c.id;
  });
  console.log(`  Client groups: ${Object.keys(clientByGroup).length}`);

  // ============ STEP 3: Import Digital Jobs ============
  console.log('\n=== IMPORTING DIGITAL JOBS ===');
  const digitalSheet = await fetchSheet(sheets, process.env.SHEET_ID_DIGITAL_JOBS, 'PMP Digital Jobs - Job Details!A:V');
  const digitalRows = digitalSheet.slice(1).filter(r => r[1]);
  
  const existingDigital = await getAllRecords(T.Digital_Jobs);
  const digitalByKey = {};
  existingDigital.forEach(d => {
    const key = `${d.fields?.advisor_name}-${d.fields?.first_event_date}`;
    digitalByKey[key] = d.id;
  });
  
  const digitalRecords = [];
  for (const row of digitalRows) {
    const orderNum = parseInt(row[20]) || null;
    const advisorName = str(row[1]);
    const eventDate = parseDate(row[3]);
    const key = `${advisorName}-${eventDate}`;
    
    if (digitalByKey[key]) continue; // Already exists
    
    const groupName = str(row[2]).toLowerCase();
    const status = str(row[0]) || 'New';
    
    const rec = {
      order_number: orderNum,
      status: status,
      advisor_name: advisorName,
      group_name: str(row[2]),
      first_event_date: eventDate,
      second_event_date: parseDate(row[4]),
      location_name: str(row[5]),
      location_address: str(row[6]),
      start_time: str(row[7]),
      end_time: str(row[8]),
      class_type: str(row[9]),
      landing_page_url: str(row[13]),
      max_budget: parseMoney(row[14]),
      notes: str(row[15])
    };
    
    if (orderNum && orderByNumber[orderNum]) rec.order = [orderByNumber[orderNum]];
    if (clientByGroup[groupName]) rec.client = [clientByGroup[groupName]];
    
    digitalRecords.push(rec);
  }
  
  if (digitalRecords.length > 0) {
    const created = await batchCreate(T.Digital_Jobs, digitalRecords);
    console.log(`  Created ${created.length} digital jobs`);
  } else {
    console.log(`  No new digital jobs`);
  }

  // ============ STEP 4: Import Invoices ============
  console.log('\n=== IMPORTING INVOICES ===');
  const invoiceSheet = await fetchSheet(sheets, process.env.SHEET_ID_INVOICE, 'Sheet1!A:T');
  const invoiceRows = invoiceSheet.slice(1).filter(r => r[1]);
  
  const existingInvoices = await getAllRecords(T.Invoices);
  const invoiceByOrderNum = {};
  existingInvoices.forEach(inv => {
    if (inv.fields?.order_number) invoiceByOrderNum[inv.fields.order_number] = inv.id;
  });
  
  const invoiceRecords = [];
  for (const row of invoiceRows) {
    const orderNum = parseInt(row[1]) || null;
    if (!orderNum || invoiceByOrderNum[orderNum]) continue;
    
    const groupName = str(row[3]).toLowerCase();
    const status = str(row[0]) || 'Draft';
    
    const rec = {
      order_number: orderNum,
      status: status,
      advisor_name: str(row[2]),
      group_name: str(row[3]),
      sent_date: parseDate(row[4]),
      paid_date: parseDate(row[5]),
      first_class_day: parseDate(row[6]),
      direct_rate: parseMoney(row[7]),
      mailing_quantity: parseInt(row[8]) || null,
      invoiced_direct_mail: parseMoney(row[10]),
      invoiced_digital: parseMoney(row[11]),
      total_invoice: parseMoney(row[15]),
      mailer_type: str(row[17])
    };
    
    if (orderNum && orderByNumber[orderNum]) rec.order = [orderByNumber[orderNum]];
    if (clientByGroup[groupName]) rec.client = [clientByGroup[groupName]];
    
    invoiceRecords.push(rec);
  }
  
  if (invoiceRecords.length > 0) {
    const created = await batchCreate(T.Invoices, invoiceRecords);
    console.log(`  Created ${created.length} invoices`);
  } else {
    console.log(`  No new invoices`);
  }

  // ============ STEP 5: Link Events to Orders ============
  console.log('\n=== LINKING EVENTS TO ORDERS ===');
  const existingEvents = await getAllRecords(T.Events);
  console.log(`  Events: ${existingEvents.length}`);
  
  // Events have order_number field - link them
  const eventUpdates = [];
  for (const event of existingEvents) {
    if (event.fields?.order?.length > 0) continue;
    const orderNum = event.fields?.order_number;
    if (orderNum && orderByNumber[orderNum]) {
      eventUpdates.push({ id: event.id, fields: { order: [orderByNumber[orderNum]] } });
    }
  }
  
  if (eventUpdates.length > 0) {
    for (let i = 0; i < eventUpdates.length; i += 10) {
      const batch = eventUpdates.slice(i, i + 10);
      await api(T.Events, 'PATCH', { records: batch });
    }
    console.log(`  Linked ${eventUpdates.length} events to orders`);
  }

  // ============ SUMMARY ============
  console.log('\n=== FINAL COUNTS ===');
  const tables = ['Orders', 'Clients', 'Digital_Jobs', 'Invoices', 'Events', 'Creatives'];
  for (const name of tables) {
    const recs = await getAllRecords(T[name]);
    const linked = recs.filter(r => r.fields?.order?.length || r.fields?.client?.length).length;
    console.log(`  ${name}: ${recs.length} (${linked} linked)`);
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
