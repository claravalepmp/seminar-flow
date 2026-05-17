#!/usr/bin/env node
/**
 * Import all data from Google Sheets and connect everything
 */

const fs = require('fs');

const AIRTABLE_PAT = 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  return res.json();
}

async function getAllRecords(tableId) {
  let records = [], offset = null;
  do {
    const data = await api(`/${BASE_ID}/${tableId}${offset ? '?offset=' + offset : ''}`);
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function createRecords(tableId, records) {
  const results = [];
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const result = await api(`/${BASE_ID}/${tableId}`, 'POST', { records: chunk });
    if (result.error) {
      console.log('    Error:', result.error.message);
    } else {
      results.push(...(result.records || []));
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return results;
}

async function updateRecords(tableId, updates) {
  const results = [];
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    const result = await api(`/${BASE_ID}/${tableId}`, 'PATCH', { records: chunk });
    results.push(...(result.records || []));
    await new Promise(r => setTimeout(r, 200));
  }
  return results;
}

// ==========================================
// 1. IMPORT DIRECT MAIL JOBS
// ==========================================
async function importDirectMailJobs(orders) {
  console.log('\n📬 Importing Direct Mail Jobs...');
  
  // Load extracted data
  const rawData = JSON.parse(fs.readFileSync('data/direct-mail-raw.json', 'utf8'));
  console.log(`  Source: ${rawData.length} rows from Google Sheet`);
  
  // Get existing DM jobs to avoid duplicates
  const existing = await getAllRecords('tblaCaCZNeP59w3x4');
  const existingOrderNums = new Set(existing.map(r => r.fields.order_number));
  console.log(`  Existing: ${existing.length} jobs`);
  
  // Build order lookup
  const orderLookup = {};
  orders.forEach(o => {
    if (o.fields.order_number) orderLookup[o.fields.order_number] = o.id;
  });
  
  // Map sheet data to Airtable fields
  const newJobs = [];
  for (const row of rawData) {
    const orderNum = parseInt(row['Order Number']);
    if (!orderNum || existingOrderNums.has(orderNum)) continue;
    
    const job = {
      fields: {
        'order_number': orderNum,
        'job_name': `DM-${orderNum}`,
        'Advisor Name': row['Advisor Name'] || '',
        'Group Name': row['Group Name'] || '',
        'Market': row['Market'] || '',
        'Office Location': row['Office Location'] || '',
        'Charity': row['Charity'] || '',
        'Class Type': row['Class Type'] || undefined,
        'Mailer Type': row['Mailer Type'] || '',
        'Mailer Return Address': row['Mailer Return Address'] || '',
        'Landing Page URL': row['Landing Page URL (Direct)'] || '',
        'Venue Name': row['Venue Name & Room (if not different)'] || '',
        'Venue Address': row['Venue Address'] || '',
        'Start Time': row['Start Time'] || '',
        'End Time': row['End Time'] || '',
        'Notes': row['Notes (Start & End Time If different times)'] || '',
        'First Event Room': row['First Event Room'] || '',
        'Second Event Room': row['Second Event Room'] || '',
        'Third Event Room': row['Third Event Room'] || '',
        'Fourth Event Room': row['Fourth Event Room'] || '',
        'quantity': parseInt(row['Mailing Quantity']) || undefined,
        'Digital Budget': parseFloat(row['Digital Budget to Invoice']) || undefined,
      }
    };
    
    // Parse dates
    const parseDate = (str) => {
      if (!str) return undefined;
      const d = new Date(str);
      return isNaN(d.getTime()) ? undefined : d.toISOString().split('T')[0];
    };
    
    job.fields['First Event Date'] = parseDate(row['First Event Date'] || row['First Event date']);
    job.fields['Second Event Date'] = parseDate(row['Second Event Date']);
    job.fields['Third Event Date'] = parseDate(row['Third Event date']);
    job.fields['Fourth Event Date'] = parseDate(row['Fourth Event date']);
    job.fields['Added to Sheets'] = parseDate(row['Added to Sheets']);
    
    // Link to order
    if (orderLookup[orderNum]) {
      job.fields['order'] = [orderLookup[orderNum]];
    }
    
    // Clean undefined values
    Object.keys(job.fields).forEach(k => {
      if (job.fields[k] === undefined || job.fields[k] === '') delete job.fields[k];
    });
    
    // Validate Class Type
    const validClassTypes = ['R90', 'R101', 'SS101', 'W101', 'WAT'];
    if (job.fields['Class Type'] && !validClassTypes.includes(job.fields['Class Type'])) {
      delete job.fields['Class Type'];
    }
    
    newJobs.push(job);
  }
  
  console.log(`  New jobs to create: ${newJobs.length}`);
  
  if (newJobs.length > 0) {
    const created = await createRecords('tblaCaCZNeP59w3x4', newJobs);
    console.log(`  Created: ${created.length} direct mail jobs`);
  }
}

// ==========================================
// 2. LINK DIRECT MAIL JOBS TO ORDERS
// ==========================================
async function linkDMJobsToOrders(orders) {
  console.log('\n🔗 Linking Direct Mail Jobs to Orders...');
  
  const dmJobs = await getAllRecords('tblaCaCZNeP59w3x4');
  const orderLookup = {};
  orders.forEach(o => {
    if (o.fields.order_number) orderLookup[o.fields.order_number] = o.id;
  });
  
  const updates = [];
  for (const job of dmJobs) {
    if (job.fields.order?.length > 0) continue; // Already linked
    
    const orderNum = job.fields.order_number;
    if (orderNum && orderLookup[orderNum]) {
      updates.push({
        id: job.id,
        fields: { order: [orderLookup[orderNum]] }
      });
    }
  }
  
  console.log(`  Jobs needing link: ${updates.length}`);
  if (updates.length > 0) {
    await updateRecords('tblaCaCZNeP59w3x4', updates);
    console.log(`  Linked: ${updates.length}`);
  }
}

// ==========================================
// 3. IMPORT DIGITAL JOBS
// ==========================================
async function importDigitalJobs(orders) {
  console.log('\n📱 Checking Digital Jobs...');
  
  const existing = await getAllRecords('tblpqN5H5or3bWzeb');
  console.log(`  Existing: ${existing.length} digital jobs`);
  
  // Link unlinked jobs to orders
  const orderLookup = {};
  orders.forEach(o => {
    if (o.fields.order_number) orderLookup[o.fields.order_number] = o.id;
  });
  
  const updates = [];
  for (const job of existing) {
    if (job.fields.order?.length > 0) continue;
    
    const orderNum = job.fields.order_number;
    if (orderNum && orderLookup[orderNum]) {
      updates.push({
        id: job.id,
        fields: { order: [orderLookup[orderNum]] }
      });
    }
  }
  
  if (updates.length > 0) {
    console.log(`  Linking ${updates.length} to orders...`);
    await updateRecords('tblpqN5H5or3bWzeb', updates);
  }
}

// ==========================================
// 4. IMPORT INVOICES
// ==========================================
async function importInvoices(orders, clients) {
  console.log('\n💰 Checking Invoices...');
  
  const existing = await getAllRecords('tblRNcOaEQAMRxKuZ');
  console.log(`  Existing: ${existing.length} invoices`);
  
  // Build lookups
  const orderLookup = {};
  orders.forEach(o => {
    if (o.fields.order_number) orderLookup[o.fields.order_number] = o.id;
  });
  
  const clientLookup = {};
  clients.forEach(c => {
    const name = (c.fields.advisor_name || '').toLowerCase().trim();
    if (name) clientLookup[name] = c.id;
  });
  
  // Link unlinked invoices
  const updates = [];
  for (const inv of existing) {
    const changes = {};
    
    // Link to order
    if (!inv.fields.order?.length) {
      const orderNum = inv.fields.order_number;
      if (orderNum && orderLookup[orderNum]) {
        changes.order = [orderLookup[orderNum]];
      }
    }
    
    // Link to client
    if (!inv.fields.client?.length) {
      const advisorName = (inv.fields.advisor_name || '').toLowerCase().trim();
      if (advisorName && clientLookup[advisorName]) {
        changes.client = [clientLookup[advisorName]];
      }
    }
    
    if (Object.keys(changes).length > 0) {
      updates.push({ id: inv.id, fields: changes });
    }
  }
  
  if (updates.length > 0) {
    console.log(`  Linking ${updates.length} invoices...`);
    await updateRecords('tblRNcOaEQAMRxKuZ', updates);
  }
}

// ==========================================
// 5. LINK ORDERS TO REGIONS
// ==========================================
async function linkOrdersToRegions(orders, regions) {
  console.log('\n🗺️  Linking Orders to Regions...');
  
  // Build region lookup by name and state
  const regionByName = {};
  const regionByState = {};
  regions.forEach(r => {
    const name = (r.fields.Name || '').toLowerCase().trim();
    const state = (r.fields.State || '').toUpperCase().trim();
    if (name) regionByName[name] = r.id;
    if (state) regionByState[state] = r.id;
  });
  
  // Known mappings
  const marketToRegion = {
    'dallas': 'dallas',
    'plano': 'dallas',
    'frisco': 'dallas',
    'rolling meadows': 'rolling meadows',
    'oak brook': 'oak brook',
    'st. louis': 'st. louis',
    'st louis': 'st. louis',
    'southern illinois': 'southern illinois',
    'edwardsville': 'southern illinois',
    'connecticut': 'connecticut',
    'wallingford': 'connecticut',
    'maryland': 'maryland',
    'pennsylvania': 'pennsylvania',
    'michigan': 'michigan',
    'ohio': 'ohio',
    'columbus': 'ohio',
    'kansas': 'kansas',
    'overland park': 'kansas',
    'florida': 'florida',
    'california': 'california',
    'nashville': 'nashville',
  };
  
  const updates = [];
  for (const order of orders) {
    if (order.fields.Region?.length > 0) continue;
    
    const market = (order.fields.market || '').toLowerCase().trim();
    const office = (order.fields.office_location || '').toLowerCase().trim();
    
    let regionId = null;
    
    // Try market mapping
    for (const [key, regionName] of Object.entries(marketToRegion)) {
      if (market.includes(key) || office.includes(key)) {
        regionId = regionByName[regionName];
        if (regionId) break;
      }
    }
    
    if (regionId) {
      updates.push({ id: order.id, fields: { Region: [regionId] } });
    }
  }
  
  console.log(`  Orders needing region: ${updates.length}`);
  if (updates.length > 0) {
    await updateRecords('tblXNAKyqUgfIMRO9', updates);
    console.log(`  Linked: ${updates.length}`);
  }
}

// ==========================================
// 6. LINK EVENTS TO REGISTRATIONS TABLE
// ==========================================
async function checkRegistrations() {
  console.log('\n📝 Checking Registrations...');
  
  const regs = await getAllRecords('tbl71uUboVab6GnQc');
  console.log(`  Existing: ${regs.length} registrations`);
  
  const linked = regs.filter(r => r.fields.event?.length > 0);
  console.log(`  Linked to events: ${linked.length}`);
}

// ==========================================
// MAIN
// ==========================================
async function main() {
  console.log('🔄 CONNECTING ALL DATA\n');
  console.log('='.repeat(50));
  
  // Load base data
  console.log('\n📊 Loading base data...');
  const orders = await getAllRecords('tblXNAKyqUgfIMRO9');
  const clients = await getAllRecords('tblcDxT3ULNTGNo4v');
  const regions = await getAllRecords('tbl6zAmQvRL32KNvP');
  console.log(`  Orders: ${orders.length}`);
  console.log(`  Clients: ${clients.length}`);
  console.log(`  Regions: ${regions.length}`);
  
  // Run imports and links
  await importDirectMailJobs(orders);
  await linkDMJobsToOrders(orders);
  await importDigitalJobs(orders);
  await importInvoices(orders, clients);
  await linkOrdersToRegions(orders, regions);
  await checkRegistrations();
  
  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ ALL CONNECTIONS COMPLETE');
  console.log('='.repeat(50));
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
