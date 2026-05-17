import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const AIRTABLE_PAT = process.env.AIRTABLE_PAT!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;

const TABLES_TO_DELETE = [
  'Events',
  'Events_v2',
  'Registrations',
  'Mailer_Types',
  'Creatives',
];

async function getTableId(tableName: string): Promise<string | null> {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` },
  });
  const data = await res.json();
  const table = data.tables?.find((t: any) => t.name === tableName);
  return table?.id || null;
}

async function deleteTable(tableId: string, tableName: string) {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` },
  });
  
  if (res.ok) {
    console.log(`✓ Deleted ${tableName}`);
    return true;
  } else {
    const err = await res.json();
    console.log(`✗ ${tableName}: ${err.error?.message || res.status}`);
    return false;
  }
}

async function main() {
  console.log('=== DELETING REDUNDANT TABLES ===\n');
  
  for (const tableName of TABLES_TO_DELETE) {
    const tableId = await getTableId(tableName);
    if (tableId) {
      await deleteTable(tableId, tableName);
    } else {
      console.log(`- ${tableName} not found (already deleted?)`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
