require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, opts);
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

async function batchUpdate(tableId, updates) {
  const results = [];
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const data = await api(tableId, 'PATCH', { records: batch });
    if (data.records) results.push(...data.records);
    if (data.error) console.log(`  Error: ${data.error.message}`);
  }
  return results;
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
  
  // Get table IDs
  const meta = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${PAT}` }
  }).then(r => r.json());
  
  const T = {};
  meta.tables.forEach(t => T[t.name] = t.id);
  console.log('Tables:', Object.keys(T).join(', '));

  // ============ STEP 1: Get existing data ============
  console.log('\n=== LOADING EXISTING DATA ===');
  
  const existingOrders = await getAllRecords(T.Orders);
  console.log(`  Orders: ${existingOrders.length}`);
  
  const existingGroups = await getAllRecords(T.Groups);
  console.log(`  Groups: ${existingGroups.length}`);
  
  const existingClients = await getAllRecords(T.Clients);
  console.log(`  Clients: ${existingClients.length}`);

  // Build lookups
  const groupByName = {};
  existingGroups.forEach(g => {
    const name = str(g.fields?.name).toLowerCase();
    if (name) groupByName[name] = g.id;
  });
  
  const orderByNumber = {};
  existingOrders.forEach(o => {
    if (o.fields?.order_number) orderByNumber[o.fields.order_number] = o.id;
  });

  // ============ STEP 2: Build Client lookup from existing + sheet ============
  console.log('\n=== BUILDING CLIENT LOOKUPS ===');
  
  const clientByAdvisor = {};
  const clientByGroup = {};
  
  // From existing clients
  existingClients.forEach(c => {
    const advisor = str(c.fields?.advisor_name).toLowerCase();
    const group = str(c.fields?.group_name).toLowerCase();
    if (advisor) clientByAdvisor[advisor] = c.id;
    if (group) clientByGroup[group] = c.id;
  });
  
  // Import new clients from sheet
  const clientSheet = await fetchSheet(sheets, process.env.SHEET_ID_CLIENT_DICTIONARY, 'Sheet1!A:AK');
  const clientRows = clientSheet.slice(1).filter(r => r[0]);
  
  const newClientRecords = [];
  for (const row of clientRows) {
    const advisorName = str(row[0]);
    const groupName = str(row[1]);
    
    // Skip if already have this advisor
    if (clientByAdvisor[advisorName.toLowerCase()]) continue;
    
    const rec = {
      advisor_name: advisorName,
      group_name: groupName,
      business_name: str(row[5]),
      business_address: str(row[7]),
      business_city: str(row[8]),
      business_state: str(row[9]),
      mailer_return_address: str(row[10]),
      registration_phone: str(row[11]),
      main_contact_name: str(row[19]),
      main_contact_email: str(row[20]),
      main_contact_phone: str(row[21]),
      order_instructions: str(row[30]),
      direct_mailer_rate: parseMoney(row[31]),
      usual_mailing_quantity: parseInt(row[32]) || null,
      default_digital_budget: parseMoney(row[33]),
      client_notes: str(row[18])
    };
    
    // Link to group if exists
    if (groupName && groupByName[groupName.toLowerCase()]) {
      rec.group = [groupByName[groupName.toLowerCase()]];
    }
    
    newClientRecords.push(rec);
  }
  
  if (newClientRecords.length > 0) {
    const created = await batchCreate(T.Clients, newClientRecords);
    console.log(`  Created ${created.length} new clients`);
    created.forEach(c => {
      const advisor = str(c.fields?.advisor_name).toLowerCase();
      const group = str(c.fields?.group_name).toLowerCase();
      if (advisor) clientByAdvisor[advisor] = c.id;
      if (group) clientByGroup[group] = c.id;
    });
  }
  
  console.log(`  Lookups: ${Object.keys(clientByAdvisor).length} advisors, ${Object.keys(clientByGroup).length} groups`);

  // ============ STEP 3: Link Orders to Clients ============
  console.log('\n=== LINKING ORDERS TO CLIENTS ===');
  
  const orderUpdates = [];
  let linked = 0, unlinked = 0;
  
  for (const order of existingOrders) {
    if (order.fields?.client?.length > 0) continue; // Already linked
    
    // advisor field might be text or linked record - handle both
    const advisorRaw = order.fields?.advisor;
    const advisorField = (typeof advisorRaw === 'string' ? advisorRaw : '').toLowerCase().trim();
    const groupField = str(order.fields?.group_name).toLowerCase();
    
    // Try matching: group_name first, then advisor as group name
    let clientId = clientByGroup[groupField] || clientByGroup[advisorField] || clientByAdvisor[advisorField];
    
    if (clientId) {
      orderUpdates.push({ id: order.id, fields: { client: [clientId] } });
      linked++;
    } else {
      unlinked++;
      // Debug first few unlinked
      if (unlinked <= 3) {
        console.log(`  Unmatched: advisor="${advisorField}", group="${groupField}"`);
      }
    }
  }
  
  if (orderUpdates.length > 0) {
    await batchUpdate(T.Orders, orderUpdates);
  }
  console.log(`  Linked: ${linked}, Unlinked: ${unlinked}`);

  // ============ STEP 4: Import Digital Jobs with links ============
  console.log('\n=== IMPORTING DIGITAL JOBS ===');
  const digitalSheet = await fetchSheet(sheets, process.env.SHEET_ID_DIGITAL_JOBS, 'PMP Digital Jobs - Job Details!A:U');
  const digitalRows = digitalSheet.slice(1).filter(r => r[1]);
  
  const existingDigital = await getAllRecords(T.Digital_Jobs);
  const digitalByOrderNum = {};
  existingDigital.forEach(d => {
    if (d.fields?.order_number) digitalByOrderNum[d.fields.order_number] = d.id;
  });
  
  const digitalRecords = [];
  for (const row of digitalRows) {
    const orderNum = parseInt(row[20]) || null;
    if (orderNum && digitalByOrderNum[orderNum]) continue;
    
    const groupName = str(row[2]).toLowerCase();
    
    const rec = {
      order_number: orderNum,
      status: str(row[0]) || 'New',
      advisor_name: str(row[1]),
      group_name: str(row[2]),
      first_event_date: parseDate(row[3]),
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
    
    // Link to order
    if (orderNum && orderByNumber[orderNum]) {
      rec.order = [orderByNumber[orderNum]];
    }
    
    // Link to client
    if (clientByGroup[groupName]) {
      rec.client = [clientByGroup[groupName]];
    }
    
    digitalRecords.push(rec);
  }
  
  if (digitalRecords.length > 0) {
    const created = await batchCreate(T.Digital_Jobs, digitalRecords);
    console.log(`  Created ${created.length} digital jobs`);
  } else {
    console.log(`  No new digital jobs to create`);
  }

  // ============ STEP 5: Import Invoices with links ============
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
    if (orderNum && invoiceByOrderNum[orderNum]) continue;
    
    const groupName = str(row[3]).toLowerCase();
    
    const rec = {
      order_number: orderNum,
      status: str(row[0]) || 'Draft',
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
    
    // Link to order
    if (orderNum && orderByNumber[orderNum]) {
      rec.order = [orderByNumber[orderNum]];
    }
    
    // Link to client
    if (clientByGroup[groupName]) {
      rec.client = [clientByGroup[groupName]];
    }
    
    invoiceRecords.push(rec);
  }
  
  if (invoiceRecords.length > 0) {
    const created = await batchCreate(T.Invoices, invoiceRecords);
    console.log(`  Created ${created.length} invoices`);
  } else {
    console.log(`  No new invoices to create`);
  }

  // ============ STEP 6: Create sample Creatives ============
  console.log('\n=== CREATING CREATIVES ===');
  const existingCreatives = await getAllRecords(T.Creatives);
  if (existingCreatives.length === 0) {
    const creatives = [
      { name: 'Retirement 101 Postcard', code: 'R101', type: 'Postcard', topic: 'Retirement 101', active: true },
      { name: 'Wealth 101 Postcard', code: 'W101', type: 'Postcard', topic: 'Wealth 101', active: true },
      { name: 'Women Wine Wealth', code: 'WWW', type: 'Postcard', topic: 'Women Wine Wealth', active: true },
      { name: 'Social Security', code: 'SS', type: 'Postcard', topic: 'Social Security', active: true },
      { name: 'Tax Workshop', code: 'TAX', type: 'Postcard', topic: 'Taxes', active: true }
    ];
    const created = await batchCreate(T.Creatives, creatives);
    console.log(`  Created ${created.length} creatives`);
  } else {
    console.log(`  Already have ${existingCreatives.length} creatives`);
  }

  // ============ SUMMARY ============
  console.log('\n=== FINAL RECORD COUNTS ===');
  for (const [name, id] of Object.entries(T)) {
    const recs = await getAllRecords(id);
    const linkedCount = recs.filter(r => {
      const f = r.fields || {};
      return f.client?.length || f.order?.length || f.group?.length;
    }).length;
    console.log(`  ${name}: ${recs.length} records (${linkedCount} linked)`);
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
