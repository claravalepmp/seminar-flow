import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID!);

async function inspectBase() {
  console.log('=== AIRTABLE BASE INSPECTION ===\n');
  console.log('Base ID:', process.env.AIRTABLE_BASE_ID);
  
  // List all tables by trying common names
  const tableNames = [
    'Orders', 'Advisors', 'Clients', 'Groups', 'Regions', 'Charities',
    'Main Orders', 'Direct Mailing', 'Digital Jobs', 'Invoices',
    'orders', 'advisors', 'clients', 'Table 1', 'Table 2', 'Table 3'
  ];
  
  console.log('\n--- Checking Tables ---\n');
  
  for (const tableName of tableNames) {
    try {
      const records = await base(tableName).select({ maxRecords: 3 }).firstPage();
      console.log(`✓ TABLE: ${tableName} (${records.length}+ records)`);
      if (records.length > 0) {
        console.log('  Fields:', Object.keys(records[0].fields).join(', '));
        console.log('  Sample:', JSON.stringify(records[0].fields, null, 2).substring(0, 500));
      }
      console.log('');
    } catch (e: any) {
      if (!e.message?.includes('Could not find table')) {
        console.log(`✗ ${tableName}: ${e.message}`);
      }
    }
  }
}

inspectBase().catch(console.error);
