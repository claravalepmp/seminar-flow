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
    if (data.error) console.log(`  Batch error: ${data.error.message}`);
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

function clean(val) {
  if (Array.isArray(val)) val = val[0] || '';
  // Remove surrounding quotes
  return String(val || '').trim().replace(/^"+|"+$/g, '');
}

async function main() {
  const sheets = await getSheets();
  
  // Get tables
  const meta = await metaApi('tables');
  const T = {};
  const fieldInfo = {};
  meta.tables.forEach(t => {
    T[t.name] = t.id;
    fieldInfo[t.name] = {};
    t.fields.forEach(f => fieldInfo[t.name][f.name] = { id: f.id, type: f.type });
  });

  // ============ STEP 1: Change status fields to text ============
  console.log('=== CONVERTING STATUS FIELDS TO TEXT ===');
  
  // Add text status field, will import to that
  const digitalStatusField = fieldInfo.Digital_Jobs?.status;
  const invoiceStatusField = fieldInfo.Invoices?.status;
  
  // Create new text fields for status if select exists
  if (digitalStatusField?.type === 'singleSelect') {
    const result = await metaApi(`tables/${T.Digital_Jobs}/fields`, 'POST', {
      name: 'status_text', type: 'singleLineText'
    });
    console.log(`  Digital_Jobs.status_text: ${result.error ? result.error.message : 'created'}`);
  }
  
  if (invoiceStatusField?.type === 'singleSelect') {
    const result = await metaApi(`tables/${T.Invoices}/fields`, 'POST', {
      name: 'status_text', type: 'singleLineText'
    });
    console.log(`  Invoices.status_text: ${result.error ? result.error.message : 'created'}`);
  }

  // ============ STEP 2: Build lookups ============
  console.log('\n=== BUILDING LOOKUPS ===');
  
  const existingOrders = await getAllRecords(T.Orders);
  const orderByNumber = {};
  existingOrders.forEach(o => {
    if (o.fields?.order_number) orderByNumber[o.fields.order_number] = o.id;
  });
  console.log(`  Orders by number: ${Object.keys(orderByNumber).length}`);
  
  const existingClients = await getAllRecords(T.Clients);
  const clientByGroup = {};
  const clientByAdvisor = {};
  existingClients.forEach(c => {
    const group = clean(c.fields?.group_name).toLowerCase();
    const advisor = clean(c.fields?.advisor_name).toLowerCase();
    if (group) clientByGroup[group] = c.id;
    if (advisor) clientByAdvisor[advisor] = c.id;
  });
  console.log(`  Clients by group: ${Object.keys(clientByGroup).length}`);

  // ============ STEP 3: Import Digital Jobs ============
  console.log('\n=== IMPORTING DIGITAL JOBS ===');
  const digitalSheet = await fetchSheet(sheets, process.env.SHEET_ID_DIGITAL_JOBS, 'PMP Digital Jobs - Job Details!A:V');
  const digitalRows = digitalSheet.slice(1).filter(r => r[1]);
  console.log(`  Sheet rows: ${digitalRows.length}`);
  
  const existingDigital = await getAllRecords(T.Digital_Jobs);
  const digitalByKey = {};
  existingDigital.forEach(d => {
    const key = `${clean(d.fields?.advisor_name)}-${d.fields?.first_event_date}`.toLowerCase();
    digitalByKey[key] = d.id;
  });
  
  const digitalRecords = [];
  for (const row of digitalRows) {
    const orderNum = parseInt(row[20]) || null;
    const advisorName = clean(row[1]);
    const eventDate = parseDate(row[3]);
    const key = `${advisorName}-${eventDate}`.toLowerCase();
    
    if (digitalByKey[key]) continue;
    
    const groupName = clean(row[2]).toLowerCase();
    
    const rec = {
      order_number: orderNum,
      status_text: clean(row[0]) || 'New',
      advisor_name: advisorName,
      group_name: clean(row[2]),
      first_event_date: eventDate,
      second_event_date: parseDate(row[4]),
      location_name: clean(row[5]),
      location_address: clean(row[6]),
      start_time: clean(row[7]),
      end_time: clean(row[8]),
      class_type: clean(row[9]),
      landing_page_url: clean(row[13]),
      max_budget: parseMoney(row[14]),
      notes: clean(row[15])
    };
    
    if (orderNum && orderByNumber[orderNum]) rec.order = [orderByNumber[orderNum]];
    if (clientByGroup[groupName]) rec.client = [clientByGroup[groupName]];
    
    digitalRecords.push(rec);
  }
  
  console.log(`  New records to create: ${digitalRecords.length}`);
  if (digitalRecords.length > 0) {
    const created = await batchCreate(T.Digital_Jobs, digitalRecords);
    console.log(`  Created: ${created.length}`);
  }

  // ============ STEP 4: Import Invoices ============
  console.log('\n=== IMPORTING INVOICES ===');
  const invoiceSheet = await fetchSheet(sheets, process.env.SHEET_ID_INVOICE, 'Sheet1!A:T');
  const invoiceRows = invoiceSheet.slice(1).filter(r => r[1]);
  console.log(`  Sheet rows: ${invoiceRows.length}`);
  
  const existingInvoices = await getAllRecords(T.Invoices);
  const invoiceByOrderNum = {};
  existingInvoices.forEach(inv => {
    if (inv.fields?.order_number) invoiceByOrderNum[inv.fields.order_number] = inv.id;
  });
  
  const invoiceRecords = [];
  for (const row of invoiceRows) {
    const orderNum = parseInt(row[1]) || null;
    if (!orderNum || invoiceByOrderNum[orderNum]) continue;
    
    const groupName = clean(row[3]).toLowerCase();
    
    const rec = {
      order_number: orderNum,
      status_text: clean(row[0]) || 'Draft',
      advisor_name: clean(row[2]),
      group_name: clean(row[3]),
      sent_date: parseDate(row[4]),
      paid_date: parseDate(row[5]),
      first_class_day: parseDate(row[6]),
      direct_rate: parseMoney(row[7]),
      mailing_quantity: parseInt(row[8]) || null,
      invoiced_direct_mail: parseMoney(row[10]),
      invoiced_digital: parseMoney(row[11]),
      total_invoice: parseMoney(row[15]),
      mailer_type: clean(row[17])
    };
    
    if (orderNum && orderByNumber[orderNum]) rec.order = [orderByNumber[orderNum]];
    if (clientByGroup[groupName]) rec.client = [clientByGroup[groupName]];
    
    invoiceRecords.push(rec);
  }
  
  console.log(`  New records to create: ${invoiceRecords.length}`);
  if (invoiceRecords.length > 0) {
    const created = await batchCreate(T.Invoices, invoiceRecords);
    console.log(`  Created: ${created.length}`);
  }

  // ============ SUMMARY ============
  console.log('\n=== FINAL COUNTS ===');
  for (const name of ['Orders', 'Clients', 'Digital_Jobs', 'Invoices', 'Events', 'Creatives', 'Direct_Mail_Jobs']) {
    const recs = await getAllRecords(T[name]);
    const linked = recs.filter(r => r.fields?.order?.length || r.fields?.client?.length).length;
    console.log(`  ${name}: ${recs.length} total, ${linked} linked`);
  }
}

main().catch(console.error);
