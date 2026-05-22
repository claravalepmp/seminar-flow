#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

async function fetchAll(tableName) {
  const records = [];
  await base(tableName).select().eachPage((page, next) => {
    records.push(...page);
    next();
  });
  return records;
}

async function analyze() {
  const [orders, dmJobs] = await Promise.all([
    fetchAll('Orders'),
    fetchAll('Direct_Mail_Jobs'),
  ]);
  
  // All order numbers in Orders table
  const existingNums = new Set(orders.map(o => o.fields.order_number).filter(Boolean));
  const maxOrderNum = Math.max(...existingNums);
  
  console.log(`📦 Orders table: ${orders.length} records`);
  console.log(`   Order numbers: ${Math.min(...existingNums)} to ${maxOrderNum}\n`);
  
  // Find orphaned DM jobs
  const orphaned = dmJobs.filter(dm => !(dm.fields.order?.length > 0));
  
  console.log(`📬 Orphaned DM Jobs: ${orphaned.length}\n`);
  console.log('Details:\n');
  
  orphaned.forEach(dm => {
    const f = dm.fields;
    const num = f.order_number;
    const exists = existingNums.has(num);
    const isNew = num > maxOrderNum;
    
    console.log(`Order #${num || '?'}: ${f['Advisor Name'] || '(no advisor)'}`);
    console.log(`   Exists in Orders table: ${exists ? '✅ YES' : '❌ NO'}`);
    console.log(`   Status: ${f.status}`);
    console.log(`   Date: ${f['First Event Date'] || '(no date)'}`);
    console.log(`   Venue: ${f['Venue Name'] || '(no venue)'}`);
    console.log(`   Group: ${f['Group Name'] || '(no group)'}`);
    if (isNew) console.log(`   ⚡ NEW ORDER (> max #${maxOrderNum})`);
    console.log('');
  });
  
  // Check for these specific numbers
  const orphanNums = orphaned.map(dm => dm.fields.order_number).filter(Boolean);
  console.log('---');
  console.log('Missing order numbers:', orphanNums.sort((a, b) => a - b).join(', '));
}

analyze().catch(console.error);
