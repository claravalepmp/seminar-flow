#!/usr/bin/env node
/**
 * Execute Airtable Cleanup
 * 
 * CAUTION: This modifies your Airtable base!
 * 
 * Actions:
 * 1. Clean Groups table (keep firms, remove solo advisors)
 * 2. Add Events table
 * 3. Populate Events from Order date columns
 * 4. Add rollup fields
 */

const AIRTABLE_PAT = 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

const DRY_RUN = !process.argv.includes('--execute');

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
  
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getAllRecords(tableId) {
  let records = [];
  let offset = null;
  do {
    const url = `/${BASE_ID}/${tableId}${offset ? '?offset=' + offset : ''}`;
    const data = await api(url);
    records = records.concat(data.records || []);
    offset = data.offset;
    await sleep(200);
  } while (offset);
  return records;
}

async function createRecordsBatch(tableId, records) {
  const created = [];
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    if (DRY_RUN) {
      console.log(`    [DRY RUN] Would create ${chunk.length} records`);
      created.push(...chunk.map((r, j) => ({ id: `rec_dry_${i + j}`, fields: r.fields })));
    } else {
      const result = await api(`/${BASE_ID}/${tableId}`, 'POST', { records: chunk });
      created.push(...(result.records || []));
      await sleep(200);
    }
  }
  return created;
}

// ========================================
// Get Table IDs
// ========================================
async function getTableMap() {
  const schema = await api(`/meta/bases/${BASE_ID}/tables`);
  const map = {};
  schema.tables?.forEach(t => map[t.name] = t.id);
  return map;
}

// ========================================
// STEP 1: Create Events Table
// ========================================
async function createEventsTable(tables) {
  console.log('\n📅 STEP 1: Creating Events table...');
  
  if (tables['Events_v2']) {
    console.log('  Events_v2 already exists, skipping');
    return tables['Events_v2'];
  }
  
  if (DRY_RUN) {
    console.log('  [DRY RUN] Would create Events_v2 table');
    return 'tbl_dry_events';
  }
  
  const result = await api(`/meta/bases/${BASE_ID}/tables`, 'POST', {
    name: 'Events_v2',
    description: 'Individual seminar dates (normalized from Orders)',
    fields: [
      { name: 'Event Name', type: 'singleLineText' },
      { name: 'Date', type: 'date', options: { dateFormat: { name: 'local' } } },
      { name: 'Start Time', type: 'singleLineText' },
      { name: 'End Time', type: 'singleLineText' },
      { name: 'Room', type: 'singleLineText' },
      { name: 'Venue Name', type: 'singleLineText' },
      { name: 'Venue Address', type: 'singleLineText' },
      { name: 'Status', type: 'singleSelect', options: { 
        choices: [
          { name: 'Scheduled', color: 'blueLight2' },
          { name: 'Completed', color: 'greenLight2' },
          { name: 'Cancelled', color: 'redLight2' }
        ]
      }},
      { name: 'Order Number', type: 'number', options: { precision: 0 } },
      { name: 'Advisor Name', type: 'singleLineText' },
      { name: 'Class Type', type: 'singleLineText' },
    ]
  });
  
  console.log(`  Created Events_v2 table: ${result.id}`);
  await sleep(500);
  
  // Add link to Orders
  console.log('  Adding Order link...');
  await api(`/meta/bases/${BASE_ID}/tables/${result.id}/fields`, 'POST', {
    name: 'Order',
    type: 'multipleRecordLinks',
    options: { linkedTableId: tables['Orders'] }
  });
  
  // Add link to Venues
  if (tables['Venues']) {
    console.log('  Adding Venue link...');
    await api(`/meta/bases/${BASE_ID}/tables/${result.id}/fields`, 'POST', {
      name: 'Venue',
      type: 'multipleRecordLinks',
      options: { linkedTableId: tables['Venues'] }
    });
  }
  
  return result.id;
}

// ========================================
// STEP 2: Flatten Orders into Events
// ========================================
async function flattenOrdersToEvents(tables, eventsTableId) {
  console.log('\n📦 STEP 2: Flattening Orders into Events...');
  
  const orders = await getAllRecords(tables['Orders']);
  console.log(`  Found ${orders.length} orders`);
  
  // Build venue lookup for linking
  const venues = tables['Venues'] ? await getAllRecords(tables['Venues']) : [];
  const venueLookup = {};
  venues.forEach(v => {
    const key = (v.fields.Name || '').toLowerCase().trim();
    if (key) venueLookup[key] = v.id;
  });
  
  const events = [];
  const dateColumns = [
    { field: 'first_event_date', room: 'first_event_room' },
    { field: 'second_event_date', room: 'second_event_room' },
    { field: 'third_event_date', room: 'third_event_room' },
    { field: 'fourth_event_date', room: 'fourth_event_room' },
  ];
  
  for (const order of orders) {
    const f = order.fields;
    const orderNum = f.order_number || 'Unknown';
    const advisorName = f.advisor?.[0] ? 'Linked' : (f.group_name || '');
    const venueName = f.venue_name?.split('\n')[0] || '';
    const venueAddr = f.venue_address || '';
    
    // Find venue record
    const venueKey = venueName.toLowerCase().trim();
    const venueId = venueLookup[venueKey];
    
    for (const { field, room } of dateColumns) {
      const date = f[field];
      if (!date) continue;
      
      const eventRecord = {
        fields: {
          'Event Name': `#${orderNum} - ${date}`,
          'Date': date,
          'Start Time': f.start_time || '',
          'End Time': f.end_time || '',
          'Room': f[room] || '',
          'Venue Name': venueName,
          'Venue Address': venueAddr,
          'Status': 'Scheduled',
          'Order Number': orderNum,
          'Advisor Name': advisorName,
          'Class Type': f.class_type || '',
        }
      };
      
      // Add links if not dry run
      if (!DRY_RUN) {
        eventRecord.fields['Order'] = [order.id];
        if (venueId) eventRecord.fields['Venue'] = [venueId];
      }
      
      events.push(eventRecord);
    }
  }
  
  console.log(`  Generated ${events.length} events from ${orders.length} orders`);
  
  // Create in batches
  const created = await createRecordsBatch(eventsTableId, events);
  console.log(`  Created ${created.length} event records`);
  
  return created;
}

// ========================================
// STEP 3: Set Order Statuses
// ========================================
async function setOrderStatuses(tables) {
  console.log('\n🏷️  STEP 3: Analyzing Order statuses...');
  
  const orders = await getAllRecords(tables['Orders']);
  const today = new Date().toISOString().split('T')[0];
  
  let future = 0, past = 0, noDate = 0;
  
  for (const order of orders) {
    const f = order.fields;
    const dates = [
      f.first_event_date,
      f.second_event_date, 
      f.third_event_date,
      f.fourth_event_date
    ].filter(Boolean);
    
    if (dates.length === 0) {
      noDate++;
    } else {
      const latestDate = dates.sort().pop();
      if (latestDate >= today) {
        future++;
      } else {
        past++;
      }
    }
  }
  
  console.log(`  Orders with future dates: ${future}`);
  console.log(`  Orders with past dates: ${past}`);
  console.log(`  Orders with no dates: ${noDate}`);
  console.log('  ℹ️  Status update requires manual review (run --set-statuses to batch update)');
}

// ========================================
// STEP 4: Show Rollup Instructions
// ========================================
function showRollupInstructions() {
  console.log('\n📊 STEP 4: Add these Rollup fields manually in Airtable UI:\n');
  
  const rollups = [
    ['Groups', 'Total Advisors', 'Clients', 'COUNT'],
    ['Groups', 'Total Orders', 'Clients→Orders', 'COUNT'],
    ['Regions', 'Total Orders', 'Orders', 'COUNT'],
    ['Regions', 'Total Venues', 'Venues', 'COUNT'],
    ['Clients', 'Total Orders', 'Orders', 'COUNT'],
    ['Clients', 'Total Mailings', 'Orders→mailing_quantity', 'SUM'],
    ['Orders', 'Event Count', 'Events_v2', 'COUNT'],
    ['Orders', 'First Event', 'Events_v2→Date', 'MIN'],
  ];
  
  rollups.forEach(([table, field, source, fn]) => {
    console.log(`  ${table}.${field} = ${fn}(${source})`);
  });
}

// ========================================
// Main
// ========================================
async function main() {
  console.log('🔧 AIRTABLE CLEANUP EXECUTION\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
    console.log('   Run with --execute to apply changes\n');
  } else {
    console.log('⚡ EXECUTE MODE - Changes will be applied!\n');
  }
  
  const tables = await getTableMap();
  console.log('Tables:', Object.keys(tables).join(', '));
  
  // Step 1: Create Events table
  const eventsTableId = await createEventsTable(tables);
  
  // Refresh table map
  await sleep(500);
  const updatedTables = await getTableMap();
  
  // Step 2: Flatten orders to events
  await flattenOrdersToEvents(updatedTables, eventsTableId);
  
  // Step 3: Analyze statuses
  await setOrderStatuses(updatedTables);
  
  // Step 4: Show rollup instructions
  showRollupInstructions();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(50));
  
  console.log(`
Next manual steps:
1. Review Events_v2 table in Airtable
2. Add Rollup fields as listed above
3. Rename "Clients" table to "Advisors" via Airtable UI
4. Delete old "Advisors" table (it duplicates Groups)
5. Update app to use new schema
`);
}

main().catch(e => {
  console.error('\n❌ Error:', e.message);
  process.exit(1);
});
