require('dotenv').config({ path: '.env.local' });

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

async function batchUpdate(tableId, updates) {
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const data = await api(tableId, 'PATCH', { records: batch });
    if (data.error) console.log(`  Error: ${data.error.message}`);
  }
}

function normalize(str) {
  return String(str || '').toLowerCase().trim()
    .replace(/[^a-z0-9]/g, '');
}

async function main() {
  const meta = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${PAT}` }
  }).then(r => r.json());
  
  const T = {};
  meta.tables.forEach(t => T[t.name] = t.id);

  // Load orders
  console.log('=== LOADING DATA ===');
  const orders = await getAllRecords(T.Orders);
  console.log(`  Orders: ${orders.length}`);
  
  // Build order lookup by group + month-day
  const orderLookup = {};
  const orderByNumber = {};
  
  for (const o of orders) {
    const f = o.fields || {};
    if (f.order_number) orderByNumber[f.order_number] = o.id;
    
    const group = normalize(f.group_name);
    const date = f.first_event_date;
    if (group && date) {
      // Use month-day only (ignore year since digital jobs have wrong year)
      const monthDay = date.slice(5); // "MM-DD"
      const key = `${group}-${monthDay}`;
      orderLookup[key] = o.id;
    }
  }
  console.log(`  Order keys: ${Object.keys(orderLookup).length}`);

  // Load digital jobs
  const digitalJobs = await getAllRecords(T.Digital_Jobs);
  const unlinked = digitalJobs.filter(d => !d.fields?.order?.length);
  console.log(`  Digital jobs: ${digitalJobs.length}, unlinked: ${unlinked.length}`);

  // Match and update
  console.log('\n=== MATCHING ===');
  const updates = [];
  let byNumber = 0, byGroupDate = 0;
  
  for (const dj of unlinked) {
    const f = dj.fields || {};
    let orderId = null;
    
    // Try order_number first
    if (f.order_number && orderByNumber[f.order_number]) {
      orderId = orderByNumber[f.order_number];
      byNumber++;
    }
    
    // Try group + month-day
    if (!orderId && f.first_event_date) {
      const group = normalize(f.group_name);
      const monthDay = f.first_event_date.slice(5);
      const key = `${group}-${monthDay}`;
      if (orderLookup[key]) {
        orderId = orderLookup[key];
        byGroupDate++;
      }
    }
    
    if (orderId) {
      updates.push({ id: dj.id, fields: { order: [orderId] } });
    }
  }
  
  console.log(`  Matched by order_number: ${byNumber}`);
  console.log(`  Matched by group+date: ${byGroupDate}`);
  console.log(`  Total to update: ${updates.length}`);
  
  if (updates.length > 0) {
    console.log('\n=== UPDATING ===');
    await batchUpdate(T.Digital_Jobs, updates);
    console.log('  Done');
  }

  // Summary
  console.log('\n=== FINAL COUNTS ===');
  const finalDigital = await getAllRecords(T.Digital_Jobs);
  const linked = finalDigital.filter(d => d.fields?.order?.length).length;
  console.log(`  Digital Jobs: ${finalDigital.length} total, ${linked} linked`);
}

main().catch(console.error);
