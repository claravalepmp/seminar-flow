const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

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
  if (data.error) {
    console.error('API Error:', JSON.stringify(data.error));
    return null;
  }
  return data;
}

async function clearTable(tableName) {
  console.log(`Clearing ${tableName}...`);
  let records = await api(`/${BASE_ID}/${encodeURIComponent(tableName)}?maxRecords=100`);
  while (records?.records?.length > 0) {
    const ids = records.records.map(r => r.id);
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      await api(`/${BASE_ID}/${encodeURIComponent(tableName)}?${batch.map(id => `records[]=${id}`).join('&')}`, 'DELETE');
    }
    records = await api(`/${BASE_ID}/${encodeURIComponent(tableName)}?maxRecords=100`);
  }
  console.log(`  Cleared ${tableName}`);
}

async function createRecords(tableName, records, batchSize = 10) {
  console.log(`Creating ${records.length} records in ${tableName}...`);
  const created = [];
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const result = await api(`/${BASE_ID}/${encodeURIComponent(tableName)}`, 'POST', {
      records: batch.map(fields => ({ fields }))
    });
    if (result?.records) {
      created.push(...result.records);
    }
    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`  Created ${created.length} records`);
  return created;
}

async function main() {
  // Load normalized data
  const data = JSON.parse(fs.readFileSync('data/normalized.json', 'utf8'));
  
  // Get current schema
  const schema = await api(`/meta/bases/${BASE_ID}/tables`);
  const tables = {};
  schema.tables.forEach(t => tables[t.name] = t.id);
  console.log('Tables:', Object.keys(tables).join(', '));
  
  // 1. Clear existing data (except structure)
  await clearTable('Orders');
  await clearTable('Advisors');
  await clearTable('Charities');
  await clearTable('Regions');
  await clearTable('Groups');
  
  // 2. Import Groups
  const groupRecords = await createRecords('Groups', data.groups.map(g => ({
    'Name': g.name,
    'Website': g.website || undefined,
    'Registration Phone': g.registrationPhone || undefined,
    'Registration URL': g.registrationUrl || undefined,
    'Address': g.returnAddress || undefined,
    'Responsibility': g.responsibility || undefined,
  })));
  
  // Build group lookup
  const groupLookup = {};
  groupRecords.forEach(r => groupLookup[r.fields.Name] = r.id);
  
  // 3. Import Regions/Offices
  const regionRecords = await createRecords('Regions', data.offices.map(o => ({
    'Name': o.name,
    'Group': groupLookup[o.group] ? [groupLookup[o.group]] : undefined,
  })));
  
  // Build region lookup (by group::name)
  const regionLookup = {};
  regionRecords.forEach(r => {
    // Find the original office to get group
    const orig = data.offices.find(o => o.name === r.fields.Name);
    if (orig) {
      regionLookup[`${orig.group}::${r.fields.Name}`] = r.id;
    }
  });
  
  // 4. Import Charities
  const charityRecords = await createRecords('Charities', data.charities.map(c => ({
    'Name': c.name,
    'Short Name': c.name.split(' ')[0], // First word as short name
  })));
  
  // Build charity lookup
  const charityLookup = {};
  charityRecords.forEach(r => charityLookup[r.fields.Name] = r.id);
  
  // 5. Import Advisors (from groups' advisor lists)
  const allAdvisors = [];
  data.groups.forEach(g => {
    g.advisors.forEach(a => {
      allAdvisors.push({
        'contact_name': a.name || a.contactName,
        'company_name': a.businessName || g.name,
        'email': a.contactEmail || undefined,
        'phone': a.contactPhone || undefined,
        'territory': a.businessAddress || undefined,
        'status': 'active',
        'Group': groupLookup[g.name] ? [groupLookup[g.name]] : undefined,
      });
    });
  });
  
  const advisorRecords = await createRecords('Advisors', allAdvisors);
  
  // Build advisor lookup by name
  const advisorLookup = {};
  advisorRecords.forEach(r => {
    if (r.fields.contact_name) {
      advisorLookup[r.fields.contact_name] = r.id;
    }
  });
  
  // 6. Import Orders
  const orderRecords = await createRecords('Orders', data.orders.slice(0, 100).map(o => ({
    'Order Number': parseInt(o.orderNumber) || undefined,
    'Status': o.status || 'Pending',
    'Class Type': o.classType || undefined,
    'Venue Name': o.venueName || undefined,
    'Venue Address': o.venueAddress || undefined,
    'First Event Date': o.firstEventDate ? parseDate(o.firstEventDate) : undefined,
    'Second Event Date': o.secondEventDate ? parseDate(o.secondEventDate) : undefined,
    'Mailing Quantity': parseInt(o.mailingQuantity?.replace(/,/g, '')) || undefined,
    'Mail Piece': o.mailerType || undefined,
    'Client Notes': o.instructions || undefined,
    'Region': regionLookup[`${o.group}::${o.office}`] ? [regionLookup[`${o.group}::${o.office}`]] : undefined,
    'Charity': charityLookup[o.charity] ? [charityLookup[o.charity]] : undefined,
  })));
  
  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`Groups: ${groupRecords.length}`);
  console.log(`Regions: ${regionRecords.length}`);
  console.log(`Charities: ${charityRecords.length}`);
  console.log(`Advisors: ${advisorRecords.length}`);
  console.log(`Orders: ${orderRecords.length} (first 100)`);
}

function parseDate(dateStr) {
  if (!dateStr) return undefined;
  // Try to parse various date formats
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return undefined;
}

main().catch(console.error);
