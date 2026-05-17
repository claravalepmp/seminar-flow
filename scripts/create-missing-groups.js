#!/usr/bin/env node
/**
 * Create missing Groups and link everything
 */

const AIRTABLE_PAT = 'patXfYHRo6qBwvdfN.e6adc9494afba663c10b9869a02a1ecccd45ac35d7a2ff16e70f6b3c9e0491fa';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  return res.json();
}

async function getAll(table) {
  let records = [], offset = null;
  do {
    const data = await api(`/${BASE_ID}/${encodeURIComponent(table)}${offset ? '?offset=' + offset : ''}`);
    if (data.error) { console.log('Error:', table, data.error); return records; }
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function createRecords(table, records) {
  const results = [];
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const data = await api(`/${BASE_ID}/${encodeURIComponent(table)}`, 'POST', { records: chunk });
    if (data.error) console.log('Create error:', data.error);
    else results.push(...(data.records || []));
    await new Promise(r => setTimeout(r, 250));
  }
  return results;
}

async function updateRecords(table, updates) {
  let success = 0;
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    const data = await api(`/${BASE_ID}/${encodeURIComponent(table)}`, 'PATCH', { records: chunk });
    if (!data.error) success += (data.records?.length || 0);
    await new Promise(r => setTimeout(r, 250));
  }
  return success;
}

function hasGroup(r) { return r.fields.Group?.[0] || r.fields.group?.[0]; }

async function main() {
  console.log('=== Creating Missing Groups & Linking ===\n');

  // 1. Get existing groups
  const groups = await getAll('Groups');
  const groupByName = {};
  groups.forEach(g => {
    const name = g.fields.Name?.toLowerCase().trim();
    if (name) groupByName[name] = g.id;
  });
  console.log(`Existing groups: ${groups.length}\n`);

  // 2. Find missing group names from Digital_Jobs
  console.log('1. Finding missing groups from Digital_Jobs...');
  const digitalJobs = await getAll('Digital_Jobs');
  const missingGroups = new Set();
  
  digitalJobs.forEach(j => {
    if (hasGroup(j)) return;
    const gname = j.fields.group_name?.trim();
    if (gname && !groupByName[gname.toLowerCase()]) {
      missingGroups.add(gname);
    }
  });
  
  console.log(`   Missing: ${[...missingGroups].join(', ')}\n`);

  // 3. Create new Groups
  if (missingGroups.size > 0) {
    console.log('2. Creating new Groups...');
    const newGroups = [...missingGroups].map(name => ({ fields: { Name: name } }));
    const created = await createRecords('Groups', newGroups);
    created.forEach(g => {
      groupByName[g.fields.Name.toLowerCase().trim()] = g.id;
      console.log(`   ✅ Created: ${g.fields.Name}`);
    });
    console.log('');
  }

  // 4. Link Digital_Jobs to Groups
  console.log('3. Linking Digital_Jobs → Groups...');
  const djUpdates = [];
  for (const j of digitalJobs) {
    if (hasGroup(j)) continue;
    const gname = j.fields.group_name?.toLowerCase().trim();
    if (gname && groupByName[gname]) {
      djUpdates.push({ id: j.id, fields: { Group: [groupByName[gname]] } });
    }
  }
  if (djUpdates.length > 0) {
    const n = await updateRecords('Digital_Jobs', djUpdates);
    console.log(`   ✅ Linked ${n} digital jobs\n`);
  }

  // 5. Link Invoices → Groups (via client)
  console.log('4. Linking Invoices → Groups...');
  const advisors = await getAll('Advisors');
  const advisorToGroup = {};
  advisors.forEach(a => {
    const gid = hasGroup(a);
    if (gid) advisorToGroup[a.id] = gid;
  });

  const invoices = await getAll('Invoices');
  const invUpdates = [];
  for (const inv of invoices) {
    if (hasGroup(inv)) continue;
    const clientId = inv.fields.client?.[0];
    if (clientId && advisorToGroup[clientId]) {
      invUpdates.push({ id: inv.id, fields: { Group: [advisorToGroup[clientId]] } });
    }
  }
  if (invUpdates.length > 0) {
    const n = await updateRecords('Invoices', invUpdates);
    console.log(`   ✅ Linked ${n} invoices\n`);
  }

  // 6. Link Venues → Groups (via client link or advisor)
  console.log('5. Linking Venues → Groups...');
  const venues = await getAll('Venues');
  const venueUpdates = [];
  
  for (const v of venues) {
    if (hasGroup(v)) continue;
    
    // Try via Advisors link
    const advisorIds = v.fields.Advisors || v.fields.advisors || v.fields.Client || v.fields.client || [];
    for (const aid of advisorIds) {
      if (advisorToGroup[aid]) {
        venueUpdates.push({ id: v.id, fields: { Group: [advisorToGroup[aid]] } });
        break;
      }
    }
  }
  if (venueUpdates.length > 0) {
    const n = await updateRecords('Venues', venueUpdates);
    console.log(`   ✅ Linked ${n} venues\n`);
  }

  // 7. Link remaining DM jobs
  console.log('6. Linking remaining Direct_Mail_Jobs...');
  const orders = await getAll('Orders');
  const orderToGroup = {};
  orders.forEach(o => {
    const gid = hasGroup(o);
    if (gid) orderToGroup[o.id] = gid;
  });

  const dmJobs = await getAll('Direct_Mail_Jobs');
  const dmUpdates = [];
  for (const j of dmJobs) {
    if (hasGroup(j)) continue;
    
    // Try Order link
    const orderId = j.fields.Order?.[0] || j.fields.order?.[0];
    if (orderId && orderToGroup[orderId]) {
      dmUpdates.push({ id: j.id, fields: { Group: [orderToGroup[orderId]] } });
      continue;
    }
    
    // Try group_name text field
    const gname = (j.fields.group_name || j.fields['Group Name'] || '').toLowerCase().trim();
    if (gname && groupByName[gname]) {
      dmUpdates.push({ id: j.id, fields: { Group: [groupByName[gname]] } });
    }
  }
  if (dmUpdates.length > 0) {
    const n = await updateRecords('Direct_Mail_Jobs', dmUpdates);
    console.log(`   ✅ Linked ${n} DM jobs\n`);
  }

  // Final status
  console.log('=== FINAL STATUS ===\n');
  const tables = ['Groups', 'Advisors', 'Orders', 'Invoices', 'Digital_Jobs', 'Direct_Mail_Jobs', 'Events_v2', 'Venues', 'Charities'];
  for (const t of tables) {
    const recs = await getAll(t);
    if (t === 'Groups') {
      console.log('Groups'.padEnd(18), recs.length, 'companies');
    } else {
      const linked = recs.filter(hasGroup).length;
      const pct = recs.length > 0 ? Math.round(linked / recs.length * 100) : 0;
      const bar = '█'.repeat(Math.round(pct/10)) + '░'.repeat(10 - Math.round(pct/10));
      console.log(t.padEnd(18), (linked + '/' + recs.length).padEnd(10), bar, pct + '%');
    }
  }
}

main().catch(console.error);
