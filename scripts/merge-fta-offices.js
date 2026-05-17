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

async function batchUpdate(table, updates) {
  for (let i = 0; i < updates.length; i += 10) {
    await base(table).update(updates.slice(i, i + 10));
    process.stdout.write(`  ${Math.min(i + 10, updates.length)}/${updates.length}\r`);
  }
  console.log('');
}

async function main() {
  console.log('Loading...');
  const [advisors, orders, regions] = await Promise.all([
    getAllRecords('Advisors'),
    getAllRecords('Orders'),
    getAllRecords('Regions'),
  ]);

  // FTA office "advisors" to merge - these are locations not people
  const officeNames = [
    'FTA STL', 'FTA Chicago', 'FTA Nashville', 'FTA TX', 'FTA Dallas', 
    'FTA NSV', 'FTA St. Louis', 'Chicago', 'Dallas', 'FTA'
  ];

  const officeAdvisors = advisors.filter(a => 
    officeNames.some(name => a.fields.advisor_name?.toLowerCase() === name.toLowerCase())
  );

  console.log(`\nFTA office "advisors" to process: ${officeAdvisors.length}`);
  officeAdvisors.forEach(a => {
    console.log(`  ${a.fields.advisor_name}: ${(a.fields.Orders || []).length} orders`);
  });

  // Get all their order IDs
  const officeOrderIds = new Set();
  officeAdvisors.forEach(a => {
    (a.fields.Orders || []).forEach(oid => officeOrderIds.add(oid));
  });
  console.log(`\nTotal orders from office advisors: ${officeOrderIds.size}`);

  // These orders need to have their advisor_name updated to show the actual office
  // But keep them linked to FTA group
  
  // For now, let's just make sure all FTA orders are properly linked to FTA group
  // and the regions are properly set based on venue address

  console.log('\n=== FIXING REGIONS BASED ON VENUE STATE ===');
  
  // Build state -> region map
  const stateRegions = {
    'IL': [], 'TX': [], 'MO': [], 'TN': [], 'CA': [], 'AZ': [], 'MD': [], 'PA': [], 
    'CT': [], 'FL': [], 'NC': [], 'CO': [], 'RI': [], 'OH': [], 'MI': [], 'NJ': [],
    'KS': [], 'SC': [], 'MA': []
  };

  // Find or create regions for each state
  regions.forEach(r => {
    const state = r.fields.State;
    if (state && stateRegions[state]) {
      stateRegions[state].push(r.id);
    }
  });

  console.log('State -> Region mapping:');
  Object.entries(stateRegions).forEach(([state, rids]) => {
    if (rids.length > 0) {
      const names = rids.map(rid => regions.find(r => r.id === rid)?.fields.Name).join(', ');
      console.log(`  ${state}: ${names}`);
    }
  });

  // Create regions for states that don't have one
  const statesToCreate = Object.entries(stateRegions).filter(([s, r]) => r.length === 0).map(([s]) => s);
  if (statesToCreate.length > 0) {
    console.log(`\nCreating regions for: ${statesToCreate.join(', ')}`);
    const stateNames = {
      'IL': 'Illinois', 'TX': 'Texas', 'MO': 'Missouri', 'TN': 'Tennessee',
      'CA': 'California', 'AZ': 'Arizona', 'MD': 'Maryland', 'PA': 'Pennsylvania',
      'CT': 'Connecticut', 'FL': 'Florida', 'NC': 'North Carolina', 'CO': 'Colorado',
      'RI': 'Rhode Island', 'OH': 'Ohio', 'MI': 'Michigan', 'NJ': 'New Jersey',
      'KS': 'Kansas', 'SC': 'South Carolina', 'MA': 'Massachusetts'
    };
    
    for (const state of statesToCreate) {
      const created = await base('Regions').create({ Name: stateNames[state] || state, State: state });
      stateRegions[state].push(created.id);
      console.log(`  Created: ${stateNames[state] || state} (${state})`);
    }
  }

  // Now link all orders to regions based on venue state
  console.log('\n=== LINKING ORDERS TO REGIONS BY STATE ===');
  let orderRegionUpdates = [];
  
  orders.forEach(o => {
    const addr = o.fields.venue_address || '';
    const stateMatch = addr.match(/,\s*([A-Z]{2})\s*\d{5}/i) || addr.match(/,\s*([A-Z]{2})\s*$/i);
    
    if (stateMatch) {
      const state = stateMatch[1].toUpperCase();
      const regionIds = stateRegions[state];
      
      if (regionIds && regionIds.length > 0) {
        const currentRegion = o.fields.Region || [];
        if (currentRegion.length === 0 || !currentRegion.includes(regionIds[0])) {
          orderRegionUpdates.push({
            id: o.id,
            fields: { Region: [regionIds[0]] }
          });
        }
      }
    }
  });

  console.log(`Orders to update with regions: ${orderRegionUpdates.length}`);
  if (orderRegionUpdates.length > 0) {
    await batchUpdate('Orders', orderRegionUpdates);
  }

  // Now update FTA group with all regions from its orders
  console.log('\n=== UPDATING FTA GROUP REGIONS ===');
  const freshOrders = await getAllRecords('Orders');
  const ftaGroup = (await getAllRecords('Groups')).find(g => g.fields.Name === 'FTA');
  
  const ftaRegionIds = new Set();
  freshOrders.forEach(o => {
    if (o.fields.Group?.includes(ftaGroup.id)) {
      (o.fields.Region || []).forEach(rid => ftaRegionIds.add(rid));
    }
  });

  const currentFtaRegions = ftaGroup.fields.Regions || [];
  const allFtaRegions = [...new Set([...currentFtaRegions, ...ftaRegionIds])];
  
  if (allFtaRegions.length > currentFtaRegions.length) {
    await base('Groups').update(ftaGroup.id, { Regions: allFtaRegions });
    console.log(`Updated FTA: ${currentFtaRegions.length} -> ${allFtaRegions.length} regions`);
  }

  // Show final state
  const freshRegions = await getAllRecords('Regions');
  console.log('\n=== FINAL FTA REGIONS ===');
  allFtaRegions.forEach(rid => {
    const r = freshRegions.find(reg => reg.id === rid);
    if (r) console.log(`  ${r.fields.Name} (${r.fields.State || '?'})`);
  });

  console.log('\n✅ Done');
}

main().catch(console.error);
