#!/usr/bin/env node
/**
 * Create missing Order records from orphaned DM Jobs
 */

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

async function createMissingOrders() {
  console.log('🔧 CREATE MISSING ORDERS FROM DM JOBS\n');
  
  const [orders, dmJobs, advisors, groups] = await Promise.all([
    fetchAll('Orders'),
    fetchAll('Direct_Mail_Jobs'),
    fetchAll('Advisors'),
    fetchAll('Groups'),
  ]);
  
  // Build lookups
  const existingNums = new Set(orders.map(o => o.fields.order_number).filter(Boolean));
  const advisorByName = new Map();
  advisors.forEach(a => {
    const name = a.fields.advisor_name || a.fields.Name || '';
    if (name) advisorByName.set(name.toLowerCase(), a.id);
  });
  const groupByName = new Map();
  groups.forEach(g => {
    const name = g.fields.Name || '';
    if (name) groupByName.set(name.toLowerCase(), g.id);
  });
  
  console.log(`Existing orders: ${existingNums.size}`);
  console.log(`Advisors: ${advisorByName.size}`);
  console.log(`Groups: ${groupByName.size}\n`);
  
  // Find orphaned DM Jobs
  const orphaned = dmJobs.filter(dm => {
    const orderLink = dm.fields.order || [];
    return orderLink.length === 0;
  });
  
  console.log(`Orphaned DM Jobs: ${orphaned.length}\n`);
  
  // Create orders
  let created = 0;
  let linked = 0;
  
  for (const dm of orphaned) {
    const f = dm.fields;
    const orderNum = f.order_number;
    
    if (!orderNum) {
      console.log(`⚠️  Skipping DM Job (no order number): ${f['Advisor Name']}`);
      continue;
    }
    
    if (existingNums.has(orderNum)) {
      console.log(`⚠️  Order #${orderNum} already exists but DM Job not linked`);
      continue;
    }
    
    // Find advisor and group
    const advisorName = f['Advisor Name'] || '';
    const groupName = f['Group Name'] || '';
    const advisorId = advisorByName.get(advisorName.toLowerCase());
    const groupId = groupByName.get(groupName.toLowerCase());
    
    // Build order record
    const orderFields = {
      order_number: orderNum,
      advisor: advisorName,
      group_name: groupName,
      first_event_date: f['First Event Date'] || null,
      second_event_date: f['Second Event Date'] || null,
      venue_name: f['Venue Name'] || '',
      venue_address: f['Venue Address'] || '',
      start_time: f['Start Time'] || '',
      end_time: f['End Time'] || '',
      landing_page_url: f['Landing Page URL'] || '',
      mailer_type: f['Mailer Type'] || '',
      mailing_quantity: f.quantity || 0,
      needs_direct_mail: true,
      status: 'pending',
    };
    
    // Add links if found
    if (advisorId) orderFields.Advisor_Link = [advisorId];
    if (groupId) orderFields.Group = [groupId];
    
    try {
      console.log(`Creating Order #${orderNum}: ${advisorName}...`);
      const newOrder = await base('Orders').create(orderFields);
      created++;
      existingNums.add(orderNum);
      
      // Link DM Job to new Order
      await base('Direct_Mail_Jobs').update(dm.id, {
        order: [newOrder.id],
      });
      linked++;
      console.log(`   ✓ Created & linked`);
      
    } catch (err) {
      console.log(`   ✗ Failed: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Done! Created ${created} orders, linked ${linked} DM Jobs`);
}

createMissingOrders().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
