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
  console.log('Final linking pass...');
  
  const [orders, advisors, groups, regions, charities, venues, directMailJobs, invoices, proofs] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Advisors'),
    getAllRecords('Groups'),
    getAllRecords('Regions'),
    getAllRecords('Charities'),
    getAllRecords('Venues'),
    getAllRecords('Direct_Mail_Jobs'),
    getAllRecords('Invoices'),
    getAllRecords('Proofs'),
  ]);

  console.log(`Orders=${orders.length}, Advisors=${advisors.length}, Groups=${groups.length}, Regions=${regions.length}, Charities=${charities.length}, Venues=${venues.length}, Mail=${directMailJobs.length}, Invoices=${invoices.length}, Proofs=${proofs.length}`);

  // Build lookups
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

  const venueByName = new Map();
  venues.forEach(v => {
    if (v.fields.Name) venueByName.set(v.fields.Name.toLowerCase().trim(), v.id);
  });

  // Link Invoices -> Orders, Advisors, Groups
  console.log('\nLinking Invoices...');
  let invUpdates = [];
  invoices.forEach(inv => {
    const updates = {};
    
    if (inv.fields.order_number && (!inv.fields.order || inv.fields.order.length === 0)) {
      const orderId = orderByNumber.get(inv.fields.order_number);
      if (orderId) updates.order = [orderId];
    }
    
    if (inv.fields.advisor_name && (!inv.fields.client || inv.fields.client.length === 0)) {
      const advisorId = advisorByName.get(inv.fields.advisor_name.toLowerCase().trim());
      if (advisorId) updates.client = [advisorId];
    }
    
    if (inv.fields.group_name && (!inv.fields.Group || inv.fields.Group.length === 0)) {
      const groupId = groupByName.get(inv.fields.group_name.toLowerCase().trim());
      if (groupId) updates.Group = [groupId];
    }
    
    if (Object.keys(updates).length > 0) {
      invUpdates.push({ id: inv.id, fields: updates });
    }
  });
  console.log(`  Invoices needing links: ${invUpdates.length}`);
  if (invUpdates.length > 0) await batchUpdate('Invoices', invUpdates);

  // Link Advisors to their Orders
  console.log('\nLinking Advisors to Orders...');
  const advisorOrders = new Map();
  orders.forEach(o => {
    if (o.fields.Advisor_Link && o.fields.Advisor_Link.length > 0) {
      const advId = o.fields.Advisor_Link[0];
      if (!advisorOrders.has(advId)) advisorOrders.set(advId, new Set());
      advisorOrders.get(advId).add(o.id);
    }
  });

  let advOrderUpdates = [];
  for (const [advId, orderSet] of advisorOrders) {
    const adv = advisors.find(a => a.id === advId);
    if (adv) {
      const existingOrders = new Set(adv.fields.Orders || []);
      const newOrders = [...orderSet].filter(oid => !existingOrders.has(oid));
      if (newOrders.length > 0) {
        advOrderUpdates.push({
          id: advId,
          fields: { Orders: [...existingOrders, ...newOrders] }
        });
      }
    }
  }
  console.log(`  Advisors needing order links: ${advOrderUpdates.length}`);
  if (advOrderUpdates.length > 0) await batchUpdate('Advisors', advOrderUpdates);

  // Link Advisors to Venues
  console.log('\nLinking Advisors to Venues...');
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

  // Link Groups to their entities
  console.log('\nLinking Groups to Advisors...');
  const groupAdvisors = new Map();
  advisors.forEach(a => {
    if (a.fields.group && a.fields.group.length > 0) {
      const grpId = a.fields.group[0];
      if (!groupAdvisors.has(grpId)) groupAdvisors.set(grpId, new Set());
      groupAdvisors.get(grpId).add(a.id);
    }
  });

  let grpClientUpdates = [];
  for (const [grpId, advSet] of groupAdvisors) {
    const grp = groups.find(g => g.id === grpId);
    if (grp) {
      const existingClients = new Set(grp.fields.Clients || []);
      const newClients = [...advSet].filter(a => !existingClients.has(a));
      if (newClients.length > 0) {
        grpClientUpdates.push({
          id: grpId,
          fields: { Clients: [...existingClients, ...newClients] }
        });
      }
    }
  }
  console.log(`  Groups needing client links: ${grpClientUpdates.length}`);
  if (grpClientUpdates.length > 0) await batchUpdate('Groups', grpClientUpdates);

  // Link Groups to Orders
  console.log('\nLinking Groups to Orders...');
  const groupOrders = new Map();
  orders.forEach(o => {
    if (o.fields.Group && o.fields.Group.length > 0) {
      const grpId = o.fields.Group[0];
      if (!groupOrders.has(grpId)) groupOrders.set(grpId, new Set());
      groupOrders.get(grpId).add(o.id);
    }
  });

  let grpOrderUpdates = [];
  for (const [grpId, orderSet] of groupOrders) {
    const grp = groups.find(g => g.id === grpId);
    if (grp) {
      const existingOrders = new Set(grp.fields.Orders || []);
      const newOrders = [...orderSet].filter(oid => !existingOrders.has(oid));
      if (newOrders.length > 0) {
        grpOrderUpdates.push({
          id: grpId,
          fields: { Orders: [...existingOrders, ...newOrders] }
        });
      }
    }
  }
  console.log(`  Groups needing order links: ${grpOrderUpdates.length}`);
  if (grpOrderUpdates.length > 0) await batchUpdate('Groups', grpOrderUpdates);

  // Link Venues to Groups  
  console.log('\nLinking Venues to Groups...');
  const venueGroups = new Map();
  orders.forEach(o => {
    if (o.fields.venue_name && o.fields.Group && o.fields.Group.length > 0) {
      const venueId = venueByName.get(o.fields.venue_name.toLowerCase().trim());
      const grpId = o.fields.Group[0];
      if (venueId) {
        if (!venueGroups.has(venueId)) venueGroups.set(venueId, new Set());
        venueGroups.get(venueId).add(grpId);
      }
    }
  });

  let venueGrpUpdates = [];
  for (const [venueId, grpSet] of venueGroups) {
    const venue = venues.find(v => v.id === venueId);
    if (venue) {
      const existingGroups = new Set(venue.fields.Groups || []);
      const newGroups = [...grpSet].filter(g => !existingGroups.has(g));
      if (newGroups.length > 0) {
        venueGrpUpdates.push({
          id: venueId,
          fields: { Groups: [...existingGroups, ...newGroups] }
        });
      }
    }
  }
  console.log(`  Venues needing group links: ${venueGrpUpdates.length}`);
  if (venueGrpUpdates.length > 0) await batchUpdate('Venues', venueGrpUpdates);

  console.log('\n✅ All linking complete!');
}

main().catch(console.error);
