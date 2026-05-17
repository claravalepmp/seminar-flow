#!/usr/bin/env node
/**
 * Create Group link fields in tables that need them
 */

const AIRTABLE_PAT = 'patXfYHRo6qBwvdfN.e6adc9494afba663c10b9869a02a1ecccd45ac35d7a2ff16e70f6b3c9e0491fa';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

// Table IDs from schema
const TABLES = {
  Groups: 'tblYbSZsqlyB8yWMs',
  Clients: 'tblcDxT3ULNTGNo4v',
  Orders: 'tblXNAKyqUgfIMRO9',
  Invoices: 'tblRNcOaEQAMRxKuZ',
  Digital_Jobs: 'tblpqN5H5or3bWzeb',
  Direct_Mail_Jobs: 'tblaCaCZNeP59w3x4',
  Venues: 'tblNKGn5jq1yJlo9X',
  Events_v2: 'tblgNThWU9ldC9o2T',
  Charities: 'tbllO26JAPm3LXzbe',
  Creatives: 'tbljli1TW6UF1LGwI',
  Proofs: 'tbla53AK92r7naAVs'
};

async function createField(tableId, fieldConfig) {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fieldConfig)
  });
  return res.json();
}

async function main() {
  console.log('=== Creating Group Link Fields ===\n');

  const tablesToUpdate = [
    'Clients',
    'Orders', 
    'Invoices',
    'Digital_Jobs',
    'Direct_Mail_Jobs',
    'Venues',
    'Events_v2',
    'Charities',
    'Creatives',
    'Proofs'
  ];

  for (const tableName of tablesToUpdate) {
    const tableId = TABLES[tableName];
    if (!tableId) {
      console.log(`❌ ${tableName}: No table ID found`);
      continue;
    }

    console.log(`Creating Group field in ${tableName}...`);
    
    const result = await createField(tableId, {
      name: 'Group',
      type: 'multipleRecordLinks',
      options: {
        linkedTableId: TABLES.Groups
      }
    });

    if (result.error) {
      if (result.error.message?.includes('already exists')) {
        console.log(`   ⚠️  Field already exists`);
      } else {
        console.log(`   ❌ Error: ${result.error.message || JSON.stringify(result.error)}`);
      }
    } else {
      console.log(`   ✅ Created field: ${result.id}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n✅ Done! Now run: node scripts/populate-group-links.js');
}

main().catch(console.error);
