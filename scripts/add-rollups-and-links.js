#!/usr/bin/env node
/**
 * Add Rollup fields and fix missing links
 */

const AIRTABLE_PAT = 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getSchema() {
  const schema = await api(`/meta/bases/${BASE_ID}/tables`);
  const tables = {};
  schema.tables?.forEach(t => {
    tables[t.name] = { 
      id: t.id, 
      fields: {},
      fieldIds: {}
    };
    t.fields?.forEach(f => {
      tables[t.name].fields[f.name] = f;
      tables[t.name].fieldIds[f.name] = f.id;
    });
  });
  return tables;
}

async function addField(tableId, field) {
  console.log(`  Adding: ${field.name}...`);
  try {
    const result = await api(`/meta/bases/${BASE_ID}/tables/${tableId}/fields`, 'POST', field);
    console.log(`    ✓ Created`);
    return result;
  } catch (e) {
    if (e.message.includes('DUPLICATE_FIELD_NAME')) {
      console.log(`    ○ Already exists`);
      return null;
    }
    throw e;
  }
}

async function main() {
  console.log('🔗 Adding Rollups and Fixing Links\n');
  
  const tables = await getSchema();
  
  // ========================================
  // 1. Add link from Clients to Groups (if missing)
  // ========================================
  console.log('1️⃣  Clients → Groups link');
  if (!tables['Clients'].fields['Group']) {
    await addField(tables['Clients'].id, {
      name: 'Group',
      type: 'multipleRecordLinks',
      options: { linkedTableId: tables['Groups'].id }
    });
  } else {
    console.log('  ○ Already exists');
  }
  await sleep(300);
  
  // ========================================
  // 2. Add link from Clients to Regions
  // ========================================
  console.log('\n2️⃣  Clients → Regions link');
  if (!tables['Clients'].fields['Region']) {
    await addField(tables['Clients'].id, {
      name: 'Region',
      type: 'multipleRecordLinks',
      options: { linkedTableId: tables['Regions'].id }
    });
  } else {
    console.log('  ○ Already exists');
  }
  await sleep(300);
  
  // ========================================
  // 3. Add rollup: Orders.Event Count
  // ========================================
  console.log('\n3️⃣  Orders.Event Count rollup');
  const eventsLinkField = tables['Orders'].fields['Events_v2'];
  if (eventsLinkField && !tables['Orders'].fields['Event Count']) {
    await addField(tables['Orders'].id, {
      name: 'Event Count',
      type: 'rollup',
      options: {
        fieldIdInLinkedTable: tables['Events_v2'].fieldIds['Event Name'],
        recordLinkFieldId: eventsLinkField.id,
        result: { type: 'number', options: { precision: 0 } },
        formula: 'COUNTA(values)'
      }
    });
  } else {
    console.log('  ○ Already exists or missing Events_v2 link');
  }
  await sleep(300);
  
  // ========================================
  // 4. Add rollup: Orders.First Event Date
  // ========================================
  console.log('\n4️⃣  Orders.First Event Date rollup');
  if (eventsLinkField && !tables['Orders'].fields['First Event']) {
    await addField(tables['Orders'].id, {
      name: 'First Event',
      type: 'rollup',
      options: {
        fieldIdInLinkedTable: tables['Events_v2'].fieldIds['Date'],
        recordLinkFieldId: eventsLinkField.id,
        result: { type: 'date', options: { dateFormat: { name: 'local' } } },
        formula: 'MIN(values)'
      }
    });
  } else {
    console.log('  ○ Already exists or missing Events_v2 link');
  }
  await sleep(300);
  
  // ========================================
  // 5. Add link from Orders to Clients
  // ========================================
  console.log('\n5️⃣  Orders → Clients link (Advisor contact)');
  if (!tables['Orders'].fields['Advisor Contact']) {
    await addField(tables['Orders'].id, {
      name: 'Advisor Contact',
      type: 'multipleRecordLinks',
      options: { linkedTableId: tables['Clients'].id }
    });
  } else {
    console.log('  ○ Already exists');
  }
  await sleep(300);
  
  // ========================================
  // 6. Add rollup: Clients.Total Orders
  // ========================================
  console.log('\n6️⃣  Clients.Total Orders rollup');
  // Refresh schema to get new field IDs
  const freshTables = await getSchema();
  const clientOrdersLink = freshTables['Clients'].fields['Orders'];
  if (clientOrdersLink && !freshTables['Clients'].fields['Total Orders']) {
    await addField(freshTables['Clients'].id, {
      name: 'Total Orders',
      type: 'rollup',
      options: {
        fieldIdInLinkedTable: freshTables['Orders'].fieldIds['order_number'],
        recordLinkFieldId: clientOrdersLink.id,
        result: { type: 'number', options: { precision: 0 } },
        formula: 'COUNTA(values)'
      }
    });
  } else {
    console.log('  ○ Already exists or missing Orders link');
  }
  await sleep(300);
  
  // ========================================
  // 7. Add rollup: Clients.Total Mailings
  // ========================================
  console.log('\n7️⃣  Clients.Total Mailings rollup');
  if (clientOrdersLink && !freshTables['Clients'].fields['Total Mailings']) {
    await addField(freshTables['Clients'].id, {
      name: 'Total Mailings',
      type: 'rollup',
      options: {
        fieldIdInLinkedTable: freshTables['Orders'].fieldIds['mailing_quantity'],
        recordLinkFieldId: clientOrdersLink.id,
        result: { type: 'number', options: { precision: 0 } },
        formula: 'SUM(values)'
      }
    });
  } else {
    console.log('  ○ Already exists or missing Orders link');
  }
  await sleep(300);
  
  // ========================================
  // 8. Add rollup: Regions.Venue Count
  // ========================================
  console.log('\n8️⃣  Regions.Venue Count rollup');
  const regionVenuesLink = freshTables['Regions'].fields['Venues'];
  if (regionVenuesLink && !freshTables['Regions'].fields['Venue Count']) {
    await addField(freshTables['Regions'].id, {
      name: 'Venue Count',
      type: 'rollup',
      options: {
        fieldIdInLinkedTable: freshTables['Venues'].fieldIds['Name'],
        recordLinkFieldId: regionVenuesLink.id,
        result: { type: 'number', options: { precision: 0 } },
        formula: 'COUNTA(values)'
      }
    });
  } else {
    console.log('  ○ Already exists or missing Venues link');
  }
  
  console.log('\n✅ Done adding rollups and links');
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('CURRENT SCHEMA SUMMARY');
  console.log('='.repeat(50));
  
  const finalTables = await getSchema();
  for (const [name, table] of Object.entries(finalTables)) {
    const links = Object.values(table.fields).filter(f => f.type === 'multipleRecordLinks');
    const rollups = Object.values(table.fields).filter(f => f.type === 'rollup');
    console.log(`\n${name}: ${Object.keys(table.fields).length} fields`);
    if (links.length) console.log(`  Links: ${links.map(l => l.name).join(', ')}`);
    if (rollups.length) console.log(`  Rollups: ${rollups.map(r => r.name).join(', ')}`);
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
