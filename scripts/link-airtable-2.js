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
  console.log('');
}

async function main() {
  console.log('Loading tables...');
  
  const [orders, advisors, groups, regions, charities, venues, digitalJobs, directMailJobs] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Advisors'),
    getAllRecords('Groups'),
    getAllRecords('Regions'),
    getAllRecords('Charities'),
    getAllRecords('Venues'),
    getAllRecords('Digital_Jobs'),
    getAllRecords('Direct_Mail_Jobs'),
  ]);

  console.log(`Loaded: Orders=${orders.length}, Advisors=${advisors.length}, Groups=${groups.length}, Regions=${regions.length}, Charities=${charities.length}, Venues=${venues.length}, Digital=${digitalJobs.length}, Mail=${directMailJobs.length}`);

  // Build lookups
  const regionByName = new Map();
  regions.forEach(r => {
    if (r.fields.Name) regionByName.set(r.fields.Name.toLowerCase().trim(), r.id);
  });

  const charityByName = new Map();
  charities.forEach(c => {
    if (c.fields.Name) charityByName.set(c.fields.Name.toLowerCase().trim(), c.id);
    if (c.fields['Short Name']) charityByName.set(c.fields['Short Name'].toLowerCase().trim(), c.id);
  });

  const venueByName = new Map();
  venues.forEach(v => {
    if (v.fields.Name) venueByName.set(v.fields.Name.toLowerCase().trim(), v.id);
    if (v.fields['Full Name']) venueByName.set(v.fields['Full Name'].toLowerCase().trim(), v.id);
  });

  const orderByNumber = new Map();
  orders.forEach(o => {
    if (o.fields.order_number) orderByNumber.set(o.fields.order_number, o.id);
  });

  const advisorByName = new Map();
  advisors.forEach(a => {
    if (a.fields.advisor_name) advisorByName.set(a.fields.advisor_name.toLowerCase().trim(), a.id);
  });

  const groupByName = new Map();
  groups.forEach(g => {
    if (g.fields.Name) groupByName.set(g.fields.Name.toLowerCase().trim(), g.id);
  });

  // Link Digital_Jobs -> Orders, Advisors, Groups
  console.log('\nLinking Digital_Jobs...');
  let djUpdates = [];
  digitalJobs.forEach(dj => {
    const updates = {};
    
    // Link to order by order_number
    if (dj.fields.order_number && (!dj.fields.order || dj.fields.order.length === 0)) {
      const orderId = orderByNumber.get(dj.fields.order_number);
      if (orderId) updates.order = [orderId];
    }
    
    // Link to client (advisor) by name
    if (dj.fields.advisor_name && (!dj.fields.client || dj.fields.client.length === 0)) {
      const advisorId = advisorByName.get(dj.fields.advisor_name.toLowerCase().trim());
      if (advisorId) updates.client = [advisorId];
    }
    
    // Link to group by name
    if (dj.fields.group_name && (!dj.fields.Group || dj.fields.Group.length === 0)) {
      const groupId = groupByName.get(dj.fields.group_name.toLowerCase().trim());
      if (groupId) updates.Group = [groupId];
    }
    
    if (Object.keys(updates).length > 0) {
      djUpdates.push({ id: dj.id, fields: updates });
    }
  });
  console.log(`  Digital_Jobs needing links: ${djUpdates.length}`);
  if (djUpdates.length > 0) await batchUpdate('Digital_Jobs', djUpdates);

  // Link Direct_Mail_Jobs -> Orders, Advisors, Groups
  console.log('\nLinking Direct_Mail_Jobs...');
  let dmUpdates = [];
  directMailJobs.forEach(dm => {
    const updates = {};
    
    if (dm.fields.order_number && (!dm.fields.order || dm.fields.order.length === 0)) {
      const orderId = orderByNumber.get(dm.fields.order_number);
      if (orderId) updates.order = [orderId];
    }
    
    const advName = dm.fields['Advisor Name'] || dm.fields.advisor_name;
    if (advName && (!dm.fields.Client || dm.fields.Client.length === 0)) {
      const advisorId = advisorByName.get(advName.toLowerCase().trim());
      if (advisorId) updates.Client = [advisorId];
    }
    
    const grpName = dm.fields['Group Name'] || dm.fields.group_name;
    if (grpName && (!dm.fields.Group || dm.fields.Group.length === 0)) {
      const groupId = groupByName.get(grpName.toLowerCase().trim());
      if (groupId) updates.Group = [groupId];
    }
    
    if (Object.keys(updates).length > 0) {
      dmUpdates.push({ id: dm.id, fields: updates });
    }
  });
  console.log(`  Direct_Mail_Jobs needing links: ${dmUpdates.length}`);
  if (dmUpdates.length > 0) await batchUpdate('Direct_Mail_Jobs', dmUpdates);

  // Link Venues to Groups
  console.log('\nLinking Venues to Groups...');
  let venueUpdates = [];
  venues.forEach(v => {
    // Try to match venue to group based on naming patterns
    // This is heuristic - may need manual cleanup
  });

  // Link Advisors to Venues (based on order history)
  console.log('\nLinking Advisors to Venues based on order history...');
  const advisorVenues = new Map();
  orders.forEach(o => {
    if (o.fields.Advisor_Link && o.fields.Advisor_Link.length > 0 && o.fields.venue_name) {
      const advId = o.fields.Advisor_Link[0];
      const venueId = venueByName.get(o.fields.venue_name.toLowerCase().trim());
      if (venueId) {
        if (!advisorVenues.has(advId)) advisorVenues.set(advId, new Set());
        advisorVenues.get(advId).add(venueId);
      }
    }
  });

  let advVenueUpdates = [];
  for (const [advId, venueSet] of advisorVenues) {
    const adv = advisors.find(a => a.id === advId);
    if (adv) {
      const existingVenues = new Set(adv.fields.Venues || []);
      const newVenues = [...venueSet].filter(v => !existingVenues.has(v));
      if (newVenues.length > 0) {
        advVenueUpdates.push({
          id: advId,
          fields: { Venues: [...existingVenues, ...newVenues] }
        });
      }
    }
  }
  console.log(`  Advisors needing venue links: ${advVenueUpdates.length}`);
  if (advVenueUpdates.length > 0) await batchUpdate('Advisors', advVenueUpdates);

  // Link Advisors to Charities (based on order history)
  console.log('\nLinking Advisors to Charities based on order history...');
  const advisorCharities = new Map();
  orders.forEach(o => {
    if (o.fields.Advisor_Link && o.fields.Advisor_Link.length > 0 && o.fields.Charity && o.fields.Charity.length > 0) {
      const advId = o.fields.Advisor_Link[0];
      const charityId = o.fields.Charity[0];
      if (!advisorCharities.has(advId)) advisorCharities.set(advId, new Set());
      advisorCharities.get(advId).add(charityId);
    }
  });

  let advCharityUpdates = [];
  for (const [advId, charitySet] of advisorCharities) {
    const adv = advisors.find(a => a.id === advId);
    if (adv) {
      const existingCharities = new Set(adv.fields.Charities || []);
      const newCharities = [...charitySet].filter(c => !existingCharities.has(c));
      if (newCharities.length > 0) {
        advCharityUpdates.push({
          id: advId,
          fields: { Charities: [...existingCharities, ...newCharities] }
        });
      }
    }
  }
  console.log(`  Advisors needing charity links: ${advCharityUpdates.length}`);
  if (advCharityUpdates.length > 0) await batchUpdate('Advisors', advCharityUpdates);

  console.log('\n✅ Phase 2 linking complete!');
}

main().catch(console.error);
