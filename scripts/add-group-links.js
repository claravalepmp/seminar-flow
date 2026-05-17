#!/usr/bin/env node
/**
 * Add Group links throughout Airtable
 * 
 * Groups are the central hub:
 * - Groups → Advisors (people/offices)
 * - Groups → Regions (geographic areas)
 * - Groups → Venues (group-specific, not shared)
 * - Groups → Orders (via lookup or direct)
 * - Groups → Events (via Order)
 * - Groups → Invoices
 * - Groups → Digital_Jobs
 */

const AIRTABLE_PAT = 'patXfYHRo6qBwvdfN.e6adc9494afba663c10b9869a02a1ecccd45ac35d7a2ff16e70f6b3c9e0491fa';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(endpoint, method = 'GET', body = null) {
  const opts = { 
    method, 
    headers: { 
      'Authorization': `Bearer ${AIRTABLE_PAT}`, 
      'Content-Type': 'application/json' 
    } 
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  return res.json();
}

async function getAllRecords(tableId) {
  let records = [], offset = null;
  do {
    const data = await api(`/${BASE_ID}/${tableId}${offset ? '?offset=' + offset : ''}`);
    if (data.error) {
      console.error(`Error fetching ${tableId}:`, data.error);
      return records;
    }
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function updateRecords(tableId, updates) {
  const results = [];
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    const data = await api(`/${BASE_ID}/${tableId}`, 'PATCH', { records: chunk });
    if (data.error) {
      console.error(`Error updating ${tableId}:`, data.error);
    } else {
      results.push(...(data.records || []));
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return results;
}

async function main() {
  console.log('=== Adding Group Links Throughout Airtable ===\n');

  // 1. Get all Groups
  console.log('1. Loading Groups...');
  const groups = await getAllRecords('Groups');
  const groupMap = {};
  groups.forEach(g => {
    groupMap[g.id] = g.fields.Name;
    groupMap[g.fields.Name?.toLowerCase()] = g.id;
  });
  console.log(`   Found ${groups.length} groups: ${groups.map(g => g.fields.Name).join(', ')}\n`);

  // 2. Get Advisors/Clients → Group mapping
  console.log('2. Building Advisor → Group mapping...');
  const clients = await getAllRecords('Clients');
  const advisorToGroup = {};
  clients.forEach(c => {
    if (c.fields.Group && c.fields.Group.length > 0) {
      advisorToGroup[c.id] = c.fields.Group[0];
    }
  });
  console.log(`   Mapped ${Object.keys(advisorToGroup).length}/${clients.length} advisors to groups\n`);

  // 3. Get Regions → Group mapping
  console.log('3. Building Region → Group mapping...');
  const regions = await getAllRecords('Regions');
  const regionToGroup = {};
  regions.forEach(r => {
    if (r.fields.Group && r.fields.Group.length > 0) {
      regionToGroup[r.id] = r.fields.Group[0];
    }
  });
  console.log(`   Mapped ${Object.keys(regionToGroup).length}/${regions.length} regions to groups\n`);

  // 4. Link Venues → Groups (via Region)
  console.log('4. Linking Venues → Groups...');
  const venues = await getAllRecords('Venues');
  const venueUpdates = [];
  for (const venue of venues) {
    if (venue.fields.Group && venue.fields.Group.length > 0) continue;
    
    if (venue.fields.Region && venue.fields.Region.length > 0) {
      const groupId = regionToGroup[venue.fields.Region[0]];
      if (groupId) {
        venueUpdates.push({ id: venue.id, fields: { Group: [groupId] } });
      }
    }
  }
  if (venueUpdates.length > 0) {
    await updateRecords('Venues', venueUpdates);
    console.log(`   ✅ Updated ${venueUpdates.length} venues\n`);
  } else {
    console.log(`   ℹ️  No venues need updating (already linked or no Region)\n`);
  }

  // 5. Link Orders → Groups (via Advisor)
  console.log('5. Linking Orders → Groups...');
  const orders = await getAllRecords('Orders');
  const orderUpdates = [];
  for (const order of orders) {
    if (order.fields.Group && order.fields.Group.length > 0) continue;
    
    const advisorField = order.fields.client || order.fields.Client || order.fields.Advisor;
    if (advisorField && advisorField.length > 0) {
      const groupId = advisorToGroup[advisorField[0]];
      if (groupId) {
        orderUpdates.push({ id: order.id, fields: { Group: [groupId] } });
      }
    }
  }
  if (orderUpdates.length > 0) {
    await updateRecords('Orders', orderUpdates);
    console.log(`   ✅ Updated ${orderUpdates.length} orders\n`);
  } else {
    console.log(`   ℹ️  No orders need updating\n`);
  }

  // 6. Link Invoices → Groups
  console.log('6. Linking Invoices → Groups...');
  const invoices = await getAllRecords('Invoices');
  const invoiceUpdates = [];
  for (const invoice of invoices) {
    if (invoice.fields.Group && invoice.fields.Group.length > 0) continue;
    
    const advisorField = invoice.fields.client || invoice.fields.Client || invoice.fields.Advisor;
    if (advisorField && advisorField.length > 0) {
      const groupId = advisorToGroup[advisorField[0]];
      if (groupId) {
        invoiceUpdates.push({ id: invoice.id, fields: { Group: [groupId] } });
      }
    }
  }
  if (invoiceUpdates.length > 0) {
    await updateRecords('Invoices', invoiceUpdates);
    console.log(`   ✅ Updated ${invoiceUpdates.length} invoices\n`);
  } else {
    console.log(`   ℹ️  No invoices need updating\n`);
  }

  // 7. Link Digital_Jobs → Groups
  console.log('7. Linking Digital_Jobs → Groups...');
  const digitalJobs = await getAllRecords('Digital_Jobs');
  const digitalUpdates = [];
  for (const job of digitalJobs) {
    if (job.fields.Group && job.fields.Group.length > 0) continue;
    
    const advisorField = job.fields.client || job.fields.Client || job.fields.Advisor;
    if (advisorField && advisorField.length > 0) {
      const groupId = advisorToGroup[advisorField[0]];
      if (groupId) {
        digitalUpdates.push({ id: job.id, fields: { Group: [groupId] } });
      }
    }
  }
  if (digitalUpdates.length > 0) {
    await updateRecords('Digital_Jobs', digitalUpdates);
    console.log(`   ✅ Updated ${digitalUpdates.length} digital jobs\n`);
  } else {
    console.log(`   ℹ️  No digital jobs need updating\n`);
  }

  // 8. Link Direct_Mail_Jobs → Groups (via Order → Advisor)
  console.log('8. Linking Direct_Mail_Jobs → Groups...');
  const dmJobs = await getAllRecords('Direct_Mail_Jobs');
  
  // Build Order → Group mapping
  const orderToGroup = {};
  orders.forEach(o => {
    const advisorField = o.fields.client || o.fields.Client || o.fields.Advisor;
    if (advisorField && advisorField.length > 0) {
      const groupId = advisorToGroup[advisorField[0]];
      if (groupId) orderToGroup[o.id] = groupId;
    }
  });
  
  const dmUpdates = [];
  for (const job of dmJobs) {
    if (job.fields.Group && job.fields.Group.length > 0) continue;
    
    if (job.fields.Order && job.fields.Order.length > 0) {
      const groupId = orderToGroup[job.fields.Order[0]];
      if (groupId) {
        dmUpdates.push({ id: job.id, fields: { Group: [groupId] } });
      }
    }
  }
  if (dmUpdates.length > 0) {
    await updateRecords('Direct_Mail_Jobs', dmUpdates);
    console.log(`   ✅ Updated ${dmUpdates.length} direct mail jobs\n`);
  } else {
    console.log(`   ℹ️  No DM jobs need updating\n`);
  }

  // Summary
  console.log('=== Summary ===');
  console.log(`Groups: ${groups.length}`);
  console.log(`Venues → Group: ${venueUpdates.length} updated`);
  console.log(`Orders → Group: ${orderUpdates.length} updated`);
  console.log(`Invoices → Group: ${invoiceUpdates.length} updated`);
  console.log(`Digital_Jobs → Group: ${digitalUpdates.length} updated`);
  console.log(`Direct_Mail_Jobs → Group: ${dmUpdates.length} updated`);
  console.log('\n✅ Done!');
  console.log('\nNote: Events get Group via Lookup field from Order. Add in Airtable UI if needed.');
}

main().catch(console.error);
