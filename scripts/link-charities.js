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

async function main() {
  const [orders, charities] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Charities'),
  ]);

  console.log('Charities in Airtable:');
  charities.forEach(c => console.log(`  ${c.id}: ${c.fields.Name} (${c.fields['Short Name'] || 'no short'})`));

  console.log('\nOrders with Charity field linked:', orders.filter(o => o.fields.Charity?.length > 0).length);
  
  // Check all fields on orders for charity references
  const sampleOrder = orders[0];
  console.log('\nAll fields on first order:');
  Object.keys(sampleOrder.fields).forEach(k => {
    console.log(`  ${k}: ${typeof sampleOrder.fields[k]} = ${JSON.stringify(sampleOrder.fields[k]).slice(0, 100)}`);
  });

  // Build charity lookup
  const charityByName = new Map();
  charities.forEach(c => {
    if (c.fields.Name) charityByName.set(c.fields.Name.toLowerCase().trim(), c.id);
    if (c.fields['Short Name']) charityByName.set(c.fields['Short Name'].toLowerCase().trim(), c.id);
  });

  // FTA orders should use specific charities based on region
  // Chicago area -> Township of Schaumburg or HCS
  // STL area -> Crisis Nursery or Glen-Ed Pantry
  // Dallas -> North Texas Food Bank

  console.log('\nLinking charities to FTA orders by region...');
  let updates = [];
  
  orders.forEach(o => {
    if (o.fields.Charity && o.fields.Charity.length > 0) return; // Already has charity
    
    const groupName = o.fields.group_name || '';
    const venue = (o.fields.venue_name || '').toLowerCase();
    const addr = (o.fields.venue_address || '').toLowerCase();
    
    // Only for FTA for now
    if (!groupName.includes('FTA')) return;
    
    let charityId = null;
    
    // Chicago area
    if (addr.includes(', il') || venue.includes('schaumburg') || venue.includes('oakton') || venue.includes('oak brook') || venue.includes('rolling meadows')) {
      charityId = charityByName.get('township of schaumburg') || charityByName.get('hcs') || charityByName.get('tos');
    }
    // STL area
    else if (addr.includes(', mo') || venue.includes('st. louis') || venue.includes('stl')) {
      charityId = charityByName.get('crisis nursery') || charityByName.get('glen-ed pantry');
    }
    // Dallas area
    else if (addr.includes(', tx') || venue.includes('dallas') || venue.includes('texas')) {
      charityId = charityByName.get('north texas food bank');
    }
    
    if (charityId) {
      updates.push({ id: o.id, fields: { Charity: [charityId] } });
    }
  });

  console.log(`Orders to link to charities: ${updates.length}`);
  
  if (updates.length > 0) {
    for (let i = 0; i < updates.length; i += 10) {
      await base('Orders').update(updates.slice(i, i + 10));
      process.stdout.write(`  ${Math.min(i + 10, updates.length)}/${updates.length}\r`);
    }
    console.log('');
  }

  // Now link charities to groups
  console.log('\nNow linking charities to groups...');
  const freshOrders = await getAllRecords('Orders');
  const groups = await getAllRecords('Groups');
  
  const groupCharities = new Map();
  freshOrders.forEach(o => {
    if (o.fields.Group?.length > 0 && o.fields.Charity?.length > 0) {
      const gid = o.fields.Group[0];
      if (!groupCharities.has(gid)) groupCharities.set(gid, new Set());
      o.fields.Charity.forEach(cid => groupCharities.get(gid).add(cid));
    }
  });

  let grpUpdates = [];
  for (const [gid, charSet] of groupCharities) {
    const grp = groups.find(g => g.id === gid);
    if (grp) {
      const existing = new Set(grp.fields.Charities || []);
      const all = [...new Set([...existing, ...charSet])];
      if (all.length > existing.size) {
        grpUpdates.push({ id: gid, fields: { Charities: all } });
      }
    }
  }
  
  console.log(`Groups to update with charities: ${grpUpdates.length}`);
  if (grpUpdates.length > 0) {
    for (let i = 0; i < grpUpdates.length; i += 10) {
      await base('Groups').update(grpUpdates.slice(i, i + 10));
    }
  }

  // Also reverse link
  const charityGroups = new Map();
  for (const [gid, charSet] of groupCharities) {
    charSet.forEach(cid => {
      if (!charityGroups.has(cid)) charityGroups.set(cid, new Set());
      charityGroups.get(cid).add(gid);
    });
  }

  let charUpdates = [];
  for (const [cid, grpSet] of charityGroups) {
    const char = charities.find(c => c.id === cid);
    if (char) {
      const existing = new Set(char.fields.Groups || []);
      const all = [...new Set([...existing, ...grpSet])];
      if (all.length > existing.size) {
        charUpdates.push({ id: cid, fields: { Groups: all } });
      }
    }
  }
  
  console.log(`Charities to update with groups: ${charUpdates.length}`);
  if (charUpdates.length > 0) {
    for (let i = 0; i < charUpdates.length; i += 10) {
      await base('Charities').update(charUpdates.slice(i, i + 10));
    }
  }

  console.log('\n✅ Charities linked!');
}

main().catch(console.error);
