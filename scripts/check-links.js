#!/usr/bin/env node
const AIRTABLE_PAT = 'patXfYHRo6qBwvdfN.e6adc9494afba663c10b9869a02a1ecccd45ac35d7a2ff16e70f6b3c9e0491fa';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function getAllRecords(tableId) {
  let records = [], offset = null;
  do {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}${offset ? '?offset=' + offset : ''}`, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` }
    });
    const data = await res.json();
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function main() {
  console.log('=== Group Link Status ===\n');
  
  const tables = ['Clients', 'Regions', 'Venues', 'Orders', 'Invoices', 'Digital_Jobs', 'Direct_Mail_Jobs', 'Events_v2', 'Charities'];
  
  for (const table of tables) {
    const records = await getAllRecords(table);
    const withGroup = records.filter(r => r.fields.Group && r.fields.Group.length > 0);
    const pct = records.length > 0 ? Math.round(withGroup.length / records.length * 100) : 0;
    console.log(`${table.padEnd(18)} ${withGroup.length}/${records.length} (${pct}%)`);
  }
}

main();
