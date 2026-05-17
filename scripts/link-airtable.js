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
  console.log('Loading all tables...');
  
  const [orders, advisors, groups] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Advisors'),
    getAllRecords('Groups'),
  ]);

  console.log(`Orders: ${orders.length}, Advisors: ${advisors.length}, Groups: ${groups.length}`);

  // Build lookup maps
  const advisorByName = new Map();
  advisors.forEach(a => {
    const name = a.fields.advisor_name;
    if (name) advisorByName.set(name.toLowerCase().trim(), a.id);
  });

  const groupByName = new Map();
  groups.forEach(g => {
    const name = g.fields.Name;
    if (name) groupByName.set(name.toLowerCase().trim(), g.id);
  });

  console.log(`Advisor lookup: ${advisorByName.size} entries`);
  console.log(`Group lookup: ${groupByName.size} entries`);

  // Check current link status
  let ordersWithAdvisorLink = 0;
  let ordersWithGroupLink = 0;
  let ordersMissingAdvisorLink = [];
  let ordersMissingGroupLink = [];

  orders.forEach(o => {
    const hasAdvisor = o.fields.Advisor_Link && o.fields.Advisor_Link.length > 0;
    const hasGroup = o.fields.Group && o.fields.Group.length > 0;
    
    if (hasAdvisor) ordersWithAdvisorLink++;
    if (hasGroup) ordersWithGroupLink++;
    
    if (!hasAdvisor && o.fields.advisor) {
      const advisorId = advisorByName.get(o.fields.advisor.toLowerCase().trim());
      if (advisorId) {
        ordersMissingAdvisorLink.push({ id: o.id, advisorId, name: o.fields.advisor });
      }
    }
    
    if (!hasGroup && o.fields.group_name) {
      const groupId = groupByName.get(o.fields.group_name.toLowerCase().trim());
      if (groupId) {
        ordersMissingGroupLink.push({ id: o.id, groupId, name: o.fields.group_name });
      }
    }
  });

  console.log(`\nCurrent state:`);
  console.log(`- Orders with Advisor_Link: ${ordersWithAdvisorLink}/${orders.length}`);
  console.log(`- Orders with Group link: ${ordersWithGroupLink}/${orders.length}`);
  console.log(`- Orders needing Advisor_Link: ${ordersMissingAdvisorLink.length}`);
  console.log(`- Orders needing Group link: ${ordersMissingGroupLink.length}`);

  // Show sample of what needs linking
  console.log('\nSample orders needing links:');
  ordersMissingAdvisorLink.slice(0, 5).forEach(o => {
    console.log(`  Order advisor "${o.name}" -> ${o.advisorId}`);
  });
  ordersMissingGroupLink.slice(0, 5).forEach(o => {
    console.log(`  Order group "${o.name}" -> ${o.groupId}`);
  });

  // Now link them
  if (ordersMissingAdvisorLink.length > 0) {
    console.log('\nLinking advisors to orders...');
    for (let i = 0; i < ordersMissingAdvisorLink.length; i += 10) {
      const batch = ordersMissingAdvisorLink.slice(i, i + 10);
      await base('Orders').update(batch.map(o => ({
        id: o.id,
        fields: { Advisor_Link: [o.advisorId] }
      })));
      process.stdout.write(`  Linked ${Math.min(i + 10, ordersMissingAdvisorLink.length)}/${ordersMissingAdvisorLink.length}\r`);
    }
    console.log('\n  Done linking advisors.');
  }

  if (ordersMissingGroupLink.length > 0) {
    console.log('Linking groups to orders...');
    for (let i = 0; i < ordersMissingGroupLink.length; i += 10) {
      const batch = ordersMissingGroupLink.slice(i, i + 10);
      await base('Orders').update(batch.map(o => ({
        id: o.id,
        fields: { Group: [o.groupId] }
      })));
      process.stdout.write(`  Linked ${Math.min(i + 10, ordersMissingGroupLink.length)}/${ordersMissingGroupLink.length}\r`);
    }
    console.log('\n  Done linking groups.');
  }

  // Now link advisors to groups
  console.log('\nChecking advisor -> group links...');
  let advisorsMissingGroup = [];
  advisors.forEach(a => {
    const hasGroup = a.fields.group && a.fields.group.length > 0;
    if (!hasGroup && a.fields.group_name) {
      const groupId = groupByName.get(a.fields.group_name.toLowerCase().trim());
      if (groupId) {
        advisorsMissingGroup.push({ id: a.id, groupId, name: a.fields.group_name });
      }
    }
  });

  console.log(`Advisors needing group link: ${advisorsMissingGroup.length}`);

  if (advisorsMissingGroup.length > 0) {
    console.log('Linking groups to advisors...');
    for (let i = 0; i < advisorsMissingGroup.length; i += 10) {
      const batch = advisorsMissingGroup.slice(i, i + 10);
      await base('Advisors').update(batch.map(a => ({
        id: a.id,
        fields: { group: [a.groupId] }
      })));
      process.stdout.write(`  Linked ${Math.min(i + 10, advisorsMissingGroup.length)}/${advisorsMissingGroup.length}\r`);
    }
    console.log('\n  Done linking advisor groups.');
  }

  console.log('\n✅ All links created!');
}

main().catch(console.error);
