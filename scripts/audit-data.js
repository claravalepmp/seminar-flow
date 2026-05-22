#!/usr/bin/env node
/**
 * Airtable Data Audit
 * Checks for common data quality issues
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

async function audit() {
  console.log('🔍 AIRTABLE DATA AUDIT\n');
  console.log('='.repeat(60));
  
  // Fetch all tables
  console.log('\n📥 Fetching data...');
  const [orders, advisors, groups, regions, charities, dmJobs] = await Promise.all([
    fetchAll('Orders'),
    fetchAll('Advisors'),
    fetchAll('Groups'),
    fetchAll('Regions'),
    fetchAll('Charities'),
    fetchAll('Direct_Mail_Jobs'),
  ]);
  
  console.log(`   Orders: ${orders.length}`);
  console.log(`   Advisors: ${advisors.length}`);
  console.log(`   Groups: ${groups.length}`);
  console.log(`   Regions: ${regions.length}`);
  console.log(`   Charities: ${charities.length}`);
  console.log(`   DM Jobs: ${dmJobs.length}`);
  
  const issues = [];
  
  // ============ ORDERS AUDIT ============
  console.log('\n' + '='.repeat(60));
  console.log('📋 ORDERS AUDIT');
  console.log('='.repeat(60));
  
  let ordersNoAdvisor = 0;
  let ordersNoGroup = 0;
  let ordersNoDates = 0;
  let ordersNoVenue = 0;
  let ordersDupeNumbers = new Map();
  
  orders.forEach(o => {
    const f = o.fields;
    const num = f['Order Number'] || f.order_number;
    
    // Track duplicates
    if (num) {
      if (!ordersDupeNumbers.has(num)) ordersDupeNumbers.set(num, []);
      ordersDupeNumbers.get(num).push(o.id);
    }
    
    // Check links - correct field names from schema
    const advisorLink = f.Advisor_Link || f.client || [];
    const groupLink = f.Group || [];
    
    if (!advisorLink.length) ordersNoAdvisor++;
    if (!groupLink.length) ordersNoGroup++;
    
    // Check required fields
    const date1 = f['First Event Date'] || f['Event Date 1'] || f.first_event_date;
    if (!date1) ordersNoDates++;
    
    const venue = f['Venue Name'] || f.venue_name || f.Venue;
    if (!venue) ordersNoVenue++;
  });
  
  // Find actual duplicates
  const dupes = [...ordersDupeNumbers.entries()].filter(([num, ids]) => ids.length > 1);
  
  console.log(`\n❌ Orders without Advisor link: ${ordersNoAdvisor}`);
  console.log(`❌ Orders without Group link: ${ordersNoGroup}`);
  console.log(`❌ Orders without event date: ${ordersNoDates}`);
  console.log(`❌ Orders without venue: ${ordersNoVenue}`);
  console.log(`❌ Duplicate order numbers: ${dupes.length}`);
  
  if (dupes.length > 0) {
    console.log('\n   Duplicates:');
    dupes.slice(0, 10).forEach(([num, ids]) => {
      console.log(`   - Order #${num}: ${ids.length} records`);
    });
    if (dupes.length > 10) console.log(`   ... and ${dupes.length - 10} more`);
  }
  
  if (ordersNoAdvisor > 0) {
    issues.push({ type: 'orders_no_advisor', count: ordersNoAdvisor });
  }
  if (ordersNoGroup > 0) {
    issues.push({ type: 'orders_no_group', count: ordersNoGroup });
  }
  
  // ============ ADVISORS AUDIT ============
  console.log('\n' + '='.repeat(60));
  console.log('👤 ADVISORS AUDIT');
  console.log('='.repeat(60));
  
  let advisorsNoGroup = 0;
  let advisorsNoOrders = 0;
  let advisorsNoName = 0;
  const advisorsWithoutGroup = [];
  
  advisors.forEach(a => {
    const f = a.fields;
    const name = f.Name || f['Advisor Name'] || f.advisor_name || '';
    const groupLink = f.Group || f.Groups || f.group || [];
    const ordersLink = f.Orders || [];
    
    if (!name.trim()) advisorsNoName++;
    if (!groupLink.length) {
      advisorsNoGroup++;
      advisorsWithoutGroup.push(name || a.id);
    }
    if (!ordersLink.length) advisorsNoOrders++;
  });
  
  console.log(`\n❌ Advisors without Group: ${advisorsNoGroup}`);
  console.log(`⚠️  Advisors without Orders: ${advisorsNoOrders}`);
  console.log(`❌ Advisors without Name: ${advisorsNoName}`);
  
  if (advisorsWithoutGroup.length > 0) {
    console.log('\n   Missing group:');
    advisorsWithoutGroup.slice(0, 15).forEach(n => console.log(`   - ${n}`));
    if (advisorsWithoutGroup.length > 15) console.log(`   ... and ${advisorsWithoutGroup.length - 15} more`);
    issues.push({ type: 'advisors_no_group', count: advisorsNoGroup, names: advisorsWithoutGroup });
  }
  
  // ============ DM JOBS AUDIT ============
  console.log('\n' + '='.repeat(60));
  console.log('📬 DIRECT MAIL JOBS AUDIT');
  console.log('='.repeat(60));
  
  let dmNoOrder = 0;
  let dmNoStatus = 0;
  let dmNoQuantity = 0;
  const statusCounts = {};
  
  dmJobs.forEach(dm => {
    const f = dm.fields;
    const orderLink = f.order || [];  // lowercase 'order' field
    const status = f.status || '';
    const qty = f.quantity || 0;
    
    if (!orderLink.length) dmNoOrder++;
    if (!status) dmNoStatus++;
    if (!qty) dmNoQuantity++;
    
    statusCounts[status || '(empty)'] = (statusCounts[status || '(empty)'] || 0) + 1;
  });
  
  console.log(`\n❌ DM Jobs without Order link: ${dmNoOrder}`);
  console.log(`❌ DM Jobs without Status: ${dmNoStatus}`);
  console.log(`⚠️  DM Jobs without Quantity: ${dmNoQuantity}`);
  console.log('\n   Status breakdown:');
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
    console.log(`   - ${s}: ${c}`);
  });
  
  // ============ GROUPS AUDIT ============
  console.log('\n' + '='.repeat(60));
  console.log('🏢 GROUPS AUDIT');
  console.log('='.repeat(60));
  
  let groupsNoAdvisors = 0;
  let groupsNoName = 0;
  
  groups.forEach(g => {
    const f = g.fields;
    const name = f.Name || '';
    const advisorLink = f.Clients || f.Advisors || [];
    
    if (!name.trim()) groupsNoName++;
    if (!advisorLink.length) groupsNoAdvisors++;
  });
  
  console.log(`\n⚠️  Groups without Advisors: ${groupsNoAdvisors}`);
  console.log(`❌ Groups without Name: ${groupsNoName}`);
  
  // ============ SUMMARY ============
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const totalIssues = ordersNoAdvisor + ordersNoGroup + advisorsNoGroup + dmNoOrder + dmNoStatus;
  
  if (totalIssues === 0) {
    console.log('\n✅ No critical issues found!');
  } else {
    console.log(`\n⚠️  Total critical issues: ${totalIssues}`);
    console.log('\nPriority fixes:');
    if (ordersNoAdvisor > 0) console.log(`   1. Link ${ordersNoAdvisor} orders to advisors`);
    if (ordersNoGroup > 0) console.log(`   2. Link ${ordersNoGroup} orders to groups`);
    if (advisorsNoGroup > 0) console.log(`   3. Link ${advisorsNoGroup} advisors to groups`);
    if (dmNoOrder > 0) console.log(`   4. Link ${dmNoOrder} DM jobs to orders`);
  }
  
  return { issues, stats: { orders: orders.length, advisors: advisors.length, groups: groups.length, dmJobs: dmJobs.length } };
}

audit().then(result => {
  console.log('\n✅ Audit complete');
}).catch(err => {
  console.error('❌ Audit failed:', err.message);
  process.exit(1);
});
