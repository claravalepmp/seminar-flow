#!/usr/bin/env node
/**
 * Sync mailing quantities from Orders to DM Jobs
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

async function sync() {
  console.log('🔄 SYNC QUANTITIES: Orders → DM Jobs\n');
  
  const [orders, dmJobs] = await Promise.all([
    fetchAll('Orders'),
    fetchAll('Direct_Mail_Jobs'),
  ]);
  
  // Build order lookup by ID
  const orderById = new Map();
  orders.forEach(o => orderById.set(o.id, o));
  
  // Find DM Jobs without quantity but linked to order with quantity
  const fixable = [];
  
  dmJobs.forEach(dm => {
    const qty = dm.fields.quantity;
    if (qty && qty > 0) return; // Already has quantity
    
    const orderLink = dm.fields.order || [];
    if (orderLink.length === 0) return; // No linked order
    
    const order = orderById.get(orderLink[0]);
    if (!order) return; // Order not found
    
    const orderQty = order.fields.mailing_quantity;
    if (!orderQty || orderQty <= 0) return; // Order has no quantity
    
    fixable.push({
      dmId: dm.id,
      orderNumber: dm.fields.order_number,
      advisor: dm.fields['Advisor Name'],
      quantity: orderQty,
    });
  });
  
  console.log(`DM Jobs to update: ${fixable.length}\n`);
  
  if (fixable.length === 0) {
    console.log('Nothing to sync - all quantities already set or no source data');
    return;
  }
  
  // Apply updates
  let updated = 0;
  for (const f of fixable) {
    try {
      await base('Direct_Mail_Jobs').update(f.dmId, {
        quantity: f.quantity,
      });
      console.log(`  ✓ Order #${f.orderNumber}: ${f.quantity.toLocaleString()} pieces`);
      updated++;
    } catch (err) {
      console.log(`  ✗ Order #${f.orderNumber}: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Updated ${updated} DM Jobs`);
}

sync().catch(console.error);
