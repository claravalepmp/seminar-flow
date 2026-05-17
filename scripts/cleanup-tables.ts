import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const AIRTABLE_PAT = process.env.AIRTABLE_PAT!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;

const TABLES_TO_DELETE = ['Creatives', 'Mailer_Types'];

async function main() {
  // Get all tables
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` },
  });
  const data = await res.json();
  
  console.log('Current tables:');
  data.tables.forEach((t: any) => console.log(`  - ${t.name} (${t.id})`));
  
  console.log('\nDeleting redundant tables...');
  
  for (const tableName of TABLES_TO_DELETE) {
    const table = data.tables.find((t: any) => t.name === tableName);
    if (!table) {
      console.log(`  ${tableName}: not found`);
      continue;
    }
    
    const delRes = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${table.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` },
    });
    
    if (delRes.ok) {
      console.log(`  ✓ Deleted ${tableName}`);
    } else {
      const err = await delRes.json();
      console.log(`  ✗ ${tableName}: ${err.error?.message || delRes.status}`);
    }
  }
}

main().catch(console.error);
