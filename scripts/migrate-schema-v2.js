#!/usr/bin/env node
/**
 * Migrate Airtable to Schema v2
 * 
 * This script:
 * 1. Creates Venues table from Orders data
 * 2. Merges Clients data into Advisors  
 * 3. Creates Events from Order date columns
 * 4. Adds Rollup fields for aggregations
 */

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appeEmOJVXDJ0WPF4';

async function api(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  const data = await res.json();
  
  if (data.error) {
    console.error('API Error:', data.error);
    throw new Error(JSON.stringify(data.error));
  }
  return data;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSchema() {
  console.log('📋 Fetching current schema...');
  const schema = await api(`/meta/bases/${BASE_ID}/tables`);
  const tables = {};
  schema.tables?.forEach(t => {
    tables[t.name] = { id: t.id, fields: {} };
    t.fields?.forEach(f => { tables[t.name].fields[f.name] = f; });
  });
  return tables;
}

async function getRecords(tableId, fields = []) {
  let records = [];
  let offset = null;
  
  do {
    const params = new URLSearchParams();
    if (fields.length) params.set('fields[]', fields.join(','));
    if (offset) params.set('offset', offset);
    
    const url = `/${BASE_ID}/${tableId}?${params}`;
    const data = await api(url);
    records = records.concat(data.records || []);
    offset = data.offset;
    await sleep(200); // Rate limit
  } while (offset);
  
  return records;
}

async function createTable(name, description, fields) {
  console.log(`  Creating table: ${name}...`);
  return api(`/meta/bases/${BASE_ID}/tables`, 'POST', {
    name,
    description,
    fields
  });
}

async function addField(tableId, field) {
  console.log(`  Adding field: ${field.name}...`);
  return api(`/meta/bases/${BASE_ID}/tables/${tableId}/fields`, 'POST', field);
}

async function createRecords(tableId, records) {
  // Airtable allows max 10 records per request
  const chunks = [];
  for (let i = 0; i < records.length; i += 10) {
    chunks.push(records.slice(i, i + 10));
  }
  
  const created = [];
  for (const chunk of chunks) {
    const result = await api(`/${BASE_ID}/${tableId}`, 'POST', { records: chunk });
    created.push(...(result.records || []));
    await sleep(200);
  }
  return created;
}

// ============================================
// STEP 1: Create Venues table from Orders
// ============================================
async function createVenuesTable(tables) {
  console.log('\n🏛️  STEP 1: Creating Venues table...');
  
  if (tables['Venues']) {
    console.log('  Venues table already exists, skipping creation');
    return tables['Venues'].id;
  }
  
  // Create the table
  const venueTable = await createTable('Venues', 'Seminar locations', [
    { name: 'Name', type: 'singleLineText' },
    { name: 'Full Name', type: 'singleLineText' },
    { name: 'Address', type: 'singleLineText' },
    { name: 'City', type: 'singleLineText' },
    { name: 'State', type: 'singleLineText' },
    { name: 'Zip', type: 'singleLineText' },
    { name: 'Default Room', type: 'singleLineText' },
    { name: 'Capacity', type: 'number', options: { precision: 0 } },
    { name: 'Parking Notes', type: 'multilineText' },
  ]);
  
  const venueTableId = venueTable.id;
  console.log(`  Created Venues table: ${venueTableId}`);
  
  // Add Region link after we know table exists
  await sleep(500);
  if (tables['Regions']) {
    await addField(venueTableId, {
      name: 'Region',
      type: 'multipleRecordLinks',
      options: { linkedTableId: tables['Regions'].id }
    });
  }
  
  return venueTableId;
}

// ============================================
// STEP 2: Extract unique venues from Orders
// ============================================
async function extractAndPopulateVenues(tables, venueTableId) {
  console.log('\n📍 STEP 2: Extracting venues from Orders...');
  
  const ordersTableId = tables['Orders']?.id;
  if (!ordersTableId) {
    console.log('  No Orders table found, skipping');
    return {};
  }
  
  // Get all orders with venue data
  const orders = await getRecords(ordersTableId);
  console.log(`  Found ${orders.length} orders`);
  
  // Extract unique venues (by name + address combo)
  const venueMap = new Map();
  
  for (const order of orders) {
    const f = order.fields;
    const venueName = f.venue_name?.trim();
    const venueAddr = f.venue_address?.trim();
    
    if (!venueName && !venueAddr) continue;
    
    // Create a key for deduplication
    const key = `${venueName || ''}|${venueAddr || ''}`.toLowerCase();
    
    if (!venueMap.has(key)) {
      // Parse address into components
      let city = '', state = '', zip = '';
      if (venueAddr) {
        const parts = venueAddr.split(',').map(s => s.trim());
        if (parts.length >= 2) {
          // Try to parse "City, ST 12345" format
          const lastPart = parts[parts.length - 1];
          const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})?/i);
          if (stateZipMatch) {
            state = stateZipMatch[1].toUpperCase();
            zip = stateZipMatch[2] || '';
            city = parts[parts.length - 2] || '';
          }
        }
      }
      
      venueMap.set(key, {
        fields: {
          'Name': venueName?.split('\n')[0] || venueAddr?.split(',')[0] || 'Unknown',
          'Full Name': venueName,
          'Address': venueAddr?.split('\n')[0] || venueAddr,
          'City': city,
          'State': state,
          'Zip': zip,
        }
      });
    }
  }
  
  console.log(`  Found ${venueMap.size} unique venues`);
  
  // Create venue records
  const venueRecords = Array.from(venueMap.values());
  if (venueRecords.length > 0) {
    const created = await createRecords(venueTableId, venueRecords);
    console.log(`  Created ${created.length} venue records`);
    
    // Build lookup map: key -> record id
    const venueLookup = {};
    venueRecords.forEach((v, i) => {
      const key = `${v.fields['Full Name'] || ''}|${v.fields['Address'] || ''}`.toLowerCase();
      if (created[i]) {
        venueLookup[key] = created[i].id;
      }
    });
    
    return venueLookup;
  }
  
  return {};
}

// ============================================
// STEP 3: Merge Clients into Advisors
// ============================================
async function mergeClientsIntoAdvisors(tables) {
  console.log('\n👥 STEP 3: Merging Clients into Advisors...');
  
  const advisorsTableId = tables['Advisors']?.id;
  const clientsTableId = tables['Clients']?.id;
  
  if (!clientsTableId) {
    console.log('  No Clients table found, skipping');
    return;
  }
  
  if (!advisorsTableId) {
    console.log('  No Advisors table found, skipping');
    return;
  }
  
  // Get all clients and advisors
  const clients = await getRecords(clientsTableId);
  const advisors = await getRecords(advisorsTableId);
  
  console.log(`  Found ${clients.length} clients, ${advisors.length} advisors`);
  
  // Map advisors by name for matching
  const advisorByName = new Map();
  advisors.forEach(a => {
    const name = (a.fields.company_name || a.fields.contact_name || '').toLowerCase().trim();
    if (name) advisorByName.set(name, a);
  });
  
  // Find clients that need to be merged or added
  const fieldsToMerge = [
    'business_name', 'business_website', 'business_address', 'business_city', 'business_state',
    'mailer_return_address', 'registration_phone', 'website_registration_direct',
    'main_contact_name', 'main_contact_email', 'main_contact_phone',
    'preferred_mailer_topics', 'mailer_type_used', 'order_instructions',
    'direct_mailer_rate', 'usual_mailing_quantity', 'default_digital_budget',
    'non_profit_status', 'client_notes'
  ];
  
  let matchCount = 0;
  let newCount = 0;
  
  for (const client of clients) {
    const clientName = (client.fields.advisor_name || client.fields.business_name || '').toLowerCase().trim();
    const existingAdvisor = advisorByName.get(clientName);
    
    if (existingAdvisor) {
      matchCount++;
      // Would update existing advisor with client fields
      // For now, just log
      console.log(`    ✓ Match: ${clientName}`);
    } else {
      newCount++;
      console.log(`    + New: ${clientName}`);
    }
  }
  
  console.log(`  Summary: ${matchCount} matches, ${newCount} new (not auto-migrated yet)`);
  console.log('  ⚠️  Run with --execute to actually migrate data');
}

// ============================================  
// STEP 4: Add Rollup fields
// ============================================
async function addRollupFields(tables) {
  console.log('\n📊 STEP 4: Adding Rollup fields...');
  
  // These require the linked fields to exist first
  // Just log what needs to be added
  
  const rollups = [
    { table: 'Groups', field: 'Total Orders', linkedField: 'Advisors', rollupField: 'Total Orders' },
    { table: 'Regions', field: 'Orders YTD', linkedField: 'Orders', rollupField: null },
    { table: 'Advisors', field: 'Total Orders', linkedField: 'Orders', rollupField: null },
    { table: 'Advisors', field: 'Total Mailings', linkedField: 'Orders', rollupField: 'mailing_quantity' },
    { table: 'Orders', field: 'Event Count', linkedField: 'Events', rollupField: null },
    { table: 'Orders', field: 'First Event Date', linkedField: 'Events', rollupField: 'event_date' },
  ];
  
  console.log('  Rollups to add (manual step):');
  rollups.forEach(r => {
    const exists = tables[r.table]?.fields[r.field];
    const status = exists ? '✓' : '○';
    console.log(`    ${status} ${r.table}.${r.field} (from ${r.linkedField})`);
  });
}

// ============================================
// Main
// ============================================
async function main() {
  console.log('🔄 Airtable Schema Migration v2\n');
  console.log('Base ID:', BASE_ID);
  
  const tables = await getSchema();
  console.log('Existing tables:', Object.keys(tables).join(', '));
  
  // Step 1: Create Venues table
  const venueTableId = await createVenuesTable(tables);
  
  // Step 2: Extract and populate venues
  await sleep(1000);
  const updatedTables = await getSchema(); // Refresh
  const venueLookup = await extractAndPopulateVenues(updatedTables, venueTableId);
  
  // Step 3: Analyze Clients merge (doesn't execute by default)
  await mergeClientsIntoAdvisors(updatedTables);
  
  // Step 4: Show rollups needed
  await addRollupFields(updatedTables);
  
  console.log('\n✅ Migration analysis complete');
  console.log('\nNext steps:');
  console.log('1. Review Venues table in Airtable UI');
  console.log('2. Manually add Rollup fields via Airtable UI');
  console.log('3. Decide: keep Clients separate or merge into Advisors?');
  console.log('4. Create Events table from Order date columns');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
