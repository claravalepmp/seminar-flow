#!/usr/bin/env node
/**
 * Fix schema: 
 * 1. Link Clients (Advisors) to Groups
 * 2. Create Group fields where missing
 * 3. Populate Group links throughout
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

async function getSchema() {
  const data = await api(`/meta/bases/${BASE_ID}/tables`);
  return data.tables || [];
}

async function main() {
  console.log('=== Schema Analysis & Fix ===\n');

  // Get schema
  console.log('Fetching schema...');
  const tables = await getSchema();
  console.log(`Found ${tables.length} tables\n`);

  // List tables and their key fields
  for (const table of tables) {
    const hasGroup = table.fields?.some(f => f.name === 'Group');
    const hasClient = table.fields?.some(f => f.name === 'client' || f.name === 'Client');
    console.log(`${table.name} (${table.id})`);
    console.log(`   Has Group field: ${hasGroup ? '✅' : '❌'}`);
    if (hasClient) console.log(`   Has client field: ✅`);
  }

  console.log('\n=== Linking Clients to Groups ===\n');

  // Get Groups
  const groups = await getAllRecords('Groups');
  const groupByName = {};
  groups.forEach(g => {
    const name = g.fields.Name?.toLowerCase().trim();
    if (name) groupByName[name] = g.id;
    // Also try variations
    if (name?.includes('fta')) groupByName['fta'] = g.id;
    if (name?.includes('sam')) groupByName['sam ria'] = g.id;
  });
  console.log(`Loaded ${groups.length} groups`);

  // Get Clients and check their group_name field
  const clients = await getAllRecords('Clients');
  console.log(`Found ${clients.length} clients\n`);

  // Show sample client fields
  if (clients.length > 0) {
    console.log('Sample client fields:', Object.keys(clients[0].fields).join(', '));
    console.log('');
  }

  // Check which clients have group_name but no Group link
  const needsLink = [];
  for (const client of clients) {
    const hasGroupLink = client.fields.Group && client.fields.Group.length > 0;
    const groupName = client.fields.group_name || client.fields.Group_Name || client.fields.GroupName;
    
    if (!hasGroupLink && groupName) {
      const normalizedName = groupName.toLowerCase().trim();
      const groupId = groupByName[normalizedName];
      if (groupId) {
        needsLink.push({ 
          id: client.id, 
          name: client.fields.Name || client.fields.name,
          groupName,
          groupId
        });
      } else {
        console.log(`   No match for: "${groupName}" (client: ${client.fields.Name || client.fields.name})`);
      }
    }
  }

  console.log(`\nClients to link: ${needsLink.length}`);

  if (needsLink.length > 0) {
    console.log('Linking...');
    const updates = needsLink.map(c => ({
      id: c.id,
      fields: { Group: [c.groupId] }
    }));
    await updateRecords('Clients', updates);
    console.log('✅ Done linking clients to groups');
  }

  // Now show what fields need to be created in Airtable UI
  console.log('\n=== Manual Steps Needed in Airtable ===\n');
  
  const tablesNeedingGroup = [];
  for (const table of tables) {
    const hasGroup = table.fields?.some(f => f.name === 'Group');
    if (!hasGroup && ['Venues', 'Orders', 'Invoices', 'Digital_Jobs', 'Direct_Mail_Jobs', 'Events_v2'].includes(table.name)) {
      tablesNeedingGroup.push(table.name);
    }
  }

  if (tablesNeedingGroup.length > 0) {
    console.log('Create a "Group" field (Link to Groups) in these tables:');
    tablesNeedingGroup.forEach(t => console.log(`   - ${t}`));
    console.log('\nThen run add-group-links.js again.');
  } else {
    console.log('All tables have Group field! ✅');
  }
}

main().catch(console.error);
