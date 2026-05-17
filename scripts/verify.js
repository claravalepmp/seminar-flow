const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

async function getAllRecords(table) {
  const records = [];
  await base(table).select().eachPage((pageRecords, next) => {
    records.push(...pageRecords);
    next();
  });
  return records;
}

async function main() {
  const [orders, advisors, groups, regions, charities, venues] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Advisors'),
    getAllRecords('Groups'),
    getAllRecords('Regions'),
    getAllRecords('Charities'),
    getAllRecords('Venues'),
  ]);

  console.log('=== AIRTABLE LINK STATUS ===\n');

  console.log('GROUPS:');
  groups.sort((a,b) => (b.fields.Orders?.length || 0) - (a.fields.Orders?.length || 0)).forEach(g => {
    const orders = g.fields.Orders?.length || 0;
    const clients = g.fields.Clients?.length || 0;
    const regions = g.fields.Regions?.length || 0;
    const charities = g.fields.Charities?.length || 0;
    const venues = g.fields.Venues?.length || 0;
    if (orders > 0) {
      console.log(`  ${g.fields.Name}: ${orders} orders, ${clients} advisors, ${regions} regions, ${charities} charities, ${venues} venues`);
    }
  });

  console.log('\nREGIONS:');
  regions.forEach(r => {
    const grps = r.fields.Group?.length || 0;
    const ords = r.fields.Orders?.length || 0;
    console.log(`  ${r.fields.Name} (${r.fields.State || '?'}): ${grps} groups, ${ords} orders`);
  });

  console.log('\nCHARITIES:');
  charities.forEach(c => {
    const grps = c.fields.Groups?.length || 0;
    const ords = c.fields.Orders?.length || 0;
    console.log(`  ${c.fields.Name}: ${grps} groups, ${ords} orders`);
  });

  console.log('\nORDERS SUMMARY:');
  const withAdvisor = orders.filter(o => o.fields.Advisor_Link?.length > 0).length;
  const withGroup = orders.filter(o => o.fields.Group?.length > 0).length;
  const withRegion = orders.filter(o => o.fields.Region?.length > 0).length;
  const withCharity = orders.filter(o => o.fields.Charity?.length > 0).length;
  console.log(`  Total: ${orders.length}`);
  console.log(`  With Advisor: ${withAdvisor}`);
  console.log(`  With Group: ${withGroup}`);
  console.log(`  With Region: ${withRegion}`);
  console.log(`  With Charity: ${withCharity}`);

  console.log('\nADVISORS SUMMARY:');
  const advWithGroup = advisors.filter(a => a.fields.group?.length > 0).length;
  const advWithOrders = advisors.filter(a => a.fields.Orders?.length > 0).length;
  const advWithVenues = advisors.filter(a => a.fields.Venues?.length > 0).length;
  console.log(`  Total: ${advisors.length}`);
  console.log(`  With Group: ${advWithGroup}`);
  console.log(`  With Orders: ${advWithOrders}`);
  console.log(`  With Venues: ${advWithVenues}`);
}

main().catch(console.error);
