const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

async function main() {
  const dmJobs = [];
  await base('Direct_Mail_Jobs').select().eachPage((records, next) => {
    dmJobs.push(...records);
    next();
  });

  console.log(`Direct_Mail_Jobs: ${dmJobs.length} records\n`);

  // Show all unique statuses
  const statuses = new Map();
  dmJobs.forEach(dm => {
    const status = dm.fields.status || 'NO STATUS';
    statuses.set(status, (statuses.get(status) || 0) + 1);
  });
  console.log('STATUSES:');
  [...statuses.entries()].sort((a,b) => b[1] - a[1]).forEach(([s, c]) => {
    console.log(`  ${s}: ${c}`);
  });

  // Show all fields on first record
  console.log('\nALL FIELDS ON FIRST RECORD:');
  const first = dmJobs[0];
  Object.keys(first.fields).sort().forEach(k => {
    const v = first.fields[k];
    const display = typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : v;
    console.log(`  ${k}: ${display}`);
  });

  // Check order links
  const withOrderLink = dmJobs.filter(dm => dm.fields.order?.length > 0).length;
  console.log(`\nDM Jobs with order link: ${withOrderLink}/${dmJobs.length}`);
}

main().catch(console.error);
