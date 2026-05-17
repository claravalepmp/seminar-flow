require('dotenv').config({ path: '.env.local' });

const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(path) {
  const resp = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, {
    headers: { 'Authorization': `Bearer ${PAT}` }
  });
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

async function main() {
  // Get table IDs
  const meta = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${PAT}` }
  }).then(r => r.json());
  
  const T = {};
  meta.tables.forEach(t => T[t.name] = t.id);

  // Sample orders
  console.log('=== SAMPLE ORDERS ===');
  const orders = await getAllRecords(T.Orders);
  orders.slice(0, 5).forEach(o => {
    const f = o.fields;
    console.log(`  #${f.order_number}: advisor="${f.advisor}" group="${f.group_name}" date="${f.first_event_date}"`);
  });

  // Sample digital jobs
  console.log('\n=== SAMPLE DIGITAL JOBS ===');
  const digitalJobs = await getAllRecords(T.Digital_Jobs);
  digitalJobs.slice(0, 5).forEach(d => {
    const f = d.fields;
    console.log(`  #${f.order_number}: advisor="${f.advisor_name}" group="${f.group_name}" date="${f.first_event_date}"`);
  });

  // Check order numbers
  console.log('\n=== ORDER NUMBER ANALYSIS ===');
  const orderNums = new Set(orders.map(o => o.fields?.order_number).filter(Boolean));
  const digitalOrderNums = digitalJobs.map(d => d.fields?.order_number).filter(Boolean);
  const matchingNums = digitalOrderNums.filter(n => orderNums.has(n));
  console.log(`  Orders with numbers: ${orderNums.size}`);
  console.log(`  Digital jobs with order_number: ${digitalOrderNums.length}`);
  console.log(`  Matching order numbers: ${matchingNums.length}`);
  
  // Show some that should match
  console.log('\n=== POTENTIAL MATCHES ===');
  const orderByNum = {};
  orders.forEach(o => { if (o.fields?.order_number) orderByNum[o.fields.order_number] = o; });
  
  let shown = 0;
  for (const dj of digitalJobs) {
    if (shown >= 3) break;
    const num = dj.fields?.order_number;
    if (num && orderByNum[num]) {
      console.log(`  Digital #${num}: "${dj.fields?.group_name}" date=${dj.fields?.first_event_date}`);
      console.log(`  Order #${num}: advisor="${orderByNum[num].fields?.advisor}" date=${orderByNum[num].fields?.first_event_date}`);
      console.log('');
      shown++;
    }
  }
}

main().catch(console.error);
