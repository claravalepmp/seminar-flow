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
    const batch = updates.slice(i, i + 10);
    await base(table).update(batch);
    process.stdout.write(`  ${Math.min(i + 10, updates.length)}/${updates.length}\r`);
  }
  if (updates.length > 0) console.log('');
}

async function main() {
  console.log('Loading all tables...');
  
  const [orders, advisors, groups, regions, charities, venues] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Advisors'),
    getAllRecords('Groups'),
    getAllRecords('Regions'),
    getAllRecords('Charities'),
    getAllRecords('Venues'),
  ]);

  console.log(`Orders=${orders.length}, Advisors=${advisors.length}, Groups=${groups.length}, Regions=${regions.length}, Charities=${charities.length}, Venues=${venues.length}`);

  // ============ 1. MERGE FTA GROUPS ============
  console.log('\n=== MERGING FTA GROUPS ===');
  
  // Find the main FTA group
  const ftaMain = groups.find(g => g.fields.Name === 'FTA');
  if (!ftaMain) {
    console.log('ERROR: No main FTA group found');
    return;
  }
  console.log(`Main FTA group: ${ftaMain.id}`);

  // Find all FTA variant groups
  const ftaVariants = groups.filter(g => {
    const name = g.fields.Name || '';
    return name.startsWith('FTA') && g.id !== ftaMain.id;
  });
  console.log(`FTA variants to merge: ${ftaVariants.map(g => g.fields.Name).join(', ')}`);

  // Also merge SAM-RIA and SAM RIA
  const samMain = groups.find(g => g.fields.Name === 'SAM-RIA' || g.fields.Name === 'SAM RIA');
  const samVariants = groups.filter(g => {
    const name = g.fields.Name || '';
    return (name.includes('SAM') && name.includes('RIA')) && g.id !== samMain?.id;
  });
  if (samMain) {
    console.log(`SAM-RIA main: ${samMain.fields.Name}, variants: ${samVariants.map(g => g.fields.Name).join(', ')}`);
  }

  // Merge Arrive Financial Services variants
  const arriveMain = groups.find(g => g.fields.Name === 'Arrive Financial Services');
  const arriveVariants = groups.filter(g => {
    const name = g.fields.Name || '';
    return name.startsWith('Arrive Financial') && g.id !== arriveMain?.id;
  });
  if (arriveMain) {
    console.log(`Arrive main: ${arriveMain.fields.Name}, variants: ${arriveVariants.map(g => g.fields.Name).join(', ')}`);
  }

  // Build merge map: variant ID -> main ID
  const mergeMap = new Map();
  ftaVariants.forEach(v => mergeMap.set(v.id, ftaMain.id));
  if (samMain) samVariants.forEach(v => mergeMap.set(v.id, samMain.id));
  if (arriveMain) arriveVariants.forEach(v => mergeMap.set(v.id, arriveMain.id));

  // Update orders to point to main group
  console.log('\nUpdating orders to use main groups...');
  let orderGroupUpdates = [];
  orders.forEach(o => {
    if (o.fields.Group && o.fields.Group.length > 0) {
      const currentGroup = o.fields.Group[0];
      const mainGroup = mergeMap.get(currentGroup);
      if (mainGroup) {
        orderGroupUpdates.push({ id: o.id, fields: { Group: [mainGroup] } });
      }
    }
  });
  console.log(`  Orders to update: ${orderGroupUpdates.length}`);
  if (orderGroupUpdates.length > 0) await batchUpdate('Orders', orderGroupUpdates);

  // Update advisors to point to main group
  console.log('\nUpdating advisors to use main groups...');
  let advGroupUpdates = [];
  advisors.forEach(a => {
    if (a.fields.group && a.fields.group.length > 0) {
      const currentGroup = a.fields.group[0];
      const mainGroup = mergeMap.get(currentGroup);
      if (mainGroup) {
        advGroupUpdates.push({ id: a.id, fields: { group: [mainGroup] } });
      }
    }
  });
  console.log(`  Advisors to update: ${advGroupUpdates.length}`);
  if (advGroupUpdates.length > 0) await batchUpdate('Advisors', advGroupUpdates);

  // ============ 2. CONNECT REGIONS ============
  console.log('\n=== CONNECTING REGIONS ===');
  
  // Build region lookup by state
  const regionByState = new Map();
  regions.forEach(r => {
    const state = r.fields.State;
    if (state) regionByState.set(state.toUpperCase().trim(), r.id);
  });
  console.log(`Regions by state: ${[...regionByState.keys()].join(', ')}`);

  // Extract state from venue address and link to region
  let venueRegionUpdates = [];
  venues.forEach(v => {
    if (v.fields.Region && v.fields.Region.length > 0) return; // Already linked
    
    const state = v.fields.State;
    if (state) {
      const regionId = regionByState.get(state.toUpperCase().trim());
      if (regionId) {
        venueRegionUpdates.push({ id: v.id, fields: { Region: [regionId] } });
      }
    }
  });
  console.log(`Venues to link to regions: ${venueRegionUpdates.length}`);
  if (venueRegionUpdates.length > 0) await batchUpdate('Venues', venueRegionUpdates);

  // Link orders to regions based on venue address state
  console.log('\nLinking orders to regions...');
  let orderRegionUpdates = [];
  orders.forEach(o => {
    if (o.fields.Region && o.fields.Region.length > 0) return; // Already linked
    
    const addr = o.fields.venue_address || '';
    // Try to extract state from address (usually "City, ST ZIP" format)
    const stateMatch = addr.match(/,\s*([A-Z]{2})\s*\d{5}/i) || addr.match(/,\s*([A-Z]{2})\s*$/i);
    if (stateMatch) {
      const state = stateMatch[1].toUpperCase();
      const regionId = regionByState.get(state);
      if (regionId) {
        orderRegionUpdates.push({ id: o.id, fields: { Region: [regionId] } });
      }
    }
  });
  console.log(`Orders to link to regions: ${orderRegionUpdates.length}`);
  if (orderRegionUpdates.length > 0) await batchUpdate('Orders', orderRegionUpdates);

  // ============ 3. CONNECT CHARITIES ============
  console.log('\n=== CONNECTING CHARITIES ===');
  
  // Build charity lookup
  const charityByName = new Map();
  charities.forEach(c => {
    const name = c.fields.Name;
    const shortName = c.fields['Short Name'];
    if (name) charityByName.set(name.toLowerCase().trim(), c.id);
    if (shortName) charityByName.set(shortName.toLowerCase().trim(), c.id);
  });
  console.log(`Charities: ${[...new Set(charities.map(c => c.fields.Name))].join(', ')}`);

  // Check if orders have charity text field we can match
  const ordersWithCharityText = orders.filter(o => {
    return o.fields.charity_name || o.fields.charity_text || o.fields.Charity_Name;
  });
  console.log(`Orders with charity text field: ${ordersWithCharityText.length}`);

  // Link charities to groups
  console.log('\nLinking charities to groups...');
  const groupCharities = new Map();
  orders.forEach(o => {
    if (o.fields.Group && o.fields.Group.length > 0 && o.fields.Charity && o.fields.Charity.length > 0) {
      const grpId = o.fields.Group[0];
      if (!groupCharities.has(grpId)) groupCharities.set(grpId, new Set());
      o.fields.Charity.forEach(cid => groupCharities.get(grpId).add(cid));
    }
  });

  let grpCharityUpdates = [];
  for (const [grpId, charitySet] of groupCharities) {
    const grp = groups.find(g => g.id === grpId);
    if (grp) {
      const existing = new Set(grp.fields.Charities || []);
      const newOnes = [...charitySet].filter(c => !existing.has(c));
      if (newOnes.length > 0) {
        grpCharityUpdates.push({
          id: grpId,
          fields: { Charities: [...existing, ...newOnes] }
        });
      }
    }
  }
  console.log(`Groups to link to charities: ${grpCharityUpdates.length}`);
  if (grpCharityUpdates.length > 0) await batchUpdate('Groups', grpCharityUpdates);

  // ============ 4. POPULATE GROUPS ============
  console.log('\n=== POPULATING GROUPS ===');
  
  // Reload groups after merges
  const freshGroups = await getAllRecords('Groups');
  const freshOrders = await getAllRecords('Orders');
  const freshAdvisors = await getAllRecords('Advisors');
  const freshVenues = await getAllRecords('Venues');

  // Build group data from orders
  const groupData = new Map();
  freshGroups.forEach(g => {
    groupData.set(g.id, {
      record: g,
      orders: new Set(),
      advisors: new Set(),
      venues: new Set(),
      regions: new Set(),
      charities: new Set(),
    });
  });

  freshOrders.forEach(o => {
    if (o.fields.Group && o.fields.Group.length > 0) {
      const grpId = o.fields.Group[0];
      const data = groupData.get(grpId);
      if (data) {
        data.orders.add(o.id);
        if (o.fields.Region && o.fields.Region.length > 0) {
          o.fields.Region.forEach(rid => data.regions.add(rid));
        }
        if (o.fields.Charity && o.fields.Charity.length > 0) {
          o.fields.Charity.forEach(cid => data.charities.add(cid));
        }
      }
    }
  });

  freshAdvisors.forEach(a => {
    if (a.fields.group && a.fields.group.length > 0) {
      const grpId = a.fields.group[0];
      const data = groupData.get(grpId);
      if (data) {
        data.advisors.add(a.id);
        if (a.fields.Venues) {
          a.fields.Venues.forEach(vid => data.venues.add(vid));
        }
      }
    }
  });

  freshVenues.forEach(v => {
    if (v.fields.Groups && v.fields.Groups.length > 0) {
      v.fields.Groups.forEach(grpId => {
        const data = groupData.get(grpId);
        if (data) data.venues.add(v.id);
      });
    }
  });

  // Update groups with all linked data
  let groupUpdates = [];
  for (const [grpId, data] of groupData) {
    const g = data.record;
    const updates = {};
    
    // Orders
    const existingOrders = new Set(g.fields.Orders || []);
    const newOrders = [...data.orders].filter(o => !existingOrders.has(o));
    if (newOrders.length > 0) updates.Orders = [...existingOrders, ...newOrders];
    
    // Clients (Advisors)
    const existingClients = new Set(g.fields.Clients || []);
    const newClients = [...data.advisors].filter(a => !existingClients.has(a));
    if (newClients.length > 0) updates.Clients = [...existingClients, ...newClients];
    
    // Venues
    const existingVenues = new Set(g.fields.Venues || []);
    const newVenues = [...data.venues].filter(v => !existingVenues.has(v));
    if (newVenues.length > 0) updates.Venues = [...existingVenues, ...newVenues];
    
    // Regions
    const existingRegions = new Set(g.fields.Regions || []);
    const newRegions = [...data.regions].filter(r => !existingRegions.has(r));
    if (newRegions.length > 0) updates.Regions = [...existingRegions, ...newRegions];
    
    // Charities
    const existingCharities = new Set(g.fields.Charities || []);
    const newCharities = [...data.charities].filter(c => !existingCharities.has(c));
    if (newCharities.length > 0) updates.Charities = [...existingCharities, ...newCharities];
    
    if (Object.keys(updates).length > 0) {
      groupUpdates.push({ id: grpId, fields: updates });
    }
  }
  console.log(`Groups to update: ${groupUpdates.length}`);
  if (groupUpdates.length > 0) await batchUpdate('Groups', groupUpdates);

  // ============ 5. LINK REGIONS TO GROUPS ============
  console.log('\n=== LINKING REGIONS TO GROUPS ===');
  
  const regionGroups = new Map();
  freshOrders.forEach(o => {
    if (o.fields.Region && o.fields.Region.length > 0 && o.fields.Group && o.fields.Group.length > 0) {
      const regId = o.fields.Region[0];
      const grpId = o.fields.Group[0];
      if (!regionGroups.has(regId)) regionGroups.set(regId, new Set());
      regionGroups.get(regId).add(grpId);
    }
  });

  let regionUpdates = [];
  for (const [regId, grpSet] of regionGroups) {
    const reg = regions.find(r => r.id === regId);
    if (reg) {
      const existing = new Set(reg.fields.Group || []);
      const newOnes = [...grpSet].filter(g => !existing.has(g));
      if (newOnes.length > 0) {
        regionUpdates.push({
          id: regId,
          fields: { Group: [...existing, ...newOnes] }
        });
      }
    }
  }
  console.log(`Regions to link to groups: ${regionUpdates.length}`);
  if (regionUpdates.length > 0) await batchUpdate('Regions', regionUpdates);

  console.log('\n✅ ALL DATA FIXED!');
}

main().catch(console.error);
