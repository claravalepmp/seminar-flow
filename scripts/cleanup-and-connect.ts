import Airtable from 'airtable';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const AIRTABLE_PAT = process.env.AIRTABLE_PAT!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

// Tables to DELETE (redundant)
const TABLES_TO_DELETE = [
  'Events',
  'Events_v2', 
  'Registrations',
  'Venues',
  'Mailer_Types',
  'Creatives',
  'Regions',
  'Charities',
];

// Tables to KEEP
const TABLES_TO_KEEP = [
  'Orders',
  'Groups', 
  'Advisors',
  'Digital_Jobs',
  'Direct_Mail_Jobs',
  'Proofs',
  'Invoices',
];

async function deleteTable(tableId: string, tableName: string) {
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` },
      }
    );
    if (response.ok) {
      console.log(`  ✓ Deleted ${tableName}`);
    } else {
      const err = await response.json();
      console.log(`  ✗ Failed to delete ${tableName}: ${err.error?.message || 'Unknown error'}`);
    }
  } catch (e: any) {
    console.log(`  ✗ Error deleting ${tableName}: ${e.message}`);
  }
}

async function getTableSchema() {
  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
    { headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` } }
  );
  const data = await response.json();
  return data.tables || [];
}

async function createField(tableId: string, fieldConfig: any) {
  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fieldConfig),
    }
  );
  return response;
}

async function main() {
  console.log('=== AIRTABLE CLEANUP & CONNECT ===\n');
  
  // Get current schema
  console.log('Fetching schema...');
  const tables = await getTableSchema();
  console.log(`Found ${tables.length} tables\n`);
  
  // Map table names to IDs
  const tableMap = new Map<string, { id: string; fields: any[] }>();
  for (const t of tables) {
    tableMap.set(t.name, { id: t.id, fields: t.fields });
  }
  
  // 1. DELETE REDUNDANT TABLES
  console.log('--- Deleting Redundant Tables ---');
  for (const tableName of TABLES_TO_DELETE) {
    const table = tableMap.get(tableName);
    if (table) {
      await deleteTable(table.id, tableName);
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    } else {
      console.log(`  - ${tableName} (not found, skipping)`);
    }
  }
  
  // Refresh schema after deletions
  console.log('\nRefreshing schema...');
  const updatedTables = await getTableSchema();
  const updatedMap = new Map<string, { id: string; fields: any[] }>();
  for (const t of updatedTables) {
    updatedMap.set(t.name, { id: t.id, fields: t.fields });
  }
  console.log(`Remaining tables: ${updatedTables.length}\n`);
  
  // 2. ADD LINKED RECORD FIELDS
  console.log('--- Adding Linked Record Fields ---\n');
  
  const groupsTable = updatedMap.get('Groups');
  const advisorsTable = updatedMap.get('Advisors');
  const ordersTable = updatedMap.get('Orders');
  const digitalTable = updatedMap.get('Digital_Jobs');
  const dmTable = updatedMap.get('Direct_Mail_Jobs');
  const proofsTable = updatedMap.get('Proofs');
  
  if (!groupsTable || !advisorsTable || !ordersTable) {
    console.log('Missing required tables!');
    return;
  }
  
  // Check if fields already exist
  const hasField = (table: { fields: any[] }, fieldName: string) => 
    table.fields.some((f: any) => f.name === fieldName);
  
  // Advisors -> Groups link
  if (!hasField(advisorsTable, 'Group')) {
    console.log('Adding Advisors.Group link...');
    const res = await createField(advisorsTable.id, {
      name: 'Group',
      type: 'multipleRecordLinks',
      options: { linkedTableId: groupsTable.id },
    });
    if (res.ok) console.log('  ✓ Created Advisors.Group');
    else console.log('  ✗ Failed:', (await res.json()).error?.message);
  }
  
  // Orders -> Groups link
  if (!hasField(ordersTable, 'Group')) {
    console.log('Adding Orders.Group link...');
    const res = await createField(ordersTable.id, {
      name: 'Group',
      type: 'multipleRecordLinks',
      options: { linkedTableId: groupsTable.id },
    });
    if (res.ok) console.log('  ✓ Created Orders.Group');
    else console.log('  ✗ Failed:', (await res.json()).error?.message);
  }
  
  // Orders -> Advisors link
  if (!hasField(ordersTable, 'Advisor_Link')) {
    console.log('Adding Orders.Advisor_Link...');
    const res = await createField(ordersTable.id, {
      name: 'Advisor_Link',
      type: 'multipleRecordLinks',
      options: { linkedTableId: advisorsTable.id },
    });
    if (res.ok) console.log('  ✓ Created Orders.Advisor_Link');
    else console.log('  ✗ Failed:', (await res.json()).error?.message);
  }
  
  // Digital_Jobs -> Groups link
  if (digitalTable && !hasField(digitalTable, 'Group')) {
    console.log('Adding Digital_Jobs.Group link...');
    const res = await createField(digitalTable.id, {
      name: 'Group',
      type: 'multipleRecordLinks',
      options: { linkedTableId: groupsTable.id },
    });
    if (res.ok) console.log('  ✓ Created Digital_Jobs.Group');
    else console.log('  ✗ Failed:', (await res.json()).error?.message);
  }
  
  // Digital_Jobs -> Orders link
  if (digitalTable && !hasField(digitalTable, 'Order')) {
    console.log('Adding Digital_Jobs.Order link...');
    const res = await createField(digitalTable.id, {
      name: 'Order',
      type: 'multipleRecordLinks',
      options: { linkedTableId: ordersTable.id },
    });
    if (res.ok) console.log('  ✓ Created Digital_Jobs.Order');
    else console.log('  ✗ Failed:', (await res.json()).error?.message);
  }
  
  // Direct_Mail_Jobs -> Groups link
  if (dmTable && !hasField(dmTable, 'Group')) {
    console.log('Adding Direct_Mail_Jobs.Group link...');
    const res = await createField(dmTable.id, {
      name: 'Group',
      type: 'multipleRecordLinks',
      options: { linkedTableId: groupsTable.id },
    });
    if (res.ok) console.log('  ✓ Created Direct_Mail_Jobs.Group');
    else console.log('  ✗ Failed:', (await res.json()).error?.message);
  }
  
  // Direct_Mail_Jobs -> Orders link
  if (dmTable && !hasField(dmTable, 'Order')) {
    console.log('Adding Direct_Mail_Jobs.Order link...');
    const res = await createField(dmTable.id, {
      name: 'Order',
      type: 'multipleRecordLinks',
      options: { linkedTableId: ordersTable.id },
    });
    if (res.ok) console.log('  ✓ Created Direct_Mail_Jobs.Order');
    else console.log('  ✗ Failed:', (await res.json()).error?.message);
  }
  
  console.log('\n--- Linking Records ---\n');
  
  // 3. LINK EXISTING RECORDS
  // First, get all groups and build a lookup
  const groupRecords = await base('Groups').select().all();
  const groupLookup = new Map<string, string>(); // name -> record ID
  for (const r of groupRecords) {
    const name = (r.get('Name') as string || '').toLowerCase().trim();
    if (name) groupLookup.set(name, r.id);
  }
  console.log(`Loaded ${groupLookup.size} groups for linking`);
  
  // Get all advisors and build lookup
  const advisorRecords = await base('Advisors').select().all();
  const advisorLookup = new Map<string, string>(); // name -> record ID
  for (const r of advisorRecords) {
    const name = (r.get('advisor_name') as string || '').toLowerCase().trim();
    if (name) advisorLookup.set(name, r.id);
  }
  console.log(`Loaded ${advisorLookup.size} advisors for linking`);
  
  // Link Advisors to Groups
  console.log('\nLinking Advisors to Groups...');
  let linkedAdvisors = 0;
  for (const advisor of advisorRecords) {
    const groupName = (advisor.get('group_name') as string || '').toLowerCase().trim();
    const groupId = groupLookup.get(groupName);
    if (groupId) {
      try {
        await base('Advisors').update(advisor.id, { Group: [groupId] });
        linkedAdvisors++;
      } catch (e) {}
    }
  }
  console.log(`  Linked ${linkedAdvisors} advisors to groups`);
  
  // Link Orders to Groups and Advisors
  console.log('\nLinking Orders to Groups and Advisors...');
  const orderRecords = await base('Orders').select().all();
  let linkedOrders = 0;
  for (const order of orderRecords) {
    const groupName = (order.get('group_name') as string || '').toLowerCase().trim();
    const advisorName = (order.get('advisor') as string || '').toLowerCase().trim();
    const groupId = groupLookup.get(groupName);
    const advisorId = advisorLookup.get(advisorName);
    
    const updates: any = {};
    if (groupId) updates.Group = [groupId];
    if (advisorId) updates.Advisor_Link = [advisorId];
    
    if (Object.keys(updates).length > 0) {
      try {
        await base('Orders').update(order.id, updates);
        linkedOrders++;
      } catch (e) {}
    }
  }
  console.log(`  Linked ${linkedOrders} orders`);
  
  // Get all orders for linking jobs
  const orderLookup = new Map<number, string>(); // order_number -> record ID
  for (const r of orderRecords) {
    const num = r.get('order_number') as number;
    if (num) orderLookup.set(num, r.id);
  }
  
  // Link Digital_Jobs to Groups and Orders
  console.log('\nLinking Digital_Jobs to Groups and Orders...');
  const digitalRecords = await base('Digital_Jobs').select().all();
  let linkedDigital = 0;
  for (const job of digitalRecords) {
    const groupName = (job.get('group_name') as string || '').toLowerCase().trim();
    const orderNum = job.get('order_number') as number;
    const groupId = groupLookup.get(groupName);
    const orderId = orderNum ? orderLookup.get(orderNum) : null;
    
    const updates: any = {};
    if (groupId) updates.Group = [groupId];
    if (orderId) updates.Order = [orderId];
    
    if (Object.keys(updates).length > 0) {
      try {
        await base('Digital_Jobs').update(job.id, updates);
        linkedDigital++;
      } catch (e) {}
    }
  }
  console.log(`  Linked ${linkedDigital} digital jobs`);
  
  // Link Direct_Mail_Jobs to Groups and Orders
  console.log('\nLinking Direct_Mail_Jobs to Groups and Orders...');
  const dmRecords = await base('Direct_Mail_Jobs').select().all();
  let linkedDM = 0;
  for (const job of dmRecords) {
    const groupName = (job.get('Group Name') as string || '').toLowerCase().trim();
    const orderNum = job.get('order_number') as number;
    const groupId = groupLookup.get(groupName);
    const orderId = orderNum ? orderLookup.get(orderNum) : null;
    
    const updates: any = {};
    if (groupId) updates.Group = [groupId];
    if (orderId) updates.Order = [orderId];
    
    if (Object.keys(updates).length > 0) {
      try {
        await base('Direct_Mail_Jobs').update(job.id, updates);
        linkedDM++;
      } catch (e) {}
    }
  }
  console.log(`  Linked ${linkedDM} direct mail jobs`);
  
  console.log('\n=== CLEANUP & CONNECT COMPLETE ===');
  
  // Final summary
  const finalTables = await getTableSchema();
  console.log(`\nFinal table count: ${finalTables.length}`);
  for (const t of finalTables) {
    console.log(`  - ${t.name}`);
  }
}

main().catch(console.error);
