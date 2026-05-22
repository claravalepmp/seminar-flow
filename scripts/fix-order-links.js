#!/usr/bin/env node
/**
 * Fix Orders without Advisor or Group links
 * Matches by advisor text field and group_name text field
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
  console.log('🔧 FIX ORDER LINKS\n');
  
  const [orders, advisors, groups] = await Promise.all([
    fetchAll('Orders'),
    fetchAll('Advisors'),
    fetchAll('Groups'),
  ]);
  
  // Build lookups
  const advisorByName = new Map();
  advisors.forEach(a => {
    const name = (a.fields.advisor_name || a.fields.Name || '').toLowerCase().trim();
    if (name) advisorByName.set(name, a.id);
  });
  
  const groupByName = new Map();
  groups.forEach(g => {
    const name = (g.fields.Name || '').toLowerCase().trim();
    if (name) groupByName.set(name, g.id);
  });
  
  console.log(`Advisors indexed: ${advisorByName.size}`);
  console.log(`Groups indexed: ${groupByName.size}\n`);
  
  // Find orders needing fixes
  let fixedAdvisor = 0;
  let fixedGroup = 0;
  
  for (const o of orders) {
    const f = o.fields;
    const advisorLink = f.Advisor_Link || f.client || [];
    const groupLink = f.Group || [];
    const updates = {};
    
    // Fix advisor link
    if (advisorLink.length === 0) {
      const advisorText = (f.advisor || '').toLowerCase().trim();
      if (advisorText && advisorByName.has(advisorText)) {
        updates.Advisor_Link = [advisorByName.get(advisorText)];
        console.log(`Order #${f.order_number}: Link advisor "${f.advisor}"`);
      } else if (advisorText) {
        console.log(`Order #${f.order_number}: ❌ Advisor "${f.advisor}" not found in Advisors table`);
      }
    }
    
    // Fix group link
    if (groupLink.length === 0) {
      const groupText = (f.group_name || '').toLowerCase().trim();
      if (groupText && groupByName.has(groupText)) {
        updates.Group = [groupByName.get(groupText)];
        console.log(`Order #${f.order_number}: Link group "${f.group_name}"`);
      } else if (groupText) {
        console.log(`Order #${f.order_number}: ❌ Group "${f.group_name}" not found in Groups table`);
      }
    }
    
    // Apply updates
    if (Object.keys(updates).length > 0) {
      try {
        await base('Orders').update(o.id, updates);
        if (updates.Advisor_Link) fixedAdvisor++;
        if (updates.Group) fixedGroup++;
      } catch (err) {
        console.log(`   ✗ Failed Order #${f.order_number}: ${err.message}`);
      }
    }
  }
  
  console.log(`\n✅ Fixed ${fixedAdvisor} advisor links, ${fixedGroup} group links`);
}

fix().catch(console.error);
