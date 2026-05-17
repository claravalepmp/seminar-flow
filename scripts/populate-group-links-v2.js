#!/usr/bin/env node
/**
 * Populate Group links - handles field name variations (Group vs group)
 */

const AIRTABLE_PAT = 'patXfYHRo6qBwvdfN.e6adc9494afba663c10b9869a02a1ecccd45ac35d7a2ff16e70f6b3c9e0491fa';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  return res.json();
}

async function getAllRecords(tableId) {
  let records = [], offset = null;
  do {
    const data = await api(`/${BASE_ID}/${tableId}${offset ? '?offset=' + offset : ''}`);
    if (data.error) return records;
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function updateRecords(tableId, updates, fieldName = 'Group') {
  let success = 0;
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10).map(u => ({
      id: u.id,
      fields: { [fieldName]: u.groupId }
    }));
    const data = await api(`/${BASE_ID}/${tableId}`, 'PATCH', { records: chunk });
    if (!data.error) success += (data.records?.length || 0);
    await new Promise(r => setTimeout(r, 250));
  }
  return success;
}

// Get group link from record (handles Group or group field names)
function getGroupLink(record) {
  return record.fields.Group?.[0] || record.fields.group?.[0];
}

async function main() {
  console.log('=== Populating Group Links (v2) ===\n');

  // Load Groups
  const groups = await getAllRecords('Groups');
  const groupByName = {};
  groups.forEach(g => {
    const name = g.fields.Name?.toLowerCase().trim();
    if (name) groupByName[name] = g.id;
  });
  // Add variations for matching
  groups.forEach(g => {
    const name = g.fields.Name?.toLowerCase().trim() || '';
    if (name.includes('fta')) groupByName['fta'] = g.id;
    if (name.includes('sentinel')) {
      groupByName['sam ria'] = g.id;
      groupByName['sentinel asset management (sam ria)'] = g.id;
    }
  });
  console.log(`${groups.length} groups loaded\n`);

  // Build Region → Group map
  const regions = await getAllRecords('Regions');
  const regionToGroup = {};
  regions.forEach(r => {
    const gid = getGroupLink(r);
    if (gid) regionToGroup[r.id] = gid;
  });

  // 1. Link Clients → Groups (via group_name text)
  console.log('Linking Clients → Groups...');
  const clients = await getAllRecords('Clients');
  const clientToGroup = {};
  const clientUpdates = [];
  
  for (const c of clients) {
    const existing = getGroupLink(c);
    if (existing) {
      clientToGroup[c.id] = existing;
      continue;
    }
    const gname = c.fields.group_name?.toLowerCase().trim();
    if (gname && groupByName[gname]) {
      clientUpdates.push({ id: c.id, groupId: [groupByName[gname]] });
      clientToGroup[c.id] = groupByName[gname];
    }
  }
  
  // Try 'group' field first (lowercase), then 'Group'
  if (clientUpdates.length > 0) {
    let n = await updateRecords('Clients', clientUpdates, 'group');
    if (n === 0) n = await updateRecords('Clients', clientUpdates, 'Group');
    console.log(`   ✅ ${n} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // Rebuild map after updates
  const clientsAfter = await getAllRecords('Clients');
  clientsAfter.forEach(c => {
    const gid = getGroupLink(c);
    if (gid) clientToGroup[c.id] = gid;
  });
  console.log(`   ${Object.keys(clientToGroup).length}/${clients.length} clients have groups\n`);

  // 2. Link Orders (via client)
  console.log('Linking Orders → Groups...');
  const orders = await getAllRecords('Orders');
  const orderToGroup = {};
  const orderUpdates = [];
  
  for (const o of orders) {
    const existing = getGroupLink(o);
    if (existing) {
      orderToGroup[o.id] = existing;
      continue;
    }
    const clientId = o.fields.client?.[0];
    if (clientId && clientToGroup[clientId]) {
      orderUpdates.push({ id: o.id, groupId: [clientToGroup[clientId]] });
      orderToGroup[o.id] = clientToGroup[clientId];
    }
  }
  if (orderUpdates.length > 0) {
    const n = await updateRecords('Orders', orderUpdates);
    console.log(`   ✅ ${n} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // 3. Link Direct_Mail_Jobs (via Order)
  console.log('Linking Direct_Mail_Jobs → Groups...');
  const dmJobs = await getAllRecords('Direct_Mail_Jobs');
  const dmUpdates = [];
  for (const j of dmJobs) {
    if (getGroupLink(j)) continue;
    const orderId = j.fields.Order?.[0] || j.fields.order?.[0];
    if (orderId && orderToGroup[orderId]) {
      dmUpdates.push({ id: j.id, groupId: [orderToGroup[orderId]] });
    }
  }
  if (dmUpdates.length > 0) {
    const n = await updateRecords('Direct_Mail_Jobs', dmUpdates);
    console.log(`   ✅ ${n} linked\n`);
  } else {
    console.log(`   No updates needed\n`);
  }

  // 4. Link Digital_Jobs (via client)
  console.log('Linking Digital_Jobs → Groups...');
  const digJobs = await getAllRecords('Digital_Jobs');
  const digUpdates = [];
  for (const j of digJobs) {
    if (getGroupLink(j)) continue;
    const clientId = j.fields.client?.[0];
    if (clientId && clientToGroup[clientId]) {
      digUpdates.push({ id: j.id, groupId: [clientToGroup[clientId]] });
    }
  }
  if (digUpdates.length > 0) {
    const n = await updateRecords('Digital_Jobs', digUpdates);
    console.log(`   ✅ ${n} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // 5. Link Venues (via Region)
  console.log('Linking Venues → Groups...');
  const venues = await getAllRecords('Venues');
  const venueUpdates = [];
  for (const v of venues) {
    if (getGroupLink(v)) continue;
    const regionId = v.fields.Region?.[0];
    if (regionId && regionToGroup[regionId]) {
      venueUpdates.push({ id: v.id, groupId: [regionToGroup[regionId]] });
    }
  }
  if (venueUpdates.length > 0) {
    const n = await updateRecords('Venues', venueUpdates);
    console.log(`   ✅ ${n} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // Final status
  console.log('=== Final Status ===\n');
  const tables = [
    { name: 'Clients', field: 'group' },
    { name: 'Orders', field: 'Group' },
    { name: 'Invoices', field: 'Group' },
    { name: 'Digital_Jobs', field: 'Group' },
    { name: 'Direct_Mail_Jobs', field: 'Group' },
    { name: 'Events_v2', field: 'Group' },
    { name: 'Venues', field: 'Group' }
  ];
  
  for (const t of tables) {
    const recs = await getAllRecords(t.name);
    const linked = recs.filter(r => getGroupLink(r)).length;
    const pct = recs.length > 0 ? Math.round(linked / recs.length * 100) : 0;
    console.log(`${t.name.padEnd(18)} ${linked}/${recs.length} (${pct}%)`);
  }
}

main().catch(console.error);
