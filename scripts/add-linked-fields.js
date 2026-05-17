require('dotenv').config({ path: '.env.local' });

const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appeEmOJVXDJ0WPF4';

// Get table IDs
async function getTableIds() {
  const resp = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${PAT}` }
  });
  const data = await resp.json();
  const map = {};
  data.tables.forEach(t => map[t.name] = t.id);
  return map;
}

async function addField(tableId, field) {
  const resp = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(field)
  });
  return resp.json();
}

async function main() {
  const tables = await getTableIds();
  console.log('Table IDs:', tables);
  
  // Define links to add
  const links = [
    // Clients -> Groups
    { table: 'Clients', field: { name: 'group', type: 'multipleRecordLinks', options: { linkedTableId: tables.Groups } } },
    
    // Orders -> Clients
    { table: 'Orders', field: { name: 'client', type: 'multipleRecordLinks', options: { linkedTableId: tables.Clients } } },
    
    // Digital_Jobs -> Orders
    { table: 'Digital_Jobs', field: { name: 'order', type: 'multipleRecordLinks', options: { linkedTableId: tables.Orders } } },
    // Digital_Jobs -> Clients
    { table: 'Digital_Jobs', field: { name: 'client', type: 'multipleRecordLinks', options: { linkedTableId: tables.Clients } } },
    
    // Direct_Mail_Jobs -> Orders
    { table: 'Direct_Mail_Jobs', field: { name: 'order', type: 'multipleRecordLinks', options: { linkedTableId: tables.Orders } } },
    // Direct_Mail_Jobs -> Creatives
    { table: 'Direct_Mail_Jobs', field: { name: 'creative', type: 'multipleRecordLinks', options: { linkedTableId: tables.Creatives } } },
    
    // Invoices -> Orders
    { table: 'Invoices', field: { name: 'order', type: 'multipleRecordLinks', options: { linkedTableId: tables.Orders } } },
    // Invoices -> Clients
    { table: 'Invoices', field: { name: 'client', type: 'multipleRecordLinks', options: { linkedTableId: tables.Clients } } },
    
    // Events -> Orders
    { table: 'Events', field: { name: 'order', type: 'multipleRecordLinks', options: { linkedTableId: tables.Orders } } },
    
    // Registrations -> Events (may already exist)
    // { table: 'Registrations', field: { name: 'event', type: 'multipleRecordLinks', options: { linkedTableId: tables.Events } } },
  ];
  
  console.log('\n=== ADDING LINKED FIELDS ===');
  for (const link of links) {
    const tableId = tables[link.table];
    if (!tableId) {
      console.log(`  ${link.table}.${link.field.name} - TABLE NOT FOUND`);
      continue;
    }
    
    const result = await addField(tableId, link.field);
    if (result.error) {
      console.log(`  ${link.table}.${link.field.name} - ERROR: ${result.error.message}`);
    } else {
      console.log(`  ${link.table}.${link.field.name} -> ${link.field.options.linkedTableId} - CREATED`);
    }
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
