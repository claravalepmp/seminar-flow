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

function clean(val) {
  if (Array.isArray(val)) val = val[0] || '';
  return String(val || '').trim().replace(/^"+|"+$/g, '');
}

async function main() {
  const sheets = await getSheets();
  
  // Get table IDs
  const meta = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${PAT}` }
  }).then(r => r.json());
  
  const T = {};
  meta.tables.forEach(t => T[t.name] = t.id);

  // Get existing orders
  console.log('=== LOADING ORDERS ===');
  const orders = await getAllRecords(T.Orders);
  const orderById = {};
  const orderByNumber = {};
  orders.forEach(o => {
    orderById[o.id] = o;
    if (o.fields?.order_number) orderByNumber[o.fields.order_number] = o.id;
  });
  console.log(`  ${orders.length} orders`);

  // Get existing creatives
  const creatives = await getAllRecords(T.Creatives);
  const creativeByCode = {};
  creatives.forEach(c => {
    if (c.fields?.code) creativeByCode[c.fields.code.toLowerCase()] = c.id;
  });

  // Create DM Jobs from orders that have mail info
  console.log('\n=== CREATING DIRECT MAIL JOBS ===');
  
  const existingDMJobs = await getAllRecords(T.Direct_Mail_Jobs);
  const dmJobByOrderNum = {};
  existingDMJobs.forEach(j => {
    if (j.fields?.order_number) dmJobByOrderNum[j.fields.order_number] = j.id;
  });
  
  const dmJobs = [];
  for (const order of orders) {
    const f = order.fields || {};
    const orderNum = f.order_number;
    
    if (!orderNum || dmJobByOrderNum[orderNum]) continue;
    if (!f.needs_direct_mail && !f.mailing_quantity) continue;
    
    const rec = {
      order_number: orderNum,
      job_name: `Order ${orderNum} - ${clean(f.advisor) || clean(f.group_name) || 'Unknown'}`,
      quantity: parseInt(f.mailing_quantity) || null,
      mail_date: parseDate(f.first_class_day),
      status: f.mail_status || 'Pending List',
      targeting_criteria: f.targeting_notes || '',
      order: [order.id]
    };
    
    // Link to creative if we can match
    const mailerType = clean(f.mailer_type).toLowerCase();
    if (mailerType.includes('r101') && creativeByCode['r101']) {
      rec.creative = [creativeByCode['r101']];
    } else if (mailerType.includes('w101') && creativeByCode['w101']) {
      rec.creative = [creativeByCode['w101']];
    }
    
    dmJobs.push(rec);
  }
  
  console.log(`  Jobs to create: ${dmJobs.length}`);
  if (dmJobs.length > 0) {
    const created = await batchCreate(T.Direct_Mail_Jobs, dmJobs);
    console.log(`  Created: ${created.length}`);
  }

  // ============ IMPROVE DIGITAL JOB LINKS ============
  console.log('\n=== IMPROVING DIGITAL JOB LINKS ===');
  
  const digitalJobs = await getAllRecords(T.Digital_Jobs);
  const unlinkedDigital = digitalJobs.filter(d => !d.fields?.order?.length);
  console.log(`  Unlinked digital jobs: ${unlinkedDigital.length}`);
  
  // Try to match by advisor + date
  const orderByAdvisorDate = {};
  for (const order of orders) {
    const f = order.fields || {};
    const advisor = clean(f.advisor || f.group_name).toLowerCase();
    const date = f.first_event_date;
    if (advisor && date) {
      orderByAdvisorDate[`${advisor}-${date}`] = order.id;
    }
  }
  
  const digitalUpdates = [];
  for (const job of unlinkedDigital) {
    const f = job.fields || {};
    const group = clean(f.group_name).toLowerCase();
    const advisor = clean(f.advisor_name).toLowerCase();
    const date = f.first_event_date;
    
    // Try group + date first
    let orderId = orderByAdvisorDate[`${group}-${date}`];
    if (!orderId) orderId = orderByAdvisorDate[`${advisor}-${date}`];
    
    if (orderId) {
      digitalUpdates.push({ id: job.id, fields: { order: [orderId] } });
    }
  }
  
  console.log(`  Matches found: ${digitalUpdates.length}`);
  if (digitalUpdates.length > 0) {
    await batchUpdate(T.Digital_Jobs, digitalUpdates);
    console.log(`  Updated`);
  }

  // ============ SUMMARY ============
  console.log('\n=== FINAL COUNTS ===');
  for (const name of ['Orders', 'Digital_Jobs', 'Direct_Mail_Jobs', 'Invoices']) {
    const recs = await getAllRecords(T[name]);
    const linked = recs.filter(r => r.fields?.order?.length).length;
    console.log(`  ${name}: ${recs.length} total, ${linked} linked to orders`);
  }
}

main().catch(console.error);
