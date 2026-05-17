#!/usr/bin/env node
/**
 * Link Orders to Clients based on advisor name matching
 */

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

// Normalize name for matching
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('🔗 Linking Orders to Clients\n');
  
  // Get Clients
  const clients = await getAllRecords('tblcDxT3ULNTGNo4v');
  console.log(`Found ${clients.length} clients`);
  
  // Build lookup by advisor_name
  const clientLookup = {};
  clients.forEach(c => {
    const name = normalize(c.fields.advisor_name);
    if (name) clientLookup[name] = c.id;
    
    // Also add by business name
    const biz = normalize(c.fields.business_name);
    if (biz) clientLookup[biz] = c.id;
  });
  
  // Add known mappings
  const aliases = {
    'fta dallas': 'dallas',
    'fta stl': 'st louis',
    'fta rolling meadows': 'rolling meadows',
    'fta oak brook': 'oak brook',
    'fta southern illinois': 'southern illinois',
    'fta chicago': 'rolling meadows',
    'will warner ct': 'will warner ct',
    'will warner md': 'will warner md', 
    'will warner pa': 'will warner pa',
    'rick bone': 'rick bone',
    'bone asset': 'rick bone',
  };
  
  // Get Orders
  const orders = await getAllRecords('tblXNAKyqUgfIMRO9');
  console.log(`Found ${orders.length} orders`);
  
  // Check current state
  let alreadyLinked = 0;
  let needsLink = 0;
  
  orders.forEach(o => {
    if (o.fields.client && o.fields.client.length > 0) {
      alreadyLinked++;
    } else {
      needsLink++;
    }
  });
  
  console.log(`Already linked: ${alreadyLinked}`);
  console.log(`Needs link: ${needsLink}\n`);
  
  if (needsLink === 0) {
    console.log('All orders already linked!');
    return;
  }
  
  // Find matches for unlinked orders
  const updates = [];
  const unmatched = [];
  
  for (const order of orders) {
    if (order.fields.client && order.fields.client.length > 0) continue;
    
    // Try to match by group_name or office_location
    const groupName = normalize(order.fields.group_name);
    const office = normalize(order.fields.office_location);
    const market = normalize(order.fields.market);
    
    let clientId = null;
    
    // Try direct match
    clientId = clientLookup[groupName] || clientLookup[office] || clientLookup[market];
    
    // Try alias
    if (!clientId) {
      const aliasKey = Object.keys(aliases).find(k => 
        groupName.includes(k) || office.includes(k) || (groupName + ' ' + office).includes(k)
      );
      if (aliasKey) {
        clientId = clientLookup[aliases[aliasKey]];
      }
    }
    
    // Try fuzzy match
    if (!clientId) {
      const searchTerms = [groupName, office, market].filter(Boolean);
      for (const term of searchTerms) {
        for (const [key, id] of Object.entries(clientLookup)) {
          if (term.includes(key) || key.includes(term)) {
            clientId = id;
            break;
          }
        }
        if (clientId) break;
      }
    }
    
    if (clientId) {
      updates.push({
        id: order.id,
        fields: { client: [clientId] }
      });
    } else {
      unmatched.push({
        orderNum: order.fields.order_number,
        group: groupName,
        office: office
      });
    }
  }
  
  console.log(`Matched: ${updates.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  
  if (unmatched.length > 0 && unmatched.length < 20) {
    console.log('\nUnmatched orders:');
    unmatched.forEach(u => console.log(`  ○ #${u.orderNum}: ${u.group} / ${u.office}`));
  }
  
  // Apply updates
  if (updates.length > 0) {
    console.log('\nApplying updates...');
    const results = await updateRecords('tblXNAKyqUgfIMRO9', updates);
    console.log(`Updated ${results.length} order records`);
  }
  
  console.log('\n✅ Done');
}

main().catch(e => console.error('Error:', e.message));
