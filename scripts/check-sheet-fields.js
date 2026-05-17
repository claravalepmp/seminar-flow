const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

async function main() {
  const dmJobs = [];
  await base('Direct_Mail_Jobs').select({maxRecords: 5}).eachPage((records, next) => {
    dmJobs.push(...records);
    next();
  });

  console.log('DM JOB FIELDS:');
  const first = dmJobs[0];
  Object.keys(first.fields).sort().forEach(k => {
    console.log(`  ${k}: ${JSON.stringify(first.fields[k]).slice(0,60)}`);
  });

  // Check for Office Location
  const hasOffice = dmJobs.filter(dm => dm.fields['Office Location']);
  console.log(`\nDM jobs with Office Location: ${hasOffice.length}/${dmJobs.length}`);
  
  // Check orders
  const orders = [];
  await base('Orders').select({maxRecords: 5}).eachPage((records, next) => {
    orders.push(...records);
    next();
  });

  console.log('\nORDER FIELDS:');
  Object.keys(orders[0].fields).sort().forEach(k => {
    console.log(`  ${k}: ${JSON.stringify(orders[0].fields[k]).slice(0,60)}`);
  });
}

main().catch(console.error);
