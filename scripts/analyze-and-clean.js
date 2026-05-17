#!/usr/bin/env node
/**
 * Analyze and Clean Airtable Data
 * 
 * This script produces a clear picture of what exists and proposes cleanup.
 */

const AIRTABLE_PAT = 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(endpoint) {
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` }
  });
  return res.json();
}

async function getAllRecords(tableId) {
  let records = [];
  let offset = null;
  do {
    const url = `/${BASE_ID}/${tableId}${offset ? '?offset=' + offset : ''}`;
    const data = await api(url);
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function main() {
  console.log('🔍 AIRTABLE DATA ANALYSIS\n');
  console.log('='.repeat(60));
  
  // Get schema
  const schema = await api(`/meta/bases/${BASE_ID}/tables`);
  const tableMap = {};
  schema.tables?.forEach(t => tableMap[t.name] = t.id);
  
  // ========================================
  // 1. ANALYZE GROUPS
  // ========================================
  console.log('\n📁 GROUPS TABLE ANALYSIS');
  console.log('-'.repeat(40));
  
  const groups = await getAllRecords(tableMap['Groups']);
  const trueFirms = []; // Multi-office or well-known
  const soloAdvisors = []; // Single person practices
  
  for (const g of groups) {
    const name = g.fields.Name || '';
    const regionCount = g.fields.Regions?.length || 0;
    const advisorCount = g.fields.Advisors?.length || 0;
    
    // Known multi-office firms
    const isKnownFirm = ['FTA', 'SAM RIA', 'AdvisorMax'].some(f => 
      name.toLowerCase().includes(f.toLowerCase())
    );
    
    if (isKnownFirm || regionCount > 1 || advisorCount > 1) {
      trueFirms.push({ name, regionCount, advisorCount, id: g.id });
    } else {
      soloAdvisors.push({ name, regionCount, advisorCount, id: g.id });
    }
  }
  
  console.log(`\nTrue Multi-Advisor Firms (${trueFirms.length}):`);
  trueFirms.forEach(f => console.log(`  ✓ ${f.name} (${f.regionCount} regions, ${f.advisorCount} advisors)`));
  
  console.log(`\nSolo/Single Advisors in Groups table (${soloAdvisors.length}):`);
  soloAdvisors.slice(0, 10).forEach(f => console.log(`  ○ ${f.name}`));
  if (soloAdvisors.length > 10) console.log(`  ... and ${soloAdvisors.length - 10} more`);
  
  // ========================================
  // 2. ANALYZE CURRENT "ADVISORS" TABLE
  // ========================================
  console.log('\n\n📋 CURRENT "ADVISORS" TABLE (actually businesses)');
  console.log('-'.repeat(40));
  
  const advisors = await getAllRecords(tableMap['Advisors']);
  const businessNames = advisors.map(a => a.fields.company_name || a.fields.contact_name || 'unnamed');
  
  console.log(`Records: ${advisors.length}`);
  console.log('Sample business names:');
  businessNames.slice(0, 10).forEach(n => console.log(`  - ${n}`));
  
  // Check overlap with Groups
  const groupNames = groups.map(g => (g.fields.Name || '').toLowerCase().trim());
  const advisorDuplicates = businessNames.filter(n => 
    groupNames.some(gn => gn.includes(n.toLowerCase()) || n.toLowerCase().includes(gn))
  );
  console.log(`\n⚠️  ${advisorDuplicates.length}/${advisors.length} appear to duplicate Groups`);
  
  // ========================================
  // 3. ANALYZE CLIENTS TABLE
  // ========================================
  console.log('\n\n👤 CLIENTS TABLE (actual advisor contacts)');
  console.log('-'.repeat(40));
  
  const clients = await getAllRecords(tableMap['Clients']);
  
  console.log(`Records: ${clients.length}`);
  console.log('Fields used:');
  const fieldUsage = {};
  clients.forEach(c => {
    Object.keys(c.fields).forEach(f => {
      fieldUsage[f] = (fieldUsage[f] || 0) + 1;
    });
  });
  
  const usedFields = Object.entries(fieldUsage)
    .filter(([k, v]) => v > 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  usedFields.forEach(([f, count]) => console.log(`  ${f}: ${count}/${clients.length}`));
  
  // ========================================
  // 4. ANALYZE ORDERS
  // ========================================
  console.log('\n\n📦 ORDERS TABLE');
  console.log('-'.repeat(40));
  
  const orders = await getAllRecords(tableMap['Orders']);
  
  console.log(`Total orders: ${orders.length}`);
  
  // Count orders by status
  const byStatus = {};
  orders.forEach(o => {
    const status = o.fields.status || 'No Status';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });
  console.log('\nBy status:');
  Object.entries(byStatus).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
  
  // Count orders with multiple event dates
  let multiDateOrders = 0;
  orders.forEach(o => {
    const dates = [
      o.fields.first_event_date,
      o.fields.second_event_date,
      o.fields.third_event_date,
      o.fields.fourth_event_date
    ].filter(Boolean);
    if (dates.length > 1) multiDateOrders++;
  });
  console.log(`\nOrders with multiple dates: ${multiDateOrders}`);
  
  // ========================================
  // 5. RECOMMENDATIONS
  // ========================================
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 RECOMMENDED CLEANUP ACTIONS');
  console.log('='.repeat(60));
  
  console.log(`
1. GROUPS TABLE (keep, but clean up)
   - Remove solo advisors (${soloAdvisors.length} records)
   - Keep only true firms: FTA, SAM RIA, Bone Asset, Eagle, Scout, etc.
   - Add missing: O'Toole Group, Kelly Capital, Advanced Wealth

2. DELETE CURRENT "ADVISORS" TABLE
   - It duplicates Groups with worse data
   - Business info belongs in Groups, contact info in Clients

3. RENAME "CLIENTS" → "ADVISORS"
   - This table has the actual advisor contacts
   - Add link to Groups for firm affiliation
   - Add link to primary Region

4. ORDERS TABLE
   - Add link to new Venues table (created: 168 venues)
   - Consider: flatten ${multiDateOrders} multi-date orders into Events

5. ADD ROLLUP FIELDS
   - Groups: Order count, Advisor count
   - Regions: Order count, Venue count
   - Advisors: Order count, Total mailings
   - Orders: Event count, Registration count

6. EVENTS TABLE (create)
   - One row per seminar date
   - Links: Order, Venue, Registrations
   - Enables proper calendar views
`);
  
  // ========================================
  // 6. CLEANUP SCRIPT OUTPUT
  // ========================================
  console.log('\n\n' + '='.repeat(60));
  console.log('🔧 CLEANUP READY');
  console.log('='.repeat(60));
  console.log('\nRun: node scripts/execute-cleanup.js');
  console.log('\nThis will:');
  console.log('  1. Create cleaned Groups from current data');
  console.log('  2. Rename Clients → Advisors');
  console.log('  3. Add proper links between tables');
  console.log('  4. Delete redundant old Advisors table');
}

main().catch(e => console.error('Error:', e.message));
