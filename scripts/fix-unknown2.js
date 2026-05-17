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
  const [orders, dmJobs, groups] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Direct_Mail_Jobs'),
    getAllRecords('Groups'),
  ]);

  // Find orders without group
  const noGroup = orders.filter(o => !o.fields.Group || o.fields.Group.length === 0);
  console.log(`Orders without group: ${noGroup.length}\n`);

  // Check their DM jobs for group info
  noGroup.forEach(o => {
    const orderNum = o.fields.order_number;
    const dmJob = dmJobs.find(dm => dm.fields.order_number === orderNum);
    
    console.log(`#${orderNum} ${o.fields.advisor}`);
    if (dmJob) {
      console.log(`  DM Group: ${dmJob.fields['Group Name'] || dmJob.fields.group_name || 'NONE'}`);
      console.log(`  DM Group Link: ${dmJob.fields.Group ? 'YES' : 'NO'}`);
    } else {
      console.log(`  NO DM JOB`);
    }
  });

  // Link orders to groups via their DM jobs
  console.log('\n=== LINKING VIA DM JOBS ===');
  let updates = [];
  for (const o of noGroup) {
    const dmJobIds = o.fields.Direct_Mail_Jobs || [];
    if (dmJobIds.length > 0) {
      const dmJob = dmJobs.find(dm => dm.id === dmJobIds[0]);
      if (dmJob && dmJob.fields.Group && dmJob.fields.Group.length > 0) {
        updates.push({
          id: o.id,
          fields: { Group: dmJob.fields.Group }
        });
        const grp = groups.find(g => g.id === dmJob.fields.Group[0]);
        console.log(`#${o.fields.order_number} -> ${grp?.fields.Name || 'UNKNOWN'}`);
      }
    }
  }

  if (updates.length > 0) {
    console.log(`\nUpdating ${updates.length} orders...`);
    for (let i = 0; i < updates.length; i += 10) {
      await base('Orders').update(updates.slice(i, i + 10));
    }
    console.log('Done');
  } else {
    console.log('\nNo orders to update via DM jobs');
  }
}

main().catch(console.error);
