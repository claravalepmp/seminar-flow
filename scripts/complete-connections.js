#!/usr/bin/env node
/**
 * Complete all Airtable connections:
 * 1. Create Mailer_Types table
 * 2. Add event dates to DM_Jobs from Orders
 * 3. Assign order_number to Digital_Jobs
 * 4. Connect EVERYTHING possible
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
  Regions: 'tbl6zAmQvRL32KNvP',
  DM_Jobs: 'tblaCaCZNeP59w3x4',
  Digital_Jobs: 'tblpqN5H5or3bWzeb',
  Invoices: 'tblRNcOaEQAMRxKuZ'
};

async function airtableRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.airtable.com/v0/${BASE_ID}${endpoint}`;
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

async function getAllRecords(tableId) {
  const records = [];
  let offset;
  do {
    const params = offset ? `?offset=${offset}` : '';
    const data = await airtableRequest(`/${tableId}${params}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function createRecords(tableId, records) {
  const results = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const data = await airtableRequest(`/${tableId}`, {
      method: 'POST',
      body: JSON.stringify({ records: batch.map(r => ({ fields: r })) })
    });
    results.push(...data.records);
    if (i + 10 < records.length) await new Promise(r => setTimeout(r, 250));
  }
  return results;
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

async function createTable(name, fields) {
  // Use Meta API to create table
  const url = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, fields })
  });
  if (!response.ok) {
    const err = await response.text();
    if (err.includes('already exists')) {
      console.log(`  Table "${name}" already exists`);
      return null;
    }
    throw new Error(`Create table error: ${response.status} - ${err}`);
  }
  return response.json();
}

async function addField(tableId, field) {
  const url = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(field)
  });
  if (!response.ok) {
    const err = await response.text();
    if (err.includes('already exists') || err.includes('duplicate')) {
      return null;
    }
    throw new Error(`Add field error: ${response.status} - ${err}`);
  }
  return response.json();
}

async function main() {
  console.log('🔗 COMPLETE DATA CONNECTION\n');
  console.log('='.repeat(60));

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Create Mailer_Types table
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 1: Creating Mailer_Types table...');
  
  // Get unique mailer types from Orders
  const orders = await getAllRecords(TABLES.Orders);
  const mailerTypes = new Set();
  for (const o of orders) {
    if (o.fields.mailer_type) mailerTypes.add(o.fields.mailer_type.trim());
  }
  
  console.log(`  Found ${mailerTypes.size} unique mailer types`);
  
  // Create Mailer_Types table
  let mailerTypesTableId;
  try {
    const table = await createTable('Mailer_Types', [
      { name: 'Name', type: 'singleLineText' },
      { name: 'Description', type: 'multilineText' },
      { name: 'Category', type: 'singleSelect', options: { 
        choices: [
          { name: 'R101' },
          { name: 'SS' },
          { name: 'Pillars' },
          { name: 'Custom' },
          { name: 'Dinner' },
          { name: 'Other' }
        ]
      }}
    ]);
    if (table) {
      mailerTypesTableId = table.id;
      console.log(`  ✓ Created Mailer_Types table: ${mailerTypesTableId}`);
    }
  } catch (e) {
    console.log(`  ⚠ ${e.message}`);
  }

  // If table exists, get its ID
  if (!mailerTypesTableId) {
    // Try to find existing table
    const tablesUrl = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;
    const tablesRes = await fetch(tablesUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` }
    });
    const tablesData = await tablesRes.json();
    const existingTable = tablesData.tables?.find(t => t.name === 'Mailer_Types');
    if (existingTable) {
      mailerTypesTableId = existingTable.id;
      console.log(`  Found existing Mailer_Types table: ${mailerTypesTableId}`);
    }
  }

  // Populate Mailer_Types
  if (mailerTypesTableId) {
    const existingTypes = await getAllRecords(mailerTypesTableId);
    const existingNames = new Set(existingTypes.map(t => t.fields.Name));
    
    const newTypes = [...mailerTypes].filter(t => !existingNames.has(t));
    if (newTypes.length > 0) {
      const typesToCreate = newTypes.map(name => {
        let category = 'Other';
        if (name.includes('R101') || name.includes('101')) category = 'R101';
        else if (name.includes('SS')) category = 'SS';
        else if (name.includes('Pillars')) category = 'Pillars';
        else if (name.includes('Dinner')) category = 'Dinner';
        else if (name.includes('Custom') || name.includes('Kelly') || name.includes('Eagle') || name.includes('Foguth')) category = 'Custom';
        return { Name: name, Category: category };
      });
      await createRecords(mailerTypesTableId, typesToCreate);
      console.log(`  ✓ Created ${newTypes.length} mailer type records`);
    } else {
      console.log(`  All mailer types already exist`);
    }
    TABLES.Mailer_Types = mailerTypesTableId;
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Add fields to DM_Jobs
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 2: Adding event date fields to DM_Jobs...');
  
  const dmFields = [
    { name: 'first_event_date', type: 'date', options: { dateFormat: { name: 'iso' } } },
    { name: 'second_event_date', type: 'date', options: { dateFormat: { name: 'iso' } } }
  ];
  
  for (const field of dmFields) {
    try {
      const result = await addField(TABLES.DM_Jobs, field);
      if (result) console.log(`  ✓ Added field: ${field.name}`);
      else console.log(`  Field ${field.name} already exists`);
    } catch (e) {
      console.log(`  ⚠ ${field.name}: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Populate event dates in DM_Jobs from Orders
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 3: Populating event dates in DM_Jobs...');
  
  const dmJobs = await getAllRecords(TABLES.DM_Jobs);
  const orderById = new Map(orders.map(o => [o.id, o]));
  
  const dmUpdates = [];
  for (const dm of dmJobs) {
    const orderIds = dm.fields.order || dm.fields.Order || [];
    if (orderIds.length === 0) continue;
    
    const order = orderById.get(orderIds[0]);
    if (!order) continue;
    
    const updates = {};
    
    // Copy event dates from order
    if (order.fields.first_event_date && !dm.fields.first_event_date) {
      updates.first_event_date = order.fields.first_event_date;
    }
    if (order.fields.second_event_date && !dm.fields.second_event_date) {
      updates.second_event_date = order.fields.second_event_date;
    }
    
    if (Object.keys(updates).length > 0) {
      dmUpdates.push({ id: dm.id, fields: updates });
    }
  }
  
  if (dmUpdates.length > 0) {
    await updateRecords(TABLES.DM_Jobs, dmUpdates);
    console.log(`  ✓ Updated ${dmUpdates.length} DM jobs with event dates`);
  } else {
    console.log(`  All DM jobs already have event dates or no orders linked`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Add order_number field to Digital_Jobs and populate
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 4: Adding order_number to Digital_Jobs...');
  
  try {
    await addField(TABLES.Digital_Jobs, { 
      name: 'order_number', 
      type: 'number',
      options: { precision: 0 }
    });
    console.log(`  ✓ Added order_number field`);
  } catch (e) {
    console.log(`  Field may already exist: ${e.message}`);
  }
  
  const digitalJobs = await getAllRecords(TABLES.Digital_Jobs);
  const djUpdates = [];
  
  for (const dj of digitalJobs) {
    const orderIds = dj.fields.Order || [];
    if (orderIds.length === 0) continue;
    if (dj.fields.order_number) continue; // Already has order number
    
    const order = orderById.get(orderIds[0]);
    if (order?.fields.order_number) {
      djUpdates.push({
        id: dj.id,
        fields: { order_number: order.fields.order_number }
      });
    }
  }
  
  if (djUpdates.length > 0) {
    await updateRecords(TABLES.Digital_Jobs, djUpdates);
    console.log(`  ✓ Assigned order numbers to ${djUpdates.length} digital jobs`);
  } else {
    console.log(`  All digital jobs already have order numbers`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Connect EVERYTHING
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📋 STEP 5: Connecting all data...');
  
  // Reload all data
  const [clients, groups, events, venues, charities, regions, invoices] = await Promise.all([
    getAllRecords(TABLES.Clients),
    getAllRecords(TABLES.Groups),
    getAllRecords(TABLES.Events),
    getAllRecords(TABLES.Venues),
    getAllRecords(TABLES.Charities),
    getAllRecords(TABLES.Regions),
    getAllRecords(TABLES.Invoices)
  ]);
  
  // Reload DM and Digital jobs
  const dmJobsUpdated = await getAllRecords(TABLES.DM_Jobs);
  const djUpdated = await getAllRecords(TABLES.Digital_Jobs);
  
  // Build lookup maps
  const eventById = new Map(events.map(e => [e.id, e]));
  const clientById = new Map(clients.map(c => [c.id, c]));
  const groupById = new Map(groups.map(g => [g.id, g]));
  
  // 5a. Connect Clients → Venues, Events, Charities through Orders
  console.log('  Connecting Clients to Venues/Events/Charities...');
  const clientVenues = new Map();
  const clientEvents = new Map();
  const clientCharities = new Map();
  const clientOrders = new Map();
  
  for (const order of orders) {
    const clientIds = order.fields.client || [];
    const eventIds = order.fields.Events_v2 || [];
    const charityIds = order.fields.Charity || [];
    
    for (const clientId of clientIds) {
      if (!clientVenues.has(clientId)) clientVenues.set(clientId, new Set());
      if (!clientEvents.has(clientId)) clientEvents.set(clientId, new Set());
      if (!clientCharities.has(clientId)) clientCharities.set(clientId, new Set());
      if (!clientOrders.has(clientId)) clientOrders.set(clientId, new Set());
      
      clientOrders.get(clientId).add(order.id);
      
      for (const eventId of eventIds) {
        clientEvents.get(clientId).add(eventId);
        const event = eventById.get(eventId);
        if (event?.fields.Venue) {
          for (const venueId of event.fields.Venue) {
            clientVenues.get(clientId).add(venueId);
          }
        }
      }
      
      for (const charityId of charityIds) {
        clientCharities.get(clientId).add(charityId);
      }
    }
  }
  
  // Update clients with all connections
  const clientUpdates = [];
  for (const client of clients) {
    const updates = {};
    
    const venues = clientVenues.get(client.id);
    const evts = clientEvents.get(client.id);
    const chars = clientCharities.get(client.id);
    
    if (venues?.size > 0) updates.Venues = [...venues];
    if (evts?.size > 0) updates.Events_v2 = [...evts];
    // Note: Charities field might not exist, we'll try
    
    if (Object.keys(updates).length > 0) {
      clientUpdates.push({ id: client.id, fields: updates });
    }
  }
  
  if (clientUpdates.length > 0) {
    try {
      await updateRecords(TABLES.Clients, clientUpdates);
      console.log(`    ✓ Updated ${clientUpdates.length} clients`);
    } catch (e) {
      console.log(`    ⚠ Client update error: ${e.message}`);
    }
  }
  
  // 5b. Connect Groups → Clients, Venues, Charities
  console.log('  Connecting Groups to aggregated data...');
  const groupClients = new Map();
  const groupVenues = new Map();
  const groupCharities = new Map();
  
  for (const client of clients) {
    const groupIds = client.fields.group || [];
    for (const groupId of groupIds) {
      if (!groupClients.has(groupId)) groupClients.set(groupId, new Set());
      if (!groupVenues.has(groupId)) groupVenues.set(groupId, new Set());
      if (!groupCharities.has(groupId)) groupCharities.set(groupId, new Set());
      
      groupClients.get(groupId).add(client.id);
      
      const cv = clientVenues.get(client.id);
      const cc = clientCharities.get(client.id);
      if (cv) for (const v of cv) groupVenues.get(groupId).add(v);
      if (cc) for (const c of cc) groupCharities.get(groupId).add(c);
    }
  }
  
  // 5c. Connect Digital Jobs → Orders (by matching criteria)
  console.log('  Connecting Digital Jobs to Orders...');
  
  // Build order lookup by various keys
  const orderByNumber = new Map();
  const orderByGroupDate = new Map();
  
  for (const order of orders) {
    if (order.fields.order_number) {
      orderByNumber.set(order.fields.order_number, order.id);
    }
    // Key by group_name + first_event_date
    const key = `${order.fields.group_name || ''}_${order.fields.first_event_date || ''}`.toLowerCase();
    if (!orderByGroupDate.has(key)) orderByGroupDate.set(key, []);
    orderByGroupDate.get(key).push(order.id);
  }
  
  const djOrderUpdates = [];
  for (const dj of djUpdated) {
    if (dj.fields.Order?.length > 0) continue; // Already linked
    
    // Try to match by order number if available
    if (dj.fields.order_number) {
      const orderId = orderByNumber.get(dj.fields.order_number);
      if (orderId) {
        djOrderUpdates.push({ id: dj.id, fields: { Order: [orderId] } });
        continue;
      }
    }
    
    // Try to match by group + date
    const djGroup = (dj.fields.group_name || dj.fields.client_name || '').toLowerCase();
    const djDate = dj.fields.event_date || dj.fields.first_event_date || '';
    const key = `${djGroup}_${djDate}`;
    const matchingOrders = orderByGroupDate.get(key);
    if (matchingOrders?.length === 1) {
      djOrderUpdates.push({ id: dj.id, fields: { Order: [matchingOrders[0]] } });
    }
  }
  
  if (djOrderUpdates.length > 0) {
    try {
      await updateRecords(TABLES.Digital_Jobs, djOrderUpdates);
      console.log(`    ✓ Linked ${djOrderUpdates.length} digital jobs to orders`);
    } catch (e) {
      console.log(`    ⚠ Digital job link error: ${e.message}`);
    }
  }
  
  // 5d. Connect DM Jobs → Clients (through Orders)
  console.log('  Connecting DM Jobs to Clients...');
  const dmClientUpdates = [];
  
  for (const dm of dmJobsUpdated) {
    if (dm.fields.Client?.length > 0) continue;
    
    const orderIds = dm.fields.order || dm.fields.Order || [];
    if (orderIds.length === 0) continue;
    
    const order = orderById.get(orderIds[0]);
    if (order?.fields.client?.length > 0) {
      dmClientUpdates.push({ id: dm.id, fields: { Client: order.fields.client } });
    }
  }
  
  if (dmClientUpdates.length > 0) {
    try {
      // Check if Client field exists on DM_Jobs
      await addField(TABLES.DM_Jobs, {
        name: 'Client',
        type: 'multipleRecordLinks',
        options: { linkedTableId: TABLES.Clients }
      });
    } catch (e) {}
    
    try {
      await updateRecords(TABLES.DM_Jobs, dmClientUpdates);
      console.log(`    ✓ Linked ${dmClientUpdates.length} DM jobs to clients`);
    } catch (e) {
      console.log(`    ⚠ DM client link error: ${e.message}`);
    }
  }
  
  // 5e. Connect Invoices → everything
  console.log('  Connecting Invoices...');
  const invoiceUpdates = [];
  
  for (const inv of invoices) {
    const updates = {};
    
    // Link to order if not linked
    if (!inv.fields.Order?.length && inv.fields.order_number) {
      const orderId = orderByNumber.get(inv.fields.order_number);
      if (orderId) updates.Order = [orderId];
    }
    
    // Link to client through order
    if (!inv.fields.Client?.length && inv.fields.Order?.length) {
      const order = orderById.get(inv.fields.Order[0]);
      if (order?.fields.client?.length) {
        updates.Client = order.fields.client;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      invoiceUpdates.push({ id: inv.id, fields: updates });
    }
  }
  
  if (invoiceUpdates.length > 0) {
    try {
      await updateRecords(TABLES.Invoices, invoiceUpdates);
      console.log(`    ✓ Updated ${invoiceUpdates.length} invoices`);
    } catch (e) {
      console.log(`    ⚠ Invoice update error: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL STATUS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL CONNECTION STATUS');
  console.log('═'.repeat(60));
  
  // Reload everything for final counts
  const finalOrders = await getAllRecords(TABLES.Orders);
  const finalClients = await getAllRecords(TABLES.Clients);
  const finalDM = await getAllRecords(TABLES.DM_Jobs);
  const finalDJ = await getAllRecords(TABLES.Digital_Jobs);
  const finalInvoices = await getAllRecords(TABLES.Invoices);
  const finalEvents = await getAllRecords(TABLES.Events);
  const finalVenues = await getAllRecords(TABLES.Venues);
  
  const stats = {
    orders: { total: finalOrders.length },
    clients: { total: finalClients.length },
    dm: { total: finalDM.length },
    dj: { total: finalDJ.length },
    invoices: { total: finalInvoices.length },
    events: { total: finalEvents.length },
    venues: { total: finalVenues.length }
  };
  
  // Count connections
  stats.orders.withClient = finalOrders.filter(o => o.fields.client?.length).length;
  stats.orders.withEvents = finalOrders.filter(o => o.fields.Events_v2?.length).length;
  stats.orders.withDM = finalOrders.filter(o => o.fields.Direct_Mail_Jobs?.length).length;
  stats.orders.withDJ = finalOrders.filter(o => o.fields.Digital_Jobs?.length).length;
  
  stats.clients.withVenues = finalClients.filter(c => c.fields.Venues?.length).length;
  stats.clients.withEvents = finalClients.filter(c => c.fields.Events_v2?.length).length;
  stats.clients.withOrders = finalClients.filter(c => c.fields.Orders?.length).length;
  
  stats.dm.withOrder = finalDM.filter(d => (d.fields.order || d.fields.Order)?.length).length;
  stats.dm.withDates = finalDM.filter(d => d.fields.first_event_date).length;
  stats.dm.withOrderNum = finalDM.filter(d => d.fields.order_number).length;
  
  stats.dj.withOrder = finalDJ.filter(d => d.fields.Order?.length).length;
  stats.dj.withOrderNum = finalDJ.filter(d => d.fields.order_number).length;
  
  stats.invoices.withOrder = finalInvoices.filter(i => i.fields.Order?.length).length;
  stats.invoices.withClient = finalInvoices.filter(i => i.fields.Client?.length).length;
  
  stats.events.withOrder = finalEvents.filter(e => e.fields.Order?.length).length;
  stats.events.withVenue = finalEvents.filter(e => e.fields.Venue?.length).length;
  
  console.log(`
Orders (${stats.orders.total}):
  → Client:       ${stats.orders.withClient}/${stats.orders.total} (${Math.round(stats.orders.withClient/stats.orders.total*100)}%)
  → Events:       ${stats.orders.withEvents}/${stats.orders.total} (${Math.round(stats.orders.withEvents/stats.orders.total*100)}%)
  → DM Jobs:      ${stats.orders.withDM}/${stats.orders.total} (${Math.round(stats.orders.withDM/stats.orders.total*100)}%)
  → Digital Jobs: ${stats.orders.withDJ}/${stats.orders.total} (${Math.round(stats.orders.withDJ/stats.orders.total*100)}%)

Clients (${stats.clients.total}):
  → Venues:       ${stats.clients.withVenues}/${stats.clients.total} (${Math.round(stats.clients.withVenues/stats.clients.total*100)}%)
  → Events:       ${stats.clients.withEvents}/${stats.clients.total} (${Math.round(stats.clients.withEvents/stats.clients.total*100)}%)
  → Orders:       ${stats.clients.withOrders}/${stats.clients.total} (${Math.round(stats.clients.withOrders/stats.clients.total*100)}%)

DM Jobs (${stats.dm.total}):
  → Order:        ${stats.dm.withOrder}/${stats.dm.total} (${Math.round(stats.dm.withOrder/stats.dm.total*100)}%)
  → Event Dates:  ${stats.dm.withDates}/${stats.dm.total} (${Math.round(stats.dm.withDates/stats.dm.total*100)}%)
  → Order Number: ${stats.dm.withOrderNum}/${stats.dm.total} (${Math.round(stats.dm.withOrderNum/stats.dm.total*100)}%)

Digital Jobs (${stats.dj.total}):
  → Order:        ${stats.dj.withOrder}/${stats.dj.total} (${Math.round(stats.dj.withOrder/stats.dj.total*100)}%)
  → Order Number: ${stats.dj.withOrderNum}/${stats.dj.total} (${Math.round(stats.dj.withOrderNum/stats.dj.total*100)}%)

Invoices (${stats.invoices.total}):
  → Order:        ${stats.invoices.withOrder}/${stats.invoices.total} (${Math.round(stats.invoices.withOrder/stats.invoices.total*100)}%)
  → Client:       ${stats.invoices.withClient}/${stats.invoices.total} (${Math.round(stats.invoices.withClient/stats.invoices.total*100)}%)

Events (${stats.events.total}):
  → Order:        ${stats.events.withOrder}/${stats.events.total} (${Math.round(stats.events.withOrder/stats.events.total*100)}%)
  → Venue:        ${stats.events.withVenue}/${stats.events.total} (${Math.round(stats.events.withVenue/stats.events.total*100)}%)
`);

  console.log('✅ Complete connection process finished!');
}

main().catch(console.error);
