#!/usr/bin/env node
/**
 * Maximize all Airtable connections:
 * 1. Clients → Venues (via Orders → Events → Venues)
 * 2. Clients → Charities (via Orders → Charities)  
 * 3. Clients → Events (via Orders → Events)
 * 4. Groups → Venues, Charities, Events (via Clients)
 * 5. Pair Direct Mail ↔ Digital Jobs
 */

const AIRTABLE_PAT = 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

const TABLES = {
  Clients: 'tblcDxT3ULNTGNo4v',
  Groups: 'tblYbSZsqlyB8yWMs',
  Orders: 'tblXNAKyqUgfIMRO9',
  Events: 'tblgNThWU9ldC9o2T',
  Venues: 'tblNKGn5jq1yJlo9X',
  Charities: 'tbllO26JAPm3LXzbe',
  DM_Jobs: 'tblaCaCZNeP59w3x4',
  Digital_Jobs: 'tblpqN5H5or3bWzeb'
};

async function airtableRequest(endpoint, options = {}) {
  const url = `https://api.airtable.com/v0/${BASE_ID}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Airtable error: ${response.status} - ${err}`);
  }
  return response.json();
}

async function getAllRecords(tableId, fields = []) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams();
    if (fields.length) params.append('fields[]', fields.join('&fields[]='));
    if (offset) params.append('offset', offset);
    const url = `/${tableId}?${params}`;
    const data = await airtableRequest(url);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function updateRecords(tableId, updates) {
  const results = [];
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    const data = await airtableRequest(`/${tableId}`, {
      method: 'PATCH',
      body: JSON.stringify({ records: batch })
    });
    results.push(...data.records);
    if (i + 10 < updates.length) await new Promise(r => setTimeout(r, 250));
  }
  return results;
}

// Check if field exists
async function getTableFields(tableId) {
  const data = await airtableRequest(`/${tableId}?maxRecords=1`);
  if (data.records.length > 0) {
    return Object.keys(data.records[0].fields);
  }
  return [];
}

async function main() {
  console.log('🔗 MAXIMIZING ALL CONNECTIONS\n');
  console.log('='.repeat(50));

  // Load all data
  console.log('\n📊 Loading all data...');
  const [clients, groups, orders, events, venues, charities, dmJobs, digitalJobs] = await Promise.all([
    getAllRecords(TABLES.Clients),
    getAllRecords(TABLES.Groups),
    getAllRecords(TABLES.Orders),
    getAllRecords(TABLES.Events),
    getAllRecords(TABLES.Venues),
    getAllRecords(TABLES.Charities),
    getAllRecords(TABLES.DM_Jobs),
    getAllRecords(TABLES.Digital_Jobs)
  ]);

  console.log(`  Clients: ${clients.length}`);
  console.log(`  Groups: ${groups.length}`);
  console.log(`  Orders: ${orders.length}`);
  console.log(`  Events: ${events.length}`);
  console.log(`  Venues: ${venues.length}`);
  console.log(`  Charities: ${charities.length}`);
  console.log(`  DM Jobs: ${dmJobs.length}`);
  console.log(`  Digital Jobs: ${digitalJobs.length}`);

  // Build lookup maps
  const orderById = new Map(orders.map(o => [o.id, o]));
  const eventById = new Map(events.map(e => [e.id, e]));
  const venueById = new Map(venues.map(v => [v.id, v]));
  const charityById = new Map(charities.map(c => [c.id, c]));

  // ═══════════════════════════════════════════════════════════
  // 1. CONNECT CLIENTS TO VENUES
  // ═══════════════════════════════════════════════════════════
  console.log('\n🏢 Connecting Clients → Venues...');
  
  // Build client → venues map through orders → events → venues
  const clientVenuesMap = new Map();
  
  for (const order of orders) {
    const clientIds = order.fields.client || [];
    const eventIds = order.fields.Events_v2 || [];
    
    for (const clientId of clientIds) {
      if (!clientVenuesMap.has(clientId)) clientVenuesMap.set(clientId, new Set());
      
      for (const eventId of eventIds) {
        const event = eventById.get(eventId);
        if (event?.fields.Venue) {
          for (const venueId of event.fields.Venue) {
            clientVenuesMap.get(clientId).add(venueId);
          }
        }
      }
    }
  }

  // Check if Clients table has Venues field
  const clientFields = await getTableFields(TABLES.Clients);
  const hasClientVenuesField = clientFields.some(f => f.toLowerCase().includes('venue'));
  
  if (hasClientVenuesField) {
    const clientVenueUpdates = [];
    for (const [clientId, venueSet] of clientVenuesMap) {
      if (venueSet.size > 0) {
        clientVenueUpdates.push({
          id: clientId,
          fields: { Venues: [...venueSet] }
        });
      }
    }
    if (clientVenueUpdates.length > 0) {
      await updateRecords(TABLES.Clients, clientVenueUpdates);
      console.log(`  ✓ Linked ${clientVenueUpdates.length} clients to their venues`);
    }
  } else {
    console.log(`  ⚠ No "Venues" link field on Clients - need to create via UI`);
    console.log(`  → ${clientVenuesMap.size} clients have venues to link`);
  }

  // ═══════════════════════════════════════════════════════════
  // 2. CONNECT CLIENTS TO CHARITIES
  // ═══════════════════════════════════════════════════════════
  console.log('\n🎗️ Connecting Clients → Charities...');
  
  const clientCharitiesMap = new Map();
  
  for (const order of orders) {
    const clientIds = order.fields.client || [];
    const charityIds = order.fields.Charity || [];
    
    for (const clientId of clientIds) {
      if (!clientCharitiesMap.has(clientId)) clientCharitiesMap.set(clientId, new Set());
      for (const charityId of charityIds) {
        clientCharitiesMap.get(clientId).add(charityId);
      }
    }
  }

  const hasClientCharitiesField = clientFields.some(f => f.toLowerCase().includes('charit'));
  
  if (hasClientCharitiesField) {
    const clientCharityUpdates = [];
    for (const [clientId, charitySet] of clientCharitiesMap) {
      if (charitySet.size > 0) {
        clientCharityUpdates.push({
          id: clientId,
          fields: { Charities: [...charitySet] }
        });
      }
    }
    if (clientCharityUpdates.length > 0) {
      await updateRecords(TABLES.Clients, clientCharityUpdates);
      console.log(`  ✓ Linked ${clientCharityUpdates.length} clients to charities`);
    }
  } else {
    console.log(`  ⚠ No "Charities" link field on Clients - need to create via UI`);
    console.log(`  → ${[...clientCharitiesMap.values()].filter(s => s.size > 0).length} clients have charities to link`);
  }

  // ═══════════════════════════════════════════════════════════
  // 3. CONNECT CLIENTS TO EVENTS
  // ═══════════════════════════════════════════════════════════
  console.log('\n📅 Connecting Clients → Events...');
  
  const clientEventsMap = new Map();
  
  for (const order of orders) {
    const clientIds = order.fields.client || [];
    const eventIds = order.fields.Events_v2 || [];
    
    for (const clientId of clientIds) {
      if (!clientEventsMap.has(clientId)) clientEventsMap.set(clientId, new Set());
      for (const eventId of eventIds) {
        clientEventsMap.get(clientId).add(eventId);
      }
    }
  }

  const hasClientEventsField = clientFields.some(f => f.toLowerCase().includes('event'));
  
  if (hasClientEventsField) {
    const clientEventUpdates = [];
    for (const [clientId, eventSet] of clientEventsMap) {
      if (eventSet.size > 0) {
        clientEventUpdates.push({
          id: clientId,
          fields: { Events: [...eventSet] }
        });
      }
    }
    if (clientEventUpdates.length > 0) {
      await updateRecords(TABLES.Clients, clientEventUpdates);
      console.log(`  ✓ Linked ${clientEventUpdates.length} clients to events`);
    }
  } else {
    console.log(`  ⚠ No "Events" link field on Clients`);
    console.log(`  → ${clientEventsMap.size} clients have events to link`);
  }

  // ═══════════════════════════════════════════════════════════
  // 4. CONNECT GROUPS TO VENUES/CHARITIES/EVENTS
  // ═══════════════════════════════════════════════════════════
  console.log('\n👥 Connecting Groups → Venues/Charities/Events...');
  
  // Build group → client map
  const groupClientsMap = new Map();
  for (const client of clients) {
    const groupIds = client.fields.Group || [];
    for (const groupId of groupIds) {
      if (!groupClientsMap.has(groupId)) groupClientsMap.set(groupId, []);
      groupClientsMap.get(groupId).push(client.id);
    }
  }

  // Aggregate venues/charities/events from clients to groups
  const groupVenuesMap = new Map();
  const groupCharitiesMap = new Map();
  const groupEventsMap = new Map();

  for (const [groupId, clientIds] of groupClientsMap) {
    groupVenuesMap.set(groupId, new Set());
    groupCharitiesMap.set(groupId, new Set());
    groupEventsMap.set(groupId, new Set());
    
    for (const clientId of clientIds) {
      const clientVenues = clientVenuesMap.get(clientId) || new Set();
      const clientCharities = clientCharitiesMap.get(clientId) || new Set();
      const clientEvents = clientEventsMap.get(clientId) || new Set();
      
      for (const v of clientVenues) groupVenuesMap.get(groupId).add(v);
      for (const c of clientCharities) groupCharitiesMap.get(groupId).add(c);
      for (const e of clientEvents) groupEventsMap.get(groupId).add(e);
    }
  }

  const groupFields = await getTableFields(TABLES.Groups);
  console.log(`  Group fields: ${groupFields.slice(0, 10).join(', ')}...`);
  
  let groupsWithVenues = [...groupVenuesMap.values()].filter(s => s.size > 0).length;
  let groupsWithCharities = [...groupCharitiesMap.values()].filter(s => s.size > 0).length;
  let groupsWithEvents = [...groupEventsMap.values()].filter(s => s.size > 0).length;
  
  console.log(`  → ${groupsWithVenues} groups have venues`);
  console.log(`  → ${groupsWithCharities} groups have charities`);
  console.log(`  → ${groupsWithEvents} groups have events`);

  // ═══════════════════════════════════════════════════════════
  // 5. PAIR DIRECT MAIL ↔ DIGITAL JOBS
  // ═══════════════════════════════════════════════════════════
  console.log('\n🔗 Pairing Direct Mail ↔ Digital Jobs...');

  // Build order → DM jobs map
  const orderDmMap = new Map();
  for (const dm of dmJobs) {
    const orderIds = dm.fields.Order || [];
    for (const orderId of orderIds) {
      if (!orderDmMap.has(orderId)) orderDmMap.set(orderId, []);
      orderDmMap.get(orderId).push(dm.id);
    }
  }

  // Build order → Digital jobs map  
  const orderDigitalMap = new Map();
  for (const dj of digitalJobs) {
    const orderIds = dj.fields.Order || [];
    for (const orderId of orderIds) {
      if (!orderDigitalMap.has(orderId)) orderDigitalMap.set(orderId, []);
      orderDigitalMap.get(orderId).push(dj.id);
    }
  }

  // Check if DM_Jobs has Digital_Job link field
  const dmFields = await getTableFields(TABLES.DM_Jobs);
  const hasDigitalJobField = dmFields.some(f => f.toLowerCase().includes('digital'));
  
  if (hasDigitalJobField) {
    // Pair by matching order
    const dmUpdates = [];
    for (const dm of dmJobs) {
      const orderIds = dm.fields.Order || [];
      const digitalJobIds = new Set();
      
      for (const orderId of orderIds) {
        const djIds = orderDigitalMap.get(orderId) || [];
        for (const djId of djIds) digitalJobIds.add(djId);
      }
      
      if (digitalJobIds.size > 0 && !dm.fields.Digital_Job?.length) {
        dmUpdates.push({
          id: dm.id,
          fields: { Digital_Job: [...digitalJobIds] }
        });
      }
    }
    
    if (dmUpdates.length > 0) {
      await updateRecords(TABLES.DM_Jobs, dmUpdates);
      console.log(`  ✓ Paired ${dmUpdates.length} DM jobs with Digital jobs`);
    } else {
      console.log(`  All DM jobs already paired or no matches`);
    }
  } else {
    console.log(`  ⚠ No "Digital_Job" link field on DM_Jobs`);
    
    // Count potential pairs
    let potentialPairs = 0;
    for (const dm of dmJobs) {
      const orderIds = dm.fields.Order || [];
      for (const orderId of orderIds) {
        if (orderDigitalMap.has(orderId)) {
          potentialPairs++;
          break;
        }
      }
    }
    console.log(`  → ${potentialPairs} DM jobs could be paired with Digital jobs`);
  }

  // Count digital-only jobs
  const dmOrderIds = new Set();
  for (const dm of dmJobs) {
    for (const orderId of (dm.fields.Order || [])) {
      dmOrderIds.add(orderId);
    }
  }
  
  let digitalOnlyCount = 0;
  for (const dj of digitalJobs) {
    const orderIds = dj.fields.Order || [];
    const hasMatchingDm = orderIds.some(id => dmOrderIds.has(id));
    if (!hasMatchingDm && orderIds.length > 0) digitalOnlyCount++;
  }
  console.log(`  → ${digitalOnlyCount} digital jobs are digital-only (no DM pair)`);

  // ═══════════════════════════════════════════════════════════
  // 6. FINAL STATUS
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log('📊 FINAL CONNECTION STATUS');
  console.log('═'.repeat(50));

  // Re-fetch to get current state
  const [updatedClients, updatedOrders, updatedDm] = await Promise.all([
    getAllRecords(TABLES.Clients),
    getAllRecords(TABLES.Orders),
    getAllRecords(TABLES.DM_Jobs)
  ]);

  // Client connections
  let clientsWithVenues = 0, clientsWithCharities = 0, clientsWithEvents = 0, clientsWithOrders = 0;
  for (const c of updatedClients) {
    if (c.fields.Venues?.length) clientsWithVenues++;
    if (c.fields.Charities?.length) clientsWithCharities++;
    if (c.fields.Events?.length) clientsWithEvents++;
    if (c.fields.Orders?.length) clientsWithOrders++;
  }

  console.log(`\nClients (${updatedClients.length}):`);
  console.log(`  → Venues:    ${clientsWithVenues}/${updatedClients.length} (${Math.round(clientsWithVenues/updatedClients.length*100)}%)`);
  console.log(`  → Charities: ${clientsWithCharities}/${updatedClients.length} (${Math.round(clientsWithCharities/updatedClients.length*100)}%)`);
  console.log(`  → Events:    ${clientsWithEvents}/${updatedClients.length} (${Math.round(clientsWithEvents/updatedClients.length*100)}%)`);
  console.log(`  → Orders:    ${clientsWithOrders}/${updatedClients.length} (${Math.round(clientsWithOrders/updatedClients.length*100)}%)`);

  // Order connections
  let ordersWithClient = 0, ordersWithEvents = 0, ordersWithDm = 0, ordersWithDigital = 0;
  for (const o of updatedOrders) {
    if (o.fields.client?.length) ordersWithClient++;
    if (o.fields.Events_v2?.length) ordersWithEvents++;
    if (o.fields.Direct_Mail_Jobs?.length) ordersWithDm++;
    if (o.fields.Digital_Jobs?.length) ordersWithDigital++;
  }

  console.log(`\nOrders (${updatedOrders.length}):`);
  console.log(`  → Client:       ${ordersWithClient}/${updatedOrders.length} (${Math.round(ordersWithClient/updatedOrders.length*100)}%)`);
  console.log(`  → Events:       ${ordersWithEvents}/${updatedOrders.length} (${Math.round(ordersWithEvents/updatedOrders.length*100)}%)`);
  console.log(`  → DM Jobs:      ${ordersWithDm}/${updatedOrders.length} (${Math.round(ordersWithDm/updatedOrders.length*100)}%)`);
  console.log(`  → Digital Jobs: ${ordersWithDigital}/${updatedOrders.length} (${Math.round(ordersWithDigital/updatedOrders.length*100)}%)`);

  // DM/Digital pairing
  let dmWithDigital = 0;
  for (const dm of updatedDm) {
    if (dm.fields.Digital_Job?.length) dmWithDigital++;
  }
  console.log(`\nJob Pairing:`);
  console.log(`  → DM paired with Digital: ${dmWithDigital}/${updatedDm.length}`);
  console.log(`  → Digital-only jobs: ${digitalOnlyCount}`);

  console.log('\n✅ Connection maximization complete!');
  
  // List needed fields
  console.log('\n📝 FIELDS NEEDED (create via Airtable UI):');
  if (!hasClientVenuesField) console.log('  - Clients.Venues (Link to Venues)');
  if (!hasClientCharitiesField) console.log('  - Clients.Charities (Link to Charities)');
  if (!hasClientEventsField) console.log('  - Clients.Events (Link to Events_v2)');
  if (!hasDigitalJobField) console.log('  - Direct_Mail_Jobs.Digital_Job (Link to Digital_Jobs)');
}

main().catch(console.error);
