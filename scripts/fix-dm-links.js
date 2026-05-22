#!/usr/bin/env node
/**
 * Fix DM Jobs without Order links
 * Matches by order_number
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

async function fix() {
  console.log('🔧 FIX DM JOBS WITHOUT ORDER LINKS\n');
  
  // Fetch data
  const [orders, dmJobs] = await Promise.all([
    fetchAll('Orders'),
    fetchAll('Direct_Mail_Jobs'),
  ]);
  
  console.log(`📦 Orders: ${orders.length}`);
  console.log(`📬 DM Jobs: ${dmJobs.length}\n`);
  
  // Build order lookup by order_number
  const orderByNumber = new Map();
  orders.forEach(o => {
    const num = o.fields.order_number;
    if (num) orderByNumber.set(num, o.id);
  });
  
  // Find orphaned DM jobs
  const orphaned = dmJobs.filter(dm => {
    const orderLink = dm.fields.order || [];
    return orderLink.length === 0;
  });
  
  console.log(`❌ Orphaned DM Jobs: ${orphaned.length}\n`);
  
  if (orphaned.length === 0) {
    console.log('✅ Nothing to fix!');
    return;
  }
  
  // Try to match by order_number
  const fixable = [];
  const unfixable = [];
  
  orphaned.forEach(dm => {
    const dmOrderNum = dm.fields.order_number;
    const dmAdvisor = dm.fields['Advisor Name'] || '';
    const dmVenue = dm.fields['Venue Name'] || '';
    
    if (dmOrderNum && orderByNumber.has(dmOrderNum)) {
      fixable.push({
        dmId: dm.id,
        orderId: orderByNumber.get(dmOrderNum),
        orderNumber: dmOrderNum,
        advisor: dmAdvisor,
      });
    } else {
      unfixable.push({
        dmId: dm.id,
        orderNumber: dmOrderNum || '(none)',
        advisor: dmAdvisor,
        venue: dmVenue,
      });
    }
  });
  
  console.log(`✅ Fixable (matched by order#): ${fixable.length}`);
  console.log(`❌ Unfixable (no matching order): ${unfixable.length}\n`);
  
  // Show what we'll fix
  if (fixable.length > 0) {
    console.log('Will link:');
    fixable.forEach(f => {
      console.log(`   DM Job → Order #${f.orderNumber} (${f.advisor})`);
    });
  }
  
  // Show unfixable
  if (unfixable.length > 0) {
    console.log('\n⚠️  Cannot fix (no matching order):');
    unfixable.forEach(u => {
      console.log(`   Order #${u.orderNumber}: ${u.advisor || u.venue || '(no info)'}`);
    });
  }
  
  // Apply fixes
  if (fixable.length > 0) {
    console.log('\n🔄 Applying fixes...');
    
    for (const f of fixable) {
      try {
        await base('Direct_Mail_Jobs').update(f.dmId, {
          order: [f.orderId],
        });
        console.log(`   ✓ Linked Order #${f.orderNumber}`);
      } catch (err) {
        console.log(`   ✗ Failed Order #${f.orderNumber}: ${err.message}`);
      }
    }
    
    console.log('\n✅ Done!');
  }
}

fix().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
