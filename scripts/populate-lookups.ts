import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

async function clearTable(tableName: string) {
  const records = await base(tableName).select().all();
  if (records.length === 0) return;
  for (let i = 0; i < records.length; i += 10) {
    await base(tableName).destroy(records.slice(i, i + 10).map(r => r.id));
  }
  console.log(`Cleared ${records.length} from ${tableName}`);
}

async function main() {
  console.log('=== POPULATE LOOKUP TABLES ===\n');
  
  // Get all orders to extract unique values
  const orders = await base('Orders').select().all();
  console.log(`Loaded ${orders.length} orders\n`);
  
  // Extract unique venues
  const venueMap = new Map<string, { name: string; address: string }>();
  orders.forEach(o => {
    const name = (o.get('venue_name') as string || '').trim();
    const address = (o.get('venue_address') as string || '').trim();
    if (name && !venueMap.has(name)) {
      venueMap.set(name, { name, address });
    }
  });
  
  // Extract unique regions/markets
  const regionSet = new Set<string>();
  orders.forEach(o => {
    const market = (o.get('market') as string || '').trim();
    const office = (o.get('office_location') as string || '').trim();
    if (market) regionSet.add(market);
    if (office && office !== market) regionSet.add(office);
  });
  
  // Extract unique charities (from Direct Mail Jobs)
  const dmJobs = await base('Direct_Mail_Jobs').select().all();
  const charitySet = new Set<string>();
  dmJobs.forEach(j => {
    const charity = (j.get('Charity') as string || '').trim();
    if (charity) charitySet.add(charity);
  });
  
  console.log(`Found: ${venueMap.size} venues, ${regionSet.size} regions, ${charitySet.size} charities\n`);
  
  // Populate Venues
  console.log('Populating Venues...');
  await clearTable('Venues');
  const venueRecords = Array.from(venueMap.values()).map(v => ({
    fields: { venue_name: v.name, venue_address: v.address }
  }));
  for (let i = 0; i < venueRecords.length; i += 10) {
    try {
      await base('Venues').create(venueRecords.slice(i, i + 10));
    } catch (e: any) {
      // Try one by one
      for (const r of venueRecords.slice(i, i + 10)) {
        try { await base('Venues').create([r]); } catch {}
      }
    }
  }
  console.log(`Created ${venueRecords.length} venues`);
  
  // Populate Regions
  console.log('\nPopulating Regions...');
  await clearTable('Regions');
  const regionRecords = Array.from(regionSet).map(name => ({
    fields: { name }
  }));
  for (let i = 0; i < regionRecords.length; i += 10) {
    try {
      await base('Regions').create(regionRecords.slice(i, i + 10));
    } catch (e: any) {
      for (const r of regionRecords.slice(i, i + 10)) {
        try { await base('Regions').create([r]); } catch {}
      }
    }
  }
  console.log(`Created ${regionRecords.length} regions`);
  
  // Populate Charities
  console.log('\nPopulating Charities...');
  await clearTable('Charities');
  const charityRecords = Array.from(charitySet).map(name => ({
    fields: { name }
  }));
  for (let i = 0; i < charityRecords.length; i += 10) {
    try {
      await base('Charities').create(charityRecords.slice(i, i + 10));
    } catch (e: any) {
      for (const r of charityRecords.slice(i, i + 10)) {
        try { await base('Charities').create([r]); } catch {}
      }
    }
  }
  console.log(`Created ${charityRecords.length} charities`);
  
  console.log('\n=== DONE ===');
  console.log('\nTables to DELETE (truly redundant):');
  console.log('- Events (covered by Orders)');
  console.log('- Events_v2 (duplicate)');
  console.log('- Registrations (not used)');
  console.log('- Mailer_Types (in Orders.mailer_type)');
  console.log('- Creatives (not used)');
  
  console.log('\nTables to KEEP:');
  console.log('- Orders, Advisors, Groups');
  console.log('- Digital_Jobs, Direct_Mail_Jobs');
  console.log('- Proofs, Invoices');
  console.log('- Venues, Regions, Charities (for order form)');
}

main().catch(console.error);
