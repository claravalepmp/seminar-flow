#!/usr/bin/env node
/**
 * Populate Group links throughout all tables
 */

const AIRTABLE_PAT = 'patXfYHRo6qBwvdfN.e6adc9494afba663c10b9869a02a1ecccd45ac35d7a2ff16e70f6b3c9e0491fa';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(endpoint, method = 'GET', body = null) {
  const opts = { 
    method, 
    headers: { 
      'Authorization': `Bearer ${AIRTABLE_PAT}`, 
      'Content-Type': 'application/json' 
    } 
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  return res.json();
}

async function getAllRecords(tableId) {
  let records = [], offset = null;
  do {
    const data = await api(`/${BASE_ID}/${tableId}${offset ? '?offset=' + offset : ''}`);
    if (data.error) {
      console.error(`Error fetching ${tableId}:`, data.error);
      return records;
    }
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function updateRecords(tableId, updates) {
  let success = 0, failed = 0;
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    const data = await api(`/${BASE_ID}/${tableId}`, 'PATCH', { records: chunk });
    if (data.error) {
      console.error(`   Error: ${data.error.message || JSON.stringify(data.error)}`);
      failed += chunk.length;
    } else {
      success += (data.records?.length || 0);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return { success, failed };
}

async function main() {
  console.log('=== Populating Group Links ===\n');

  // 1. Load Groups
  console.log('Loading Groups...');
  const groups = await getAllRecords('Groups');
  const groupByName = {};
  groups.forEach(g => {
    const name = g.fields.Name?.toLowerCase().trim();
    if (name) {
      groupByName[name] = g.id;
      // Common variations
      if (name.includes('fta') || name.includes('financial & tax')) groupByName['fta'] = g.id;
      if (name.includes('sam') || name.includes('sentinel')) groupByName['sam ria'] = g.id;
      if (name.includes('sentinel asset management')) groupByName['sentinel asset management (sam ria)'] = g.id;
    }
  });
  console.log(`   ${groups.length} groups loaded\n`);

  // 2. Load Regions → Group mapping
  console.log('Building Region → Group map...');
  const regions = await getAllRecords('Regions');
  const regionToGroup = {};
  regions.forEach(r => {
    if (r.fields.Group?.[0]) {
      regionToGroup[r.id] = r.fields.Group[0];
    }
  });
  console.log(`   ${Object.keys(regionToGroup).length}/${regions.length} regions mapped\n`);

  // 3. Link Clients to Groups (via group_name text field)
  console.log('Linking Clients → Groups...');
  const clients = await getAllRecords('Clients');
  const clientUpdates = [];
  const clientToGroup = {};
  
  for (const c of clients) {
    const hasGroup = c.fields.Group?.[0];
    const groupName = c.fields.group_name?.toLowerCase().trim();
    
    if (hasGroup) {
      clientToGroup[c.id] = c.fields.Group[0];
    } else if (groupName) {
      const groupId = groupByName[groupName];
      if (groupId) {
        clientUpdates.push({ id: c.id, fields: { Group: [groupId] } });
        clientToGroup[c.id] = groupId;
      }
    }
  }
  
  if (clientUpdates.length > 0) {
    const r = await updateRecords('Clients', clientUpdates);
    console.log(`   ✅ ${r.success} linked, ${r.failed} failed\n`);
  } else {
    console.log(`   Already linked or no group_name\n`);
  }

  // Rebuild clientToGroup after updates
  const clientsAfter = await getAllRecords('Clients');
  clientsAfter.forEach(c => {
    if (c.fields.Group?.[0]) clientToGroup[c.id] = c.fields.Group[0];
  });
  console.log(`   ${Object.keys(clientToGroup).length} clients have groups\n`);

  // 4. Link Venues → Groups (via Region)
  console.log('Linking Venues → Groups...');
  const venues = await getAllRecords('Venues');
  const venueUpdates = [];
  for (const v of venues) {
    if (v.fields.Group?.[0]) continue;
    const regionId = v.fields.Region?.[0];
    if (regionId && regionToGroup[regionId]) {
      venueUpdates.push({ id: v.id, fields: { Group: [regionToGroup[regionId]] } });
    }
  }
  if (venueUpdates.length > 0) {
    const r = await updateRecords('Venues', venueUpdates);
    console.log(`   ✅ ${r.success} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // 5. Link Orders → Groups (via client field)
  console.log('Linking Orders → Groups...');
  const orders = await getAllRecords('Orders');
  const orderUpdates = [];
  const orderToGroup = {};
  
  for (const o of orders) {
    if (o.fields.Group?.[0]) {
      orderToGroup[o.id] = o.fields.Group[0];
      continue;
    }
    const clientId = o.fields.client?.[0];
    if (clientId && clientToGroup[clientId]) {
      orderUpdates.push({ id: o.id, fields: { Group: [clientToGroup[clientId]] } });
      orderToGroup[o.id] = clientToGroup[clientId];
    }
  }
  if (orderUpdates.length > 0) {
    const r = await updateRecords('Orders', orderUpdates);
    console.log(`   ✅ ${r.success} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // 6. Link Invoices → Groups
  console.log('Linking Invoices → Groups...');
  const invoices = await getAllRecords('Invoices');
  const invUpdates = [];
  for (const i of invoices) {
    if (i.fields.Group?.[0]) continue;
    const clientId = i.fields.client?.[0];
    if (clientId && clientToGroup[clientId]) {
      invUpdates.push({ id: i.id, fields: { Group: [clientToGroup[clientId]] } });
    }
  }
  if (invUpdates.length > 0) {
    const r = await updateRecords('Invoices', invUpdates);
    console.log(`   ✅ ${r.success} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // 7. Link Digital_Jobs → Groups
  console.log('Linking Digital_Jobs → Groups...');
  const digitalJobs = await getAllRecords('Digital_Jobs');
  const digUpdates = [];
  for (const j of digitalJobs) {
    if (j.fields.Group?.[0]) continue;
    const clientId = j.fields.client?.[0];
    if (clientId && clientToGroup[clientId]) {
      digUpdates.push({ id: j.id, fields: { Group: [clientToGroup[clientId]] } });
    }
  }
  if (digUpdates.length > 0) {
    const r = await updateRecords('Digital_Jobs', digUpdates);
    console.log(`   ✅ ${r.success} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // 8. Link Direct_Mail_Jobs → Groups (via Order)
  console.log('Linking Direct_Mail_Jobs → Groups...');
  const dmJobs = await getAllRecords('Direct_Mail_Jobs');
  const dmUpdates = [];
  for (const j of dmJobs) {
    if (j.fields.Group?.[0]) continue;
    const orderId = j.fields.Order?.[0];
    if (orderId && orderToGroup[orderId]) {
      dmUpdates.push({ id: j.id, fields: { Group: [orderToGroup[orderId]] } });
    }
  }
  if (dmUpdates.length > 0) {
    const r = await updateRecords('Direct_Mail_Jobs', dmUpdates);
    console.log(`   ✅ ${r.success} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // 9. Link Events_v2 → Groups (via Order or client field)
  console.log('Linking Events_v2 → Groups...');
  const events = await getAllRecords('Events_v2');
  const evtUpdates = [];
  for (const e of events) {
    if (e.fields.Group?.[0]) continue;
    // Try Order first
    const orderId = e.fields.Order?.[0];
    if (orderId && orderToGroup[orderId]) {
      evtUpdates.push({ id: e.id, fields: { Group: [orderToGroup[orderId]] } });
      continue;
    }
    // Try client field
    const clientId = e.fields.Client?.[0] || e.fields.client?.[0];
    if (clientId && clientToGroup[clientId]) {
      evtUpdates.push({ id: e.id, fields: { Group: [clientToGroup[clientId]] } });
    }
  }
  if (evtUpdates.length > 0) {
    const r = await updateRecords('Events_v2', evtUpdates);
    console.log(`   ✅ ${r.success} linked\n`);
  } else {
    console.log(`   Already linked\n`);
  }

  // 10. Link Charities → Groups (via Region)
  console.log('Linking Charities → Groups...');
  const charities = await getAllRecords('Charities');
  const charUpdates = [];
  for (const c of charities) {
    if (c.fields.Group?.[0]) continue;
    const regionId = c.fields.Region?.[0] || c.fields.region?.[0];
    if (regionId && regionToGroup[regionId]) {
      charUpdates.push({ id: c.id, fields: { Group: [regionToGroup[regionId]] } });
    }
  }
  if (charUpdates.length > 0) {
    const r = await updateRecords('Charities', charUpdates);
    console.log(`   ✅ ${r.success} linked\n`);
  } else {
    console.log(`   Already linked or no region\n`);
  }

  console.log('=== Done! ===');
}

main().catch(console.error);
