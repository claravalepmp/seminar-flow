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
  console.log('Loading data...');
  const [orders, advisors, groups, regions, dmJobs] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Advisors'),
    getAllRecords('Groups'),
    getAllRecords('Regions'),
    getAllRecords('Direct_Mail_Jobs'),
  ]);

  // Check actual DM statuses
  console.log('\n=== DIRECT MAIL JOB STATUSES ===');
  const dmStatuses = new Map();
  dmJobs.forEach(dm => {
    const s = dm.fields.status || 'EMPTY';
    dmStatuses.set(s, (dmStatuses.get(s) || 0) + 1);
  });
  [...dmStatuses.entries()].forEach(([s, c]) => console.log(`  ${s}: ${c}`));

  // Find FTA group
  const ftaGroup = groups.find(g => g.fields.Name === 'FTA');
  console.log(`\n=== FTA GROUP ===`);
  console.log(`ID: ${ftaGroup.id}`);
  console.log(`Regions: ${(ftaGroup.fields.Regions || []).length}`);
  console.log(`Clients: ${(ftaGroup.fields.Clients || []).length}`);

  // Find FTA advisors
  console.log('\n=== FTA ADVISORS ===');
  const ftaAdvisors = advisors.filter(a => {
    const grp = a.fields.group;
    return grp && grp.includes(ftaGroup.id);
  });
  
  ftaAdvisors.forEach(a => {
    console.log(`  ${a.fields.advisor_name}: Orders=${(a.fields.Orders || []).length}, Venues=${(a.fields.Venues || []).length}`);
  });

  // Get all regions linked to FTA orders
  console.log('\n=== REGIONS FROM FTA ORDERS ===');
  const ftaOrders = orders.filter(o => o.fields.Group && o.fields.Group.includes(ftaGroup.id));
  const ftaRegionIds = new Set();
  ftaOrders.forEach(o => {
    (o.fields.Region || []).forEach(rid => ftaRegionIds.add(rid));
  });

  const ftaRegions = regions.filter(r => ftaRegionIds.has(r.id));
  console.log(`FTA has ${ftaRegionIds.size} regions from orders:`);
  ftaRegions.forEach(r => {
    console.log(`  ${r.fields.Name} (${r.fields.State || '?'})`);
  });

  // Show current FTA group regions
  console.log('\n=== CURRENT FTA GROUP REGIONS ===');
  const currentFtaRegions = (ftaGroup.fields.Regions || []);
  currentFtaRegions.forEach(rid => {
    const r = regions.find(reg => reg.id === rid);
    if (r) console.log(`  ${r.fields.Name}`);
  });

  // Merge all FTA order regions into FTA group
  console.log('\n=== MERGING REGIONS INTO FTA GROUP ===');
  const allFtaRegions = [...new Set([...currentFtaRegions, ...ftaRegionIds])];
  if (allFtaRegions.length > currentFtaRegions.length) {
    await base('Groups').update(ftaGroup.id, { Regions: allFtaRegions });
    console.log(`Updated FTA with ${allFtaRegions.length} regions (was ${currentFtaRegions.length})`);
  } else {
    console.log('No new regions to add');
  }

  // Now check what "individual orders" means - maybe orders without proper group link?
  console.log('\n=== ORDERS WITHOUT GROUP LINK ===');
  const noGroup = orders.filter(o => !o.fields.Group || o.fields.Group.length === 0);
  console.log(`Orders without Group link: ${noGroup.length}`);
  noGroup.slice(0, 10).forEach(o => {
    console.log(`  #${o.fields.order_number}: ${o.fields.advisor} / ${o.fields.group_name}`);
  });

  console.log('\n✅ Done');
}

main().catch(console.error);
