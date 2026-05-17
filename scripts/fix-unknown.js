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
  const [orders, advisors, groups] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Advisors'),
    getAllRecords('Groups'),
  ]);

  // Find orders without group
  const noGroup = orders.filter(o => !o.fields.Group || o.fields.Group.length === 0);
  console.log(`Orders without group: ${noGroup.length}\n`);

  // Build advisor name -> advisor map
  const advisorByName = new Map();
  advisors.forEach(a => {
    if (a.fields.advisor_name) {
      advisorByName.set(a.fields.advisor_name.toLowerCase().trim(), a);
    }
  });

  // For each order without group, try to find advisor and get their group
  let updates = [];
  noGroup.forEach(o => {
    const advName = o.fields.advisor;
    if (advName) {
      const adv = advisorByName.get(advName.toLowerCase().trim());
      if (adv && adv.fields.group && adv.fields.group.length > 0) {
        updates.push({
          id: o.id,
          fields: { 
            Group: adv.fields.group,
            Advisor_Link: [adv.id]
          }
        });
        console.log(`#${o.fields.order_number} ${advName} -> ${adv.fields.group_name}`);
      } else {
        console.log(`#${o.fields.order_number} ${advName} -> NO ADVISOR MATCH`);
      }
    }
  });

  if (updates.length > 0) {
    console.log(`\nUpdating ${updates.length} orders...`);
    for (let i = 0; i < updates.length; i += 10) {
      await base('Orders').update(updates.slice(i, i + 10));
    }
    console.log('Done');
  }
}

main().catch(console.error);
