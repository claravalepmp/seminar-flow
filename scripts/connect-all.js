#!/usr/bin/env node
/**
 * Connect ALL relationships:
 * - Clients → Venues (their locations)
 * - Clients → Charities (their charities)
 * - Clients → Events (their events)
 * - Groups → Venues, Charities, Events
 * - DM Jobs ↔ Digital Jobs (pair by order)
 */

const PAT = 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE = 'appeEmOJVXDJ0WPF4';

async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  return res.json();
}

async function getAllRecords(tableId) {
  let records = [], offset = null;
  do {
    const data = await api(`/${BASE}/${tableId}${offset ? '?offset=' + offset : ''}`);
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function updateBatch(tableId, updates) {
  for (let i = 0; i < updates.length; i += 10) {
    await api(`/${BASE}/${tableId}`, 'PATCH', { records: updates.slice(i, i + 10) });
    await new Promise(r => setTimeout(r, 200));
    process.stdout.write('.');
  }
}

async function addField(tableId, field) {
  const res = await api(`/meta/bases/${BASE}/tables/${tableId}/fields`, 'POST', field);
  if (res.error?.type === 'DUPLICATE_OR_EMPTY_FIELD_NAME') return null;
  if (res.error) console.log('  Field error:', res.error.message);
  return res;
}

async function main() {
  console.log('🔗 CONNECTING EVERYTHING\n');
  
  // Load all data
  console.log('Loading data...');
  const orders = await getAllRecords('tblXNAKyqUgfIMRO9');
  const events = await getAllRecords('tblgNThWU9ldC9o2T');
  const venues = await getAllRecords('tblNKGn5jq1yJlo9X');
  const clients = await getAllRecords('tblcDxT3ULNTGNo4v');
  const groups = await getAllRecords('tblYbSZsqlyB8yWMs');
  const charities = await getAllRecords('tbllO26JAPm3LXzbe');
  const dmJobs = await getAllRecords('tblaCaCZNeP59w3x4');
  const digitalJobs = await getAllRecords('tblpqN5H5or3bWzeb');
  const regions = await getAllRecords('tbl6zAmQvRL32KNvP');
  
  console.log(`  Orders: ${orders.length}, Events: ${events.length}, Venues: ${venues.length}`);
  console.log(`  Clients: ${clients.length}, Groups: ${groups.length}, Charities: ${charities.length}`);
  console.log(`  DM Jobs: ${dmJobs.length}, Digital Jobs: ${digitalJobs.length}`);
  
  // =============================================
  // 1. Add new link fields to Clients table
  // =============================================
  console.log('\n1️⃣  Adding link fields to Clients...');
  
  await addField('tblcDxT3ULNTGNo4v', {
    name: 'Venues',
    type: 'multipleRecordLinks',
    options: { linkedTableId: 'tblNKGn5jq1yJlo9X' }
  });
  
  await addField('tblcDxT3ULNTGNo4v', {
    name: 'Charities',
    type: 'multipleRecordLinks',
    options: { linkedTableId: 'tbllO26JAPm3LXzbe' }
  });
  
  await addField('tblcDxT3ULNTGNo4v', {
    name: 'Events',
    type: 'multipleRecordLinks',
    options: { linkedTableId: 'tblgNThWU9ldC9o2T' }
  });
  
  // =============================================
  // 2. Add link fields to Groups table
  // =============================================
  console.log('\n2️⃣  Adding link fields to Groups...');
  
  await addField('tblYbSZsqlyB8yWMs', {
    name: 'Venues',
    type: 'multipleRecordLinks',
    options: { linkedTableId: 'tblNKGn5jq1yJlo9X' }
  });
  
  await addField('tblYbSZsqlyB8yWMs', {
    name: 'Charities',
    type: 'multipleRecordLinks',
    options: { linkedTableId: 'tbllO26JAPm3LXzbe' }
  });
  
  await addField('tblYbSZsqlyB8yWMs', {
    name: 'Events',
    type: 'multipleRecordLinks',
    options: { linkedTableId: 'tblgNThWU9ldC9o2T' }
  });
  
  // =============================================
  // 3. Build relationship maps
  // =============================================
  console.log('\n3️⃣  Building relationship maps...');
  
  // Client → Orders → Events/Venues/Charities
  const clientOrders = {};
  const clientVenues = {};
  const clientCharities = {};
  const clientEvents = {};
  
  // Map orders to clients
  orders.forEach(o => {
    const clientIds = o.fields.client || [];
    clientIds.forEach(cid => {
      if (!clientOrders[cid]) clientOrders[cid] = [];
      clientOrders[cid].push(o.id);
    });
  });
  
  // Map events to clients through orders
  events.forEach(e => {
    const orderIds = e.fields.Order || [];
    orderIds.forEach(oid => {
      const order = orders.find(o => o.id === oid);
      if (order) {
        const clientIds = order.fields.client || [];
        const venueIds = e.fields.Venue || [];
        const charityIds = order.fields.Charity || [];
        
        clientIds.forEach(cid => {
          if (!clientEvents[cid]) clientEvents[cid] = new Set();
          if (!clientVenues[cid]) clientVenues[cid] = new Set();
          if (!clientCharities[cid]) clientCharities[cid] = new Set();
          
          clientEvents[cid].add(e.id);
          venueIds.forEach(vid => clientVenues[cid].add(vid));
          charityIds.forEach(chid => clientCharities[cid].add(chid));
        });
      }
    });
  });
  
  // Also add charities from orders directly
  orders.forEach(o => {
    const clientIds = o.fields.client || [];
    const charityIds = o.fields.Charity || [];
    clientIds.forEach(cid => {
      if (!clientCharities[cid]) clientCharities[cid] = new Set();
      charityIds.forEach(chid => clientCharities[cid].add(chid));
    });
  });
  
  console.log(`  Clients with events: ${Object.keys(clientEvents).length}`);
  console.log(`  Clients with venues: ${Object.keys(clientVenues).length}`);
  console.log(`  Clients with charities: ${Object.keys(clientCharities).length}`);
  
  // =============================================
  // 4. Update Clients with their Venues/Charities/Events
  // =============================================
  console.log('\n4️⃣  Linking Clients to Venues/Charities/Events...');
  
  const clientUpdates = [];
  for (const client of clients) {
    const updates = {};
    
    const venueIds = clientVenues[client.id];
    if (venueIds?.size > 0) {
      updates.Venues = [...venueIds];
    }
    
    const charityIds = clientCharities[client.id];
    if (charityIds?.size > 0) {
      updates.Charities = [...charityIds];
    }
    
    const eventIds = clientEvents[client.id];
    if (eventIds?.size > 0) {
      updates.Events = [...eventIds];
    }
    
    if (Object.keys(updates).length > 0) {
      clientUpdates.push({ id: client.id, fields: updates });
    }
  }
  
  console.log(`  Clients to update: ${clientUpdates.length}`);
  if (clientUpdates.length > 0) {
    process.stdout.write('  Updating');
    await updateBatch('tblcDxT3ULNTGNo4v', clientUpdates);
    console.log(' Done!');
  }
  
  // =============================================
  // 5. Build Group relationships (through Clients)
  // =============================================
  console.log('\n5️⃣  Linking Groups to Venues/Charities/Events...');
  
  const groupVenues = {};
  const groupCharities = {};
  const groupEvents = {};
  
  // Map through clients
  clients.forEach(c => {
    const groupIds = c.fields.group || [];
    const cid = c.id;
    
    groupIds.forEach(gid => {
      if (!groupVenues[gid]) groupVenues[gid] = new Set();
      if (!groupCharities[gid]) groupCharities[gid] = new Set();
      if (!groupEvents[gid]) groupEvents[gid] = new Set();
      
      clientVenues[cid]?.forEach(vid => groupVenues[gid].add(vid));
      clientCharities[cid]?.forEach(chid => groupCharities[gid].add(chid));
      clientEvents[cid]?.forEach(eid => groupEvents[gid].add(eid));
    });
  });
  
  const groupUpdates = [];
  for (const group of groups) {
    const updates = {};
    
    if (groupVenues[group.id]?.size > 0) {
      updates.Venues = [...groupVenues[group.id]];
    }
    if (groupCharities[group.id]?.size > 0) {
      updates.Charities = [...groupCharities[group.id]];
    }
    if (groupEvents[group.id]?.size > 0) {
      updates.Events = [...groupEvents[group.id]];
    }
    
    if (Object.keys(updates).length > 0) {
      groupUpdates.push({ id: group.id, fields: updates });
    }
  }
  
  console.log(`  Groups to update: ${groupUpdates.length}`);
  if (groupUpdates.length > 0) {
    process.stdout.write('  Updating');
    await updateBatch('tblYbSZsqlyB8yWMs', groupUpdates);
    console.log(' Done!');
  }
  
  // =============================================
  // 6. Add link field for DM ↔ Digital pairing
  // =============================================
  console.log('\n6️⃣  Adding DM ↔ Digital Job pairing field...');
  
  await addField('tblaCaCZNeP59w3x4', {
    name: 'Digital_Job',
    type: 'multipleRecordLinks',
    options: { linkedTableId: 'tblpqN5H5or3bWzeb' }
  });
  
  // =============================================
  // 7. Pair DM Jobs with Digital Jobs by order
  // =============================================
  console.log('\n7️⃣  Pairing DM Jobs with Digital Jobs...');
  
  // Build digital job lookup by order
  const digitalByOrder = {};
  digitalJobs.forEach(dj => {
    const orderIds = dj.fields.order || [];
    orderIds.forEach(oid => {
      if (!digitalByOrder[oid]) digitalByOrder[oid] = [];
      digitalByOrder[oid].push(dj.id);
    });
  });
  
  const dmUpdates = [];
  for (const dm of dmJobs) {
    const orderIds = dm.fields.order || [];
    const digitalIds = [];
    
    orderIds.forEach(oid => {
      const djIds = digitalByOrder[oid] || [];
      digitalIds.push(...djIds);
    });
    
    if (digitalIds.length > 0) {
      dmUpdates.push({ id: dm.id, fields: { Digital_Job: digitalIds } });
    }
  }
  
  console.log(`  DM jobs to pair: ${dmUpdates.length}`);
  if (dmUpdates.length > 0) {
    process.stdout.write('  Updating');
    await updateBatch('tblaCaCZNeP59w3x4', dmUpdates);
    console.log(' Done!');
  }
  
  // =============================================
  // 8. Link Events to Clients directly
  // =============================================
  console.log('\n8️⃣  Adding Client link to Events...');
  
  await addField('tblgNThWU9ldC9o2T', {
    name: 'Client',
    type: 'multipleRecordLinks',
    options: { linkedTableId: 'tblcDxT3ULNTGNo4v' }
  });
  
  // Build event → client map
  const eventClients = {};
  events.forEach(e => {
    const orderIds = e.fields.Order || [];
    orderIds.forEach(oid => {
      const order = orders.find(o => o.id === oid);
      if (order?.fields.client) {
        if (!eventClients[e.id]) eventClients[e.id] = new Set();
        order.fields.client.forEach(cid => eventClients[e.id].add(cid));
      }
    });
  });
  
  const eventUpdates = [];
  for (const [eventId, clientIds] of Object.entries(eventClients)) {
    if (clientIds.size > 0) {
      eventUpdates.push({ id: eventId, fields: { Client: [...clientIds] } });
    }
  }
  
  console.log(`  Events to update: ${eventUpdates.length}`);
  if (eventUpdates.length > 0) {
    process.stdout.write('  Updating');
    await updateBatch('tblgNThWU9ldC9o2T', eventUpdates);
    console.log(' Done!');
  }
  
  console.log('\n✅ ALL CONNECTIONS COMPLETE');
}

main().catch(e => console.error('Error:', e.message));
