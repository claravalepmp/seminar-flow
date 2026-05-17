#!/usr/bin/env node
/**
 * Link Clients to their Groups based on group_name field
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

async function main() {
  console.log('🔗 Linking Clients to Groups\n');
  
  // Get Groups
  const groups = await getAllRecords('tblYbSZsqlyB8yWMs');
  console.log(`Found ${groups.length} groups`);
  
  // Build lookup by name (fuzzy matching)
  const groupLookup = {};
  groups.forEach(g => {
    const name = (g.fields.Name || '').toLowerCase().trim();
    groupLookup[name] = g.id;
    // Also add variations
    if (name.includes('fta')) groupLookup['fta'] = g.id;
    if (name.includes('sam')) groupLookup['sam ria'] = g.id;
    if (name.includes('sentinel')) groupLookup['sam ria'] = g.id;
  });
  
  // Get Clients
  const clients = await getAllRecords('tblcDxT3ULNTGNo4v');
  console.log(`Found ${clients.length} clients`);
  
  // Find clients needing group link
  const updates = [];
  const unmatched = [];
  
  for (const client of clients) {
    const existingLink = client.fields.group;
    if (existingLink && existingLink.length > 0) continue; // Already linked
    
    const groupName = (client.fields.group_name || '').toLowerCase().trim();
    if (!groupName) {
      unmatched.push({ name: client.fields.advisor_name, reason: 'no group_name' });
      continue;
    }
    
    // Try to find matching group
    let groupId = groupLookup[groupName];
    
    // Fuzzy match
    if (!groupId) {
      for (const [key, id] of Object.entries(groupLookup)) {
        if (groupName.includes(key) || key.includes(groupName)) {
          groupId = id;
          break;
        }
      }
    }
    
    if (groupId) {
      updates.push({
        id: client.id,
        fields: { group: [groupId] }
      });
      console.log(`  ✓ ${client.fields.advisor_name} → ${groupName}`);
    } else {
      unmatched.push({ name: client.fields.advisor_name, groupName });
    }
  }
  
  console.log(`\nMatched: ${updates.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  
  if (unmatched.length > 0) {
    console.log('\nUnmatched clients:');
    unmatched.forEach(u => console.log(`  ○ ${u.name} (group: ${u.groupName || 'none'})`));
  }
  
  // Apply updates
  if (updates.length > 0) {
    console.log('\nApplying updates...');
    const results = await updateRecords('tblcDxT3ULNTGNo4v', updates);
    console.log(`Updated ${results.length} client records`);
  }
  
  console.log('\n✅ Done');
}

main().catch(e => console.error('Error:', e.message));
