#!/usr/bin/env node
/**
 * Fix remaining unlinked records
 */

const AIRTABLE_PAT = 'patXfYHRo6qBwvdfN.e6adc9494afba663c10b9869a02a1ecccd45ac35d7a2ff16e70f6b3c9e0491fa';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  return res.json();
}

async function getAll(table) {
  let records = [], offset = null;
  do {
    const data = await api(`/${BASE_ID}/${encodeURIComponent(table)}${offset ? '?offset=' + offset : ''}`);
    if (data.error) return records;
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function update(table, updates, field = 'Group') {
  let success = 0;
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10).map(u => ({ id: u.id, fields: { [field]: Array.isArray(u.value) ? u.value : [u.value] } }));
    const data = await api(`/${BASE_ID}/${encodeURIComponent(table)}`, 'PATCH', { records: chunk });
    if (!data.error) success += (data.records?.length || 0);
    else console.log('   Error:', data.error.message || data.error);
    await new Promise(r => setTimeout(r, 250));
  }
  return success;
}

async function main() {
  console.log('=== Fixing Remaining Records ===\n');

  // Load Groups
  const groups = await getAll('Groups');
  const groupByName = {};
  groups.forEach(g => {
    const name = g.fields.Name?.toLowerCase().trim();
    if (name) groupByName[name] = g.id;
  });

  // 1. Fix Advisors - match by advisor_name to Group name
  console.log('1. Fixing Advisors...');
  const advisors = await getAll('Advisors');
  const advisorUpdates = [];
  
  for (const a of advisors) {
    if (a.fields.Group?.[0] || a.fields.group?.[0]) continue;
    
    const advisorName = (a.fields.advisor_name || '').toLowerCase().trim();
    const businessName = (a.fields.business_name || '').toLowerCase().trim();
    
    // Try exact match on advisor name
    for (const [gname, gid] of Object.entries(groupByName)) {
      if (advisorName && gname.includes(advisorName.split(' ')[0])) {
        advisorUpdates.push({ id: a.id, value: gid });
        console.log('   Match:', a.fields.advisor_name, '→', groups.find(g => g.id === gid)?.fields.Name);
        break;
      }
      if (businessName && gname.includes(businessName.split(' ')[0])) {
        advisorUpdates.push({ id: a.id, value: gid });
        console.log('   Match:', a.fields.advisor_name, '(biz:', businessName, ') →', groups.find(g => g.id === gid)?.fields.Name);
        break;
      }
    }
  }
  
  if (advisorUpdates.length > 0) {
    const n = await update('Advisors', advisorUpdates, 'group');
    console.log(`   ✅ Linked ${n}\n`);
  } else {
    console.log('   No matches\n');
  }

  // 2. Fix Regions - link "Main" and orphan regions
  console.log('2. Checking Regions...');
  const regions = await getAll('Regions');
  const unlinkedRegions = regions.filter(r => !r.fields.Group?.[0]);
  console.log('   Unlinked regions:', unlinkedRegions.map(r => r.fields.Name || r.fields.name).join(', '));
  console.log('   (Need manual assignment or deletion)\n');

  // 3. Fix Venues - match to regions by state/city
  console.log('3. Fixing Venues...');
  const venues = await getAll('Venues');
  const unlinkedVenues = venues.filter(v => !v.fields.Group?.[0] && !v.fields.Region?.[0]);
  
  // Build region lookup by state
  const regionByState = {};
  const regionToGroup = {};
  regions.forEach(r => {
    const state = r.fields.State || r.fields.state;
    if (state) {
      if (!regionByState[state.toUpperCase()]) regionByState[state.toUpperCase()] = [];
      regionByState[state.toUpperCase()].push(r);
    }
    if (r.fields.Group?.[0]) regionToGroup[r.id] = r.fields.Group[0];
  });

  const venueUpdates = [];
  for (const v of unlinkedVenues) {
    const state = v.fields.venue_state || v.fields.State || '';
    const stateRegions = regionByState[state.toUpperCase()];
    
    if (stateRegions && stateRegions.length === 1) {
      // Only one region for this state - assign it
      const region = stateRegions[0];
      if (regionToGroup[region.id]) {
        venueUpdates.push({ id: v.id, value: regionToGroup[region.id] });
      }
    }
  }
  
  if (venueUpdates.length > 0) {
    const n = await update('Venues', venueUpdates);
    console.log(`   ✅ Linked ${n} venues\n`);
  } else {
    console.log('   No automatic matches (venues span multiple regions per state)\n');
  }

  // 4. Link remaining Digital_Jobs and DM_Jobs via order number pattern
  console.log('4. Checking Digital_Jobs for order patterns...');
  const orders = await getAll('Orders');
  const orderByNumber = {};
  orders.forEach(o => {
    const num = o.fields.order_number || o.fields.Order_Number;
    if (num && (o.fields.Group?.[0])) {
      orderByNumber[String(num)] = o.fields.Group[0];
    }
  });

  const digitalJobs = await getAll('Digital_Jobs');
  const digUpdates = [];
  for (const j of digitalJobs) {
    if (j.fields.Group?.[0]) continue;
    const orderNum = j.fields.order_number;
    if (orderNum && orderByNumber[String(orderNum)]) {
      digUpdates.push({ id: j.id, value: orderByNumber[String(orderNum)] });
    }
  }
  if (digUpdates.length > 0) {
    const n = await update('Digital_Jobs', digUpdates);
    console.log(`   ✅ Linked ${n}\n`);
  } else {
    console.log('   No new matches\n');
  }

  // Final status
  console.log('=== Final Status ===\n');
  const tables = ['Advisors', 'Regions', 'Orders', 'Digital_Jobs', 'Direct_Mail_Jobs', 'Events_v2', 'Venues'];
  for (const t of tables) {
    const recs = await getAll(t);
    const linked = recs.filter(r => r.fields.Group?.[0] || r.fields.group?.[0]).length;
    const pct = recs.length > 0 ? Math.round(linked / recs.length * 100) : 0;
    const bar = '█'.repeat(Math.round(pct/10)) + '░'.repeat(10 - Math.round(pct/10));
    console.log(t.padEnd(18), (linked + '/' + recs.length).padEnd(10), bar, pct + '%');
  }
}

main().catch(console.error);
