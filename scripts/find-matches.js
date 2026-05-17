#!/usr/bin/env node
/**
 * Find matches for unlinked records and link them to Groups
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
    if (data.error) return records;
    records = records.concat(data.records || []);
    offset = data.offset;
    await new Promise(r => setTimeout(r, 200));
  } while (offset);
  return records;
}

async function update(table, updates, field = 'Group') {
  let success = 0;
  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10).map(u => ({ id: u.id, fields: { [field]: [u.groupId] } }));
    const data = await api(`/${BASE_ID}/${encodeURIComponent(table)}`, 'PATCH', { records: chunk });
    if (!data.error) success += (data.records?.length || 0);
    await new Promise(r => setTimeout(r, 250));
  }
  return success;
}

function hasGroup(r) {
  return r.fields.Group?.[0] || r.fields.group?.[0];
}

async function main() {
  console.log('=== Finding Matches ===\n');

  // Load Groups and build matchers
  const groups = await getAll('Groups');
  const groupByName = {};
  const groupPatterns = [];
  
  groups.forEach(g => {
    const name = g.fields.Name?.toLowerCase().trim();
    if (!name) return;
    groupByName[name] = g.id;
    
    // Build patterns from group names
    const words = name.split(/[\s,\-&]+/).filter(w => w.length > 2);
    groupPatterns.push({ id: g.id, name, words });
  });

  // Fuzzy match function
  function findGroup(text) {
    if (!text) return null;
    const lower = text.toLowerCase().trim();
    
    // Exact match
    if (groupByName[lower]) return groupByName[lower];
    
    // Partial matches
    for (const [name, id] of Object.entries(groupByName)) {
      if (lower.includes(name) || name.includes(lower)) return id;
    }
    
    // Word-based matching
    for (const p of groupPatterns) {
      const matchCount = p.words.filter(w => lower.includes(w)).length;
      if (matchCount >= 2 || (p.words.length === 1 && lower.includes(p.words[0]))) {
        return p.id;
      }
    }
    
    // Known abbreviations/variations
    if (lower.includes('fta') || lower.includes('financial & tax') || lower.includes('financial and tax')) {
      return groupByName['fta'] || Object.values(groupByName).find(id => groups.find(g => g.id === id)?.fields.Name?.includes('FTA'));
    }
    if (lower.includes('sam') || lower.includes('sentinel')) {
      return groupByName['sam ria'] || groupByName['sentinel asset management (sam ria)'];
    }
    if (lower.includes('otoole') || lower.includes("o'toole")) {
      for (const [name, id] of Object.entries(groupByName)) {
        if (name.includes('toole')) return id;
      }
    }
    
    return null;
  }

  // Load Advisors for client matching
  const advisors = await getAll('Advisors');
  const advisorToGroup = {};
  advisors.forEach(a => {
    const gid = hasGroup(a);
    if (gid) advisorToGroup[a.id] = gid;
  });

  // Load Orders for order matching  
  const orders = await getAll('Orders');
  const orderToGroup = {};
  orders.forEach(o => {
    const gid = hasGroup(o);
    if (gid) orderToGroup[o.id] = gid;
  });

  // Load Regions
  const regions = await getAll('Regions');
  const regionToGroup = {};
  regions.forEach(r => {
    const gid = hasGroup(r);
    if (gid) regionToGroup[r.id] = gid;
  });

  // 1. Fix Advisors without groups (via group_name text field)
  console.log('1. Advisors without groups...');
  const unlinkedAdvisors = advisors.filter(a => !hasGroup(a));
  const advisorUpdates = [];
  for (const a of unlinkedAdvisors) {
    const groupName = a.fields.group_name || a.fields.Group_Name || '';
    const groupId = findGroup(groupName);
    if (groupId) {
      advisorUpdates.push({ id: a.id, groupId });
      advisorToGroup[a.id] = groupId;
    } else {
      console.log('   No match:', a.fields.advisor_name || a.fields.Name, '- group_name:', groupName);
    }
  }
  if (advisorUpdates.length > 0) {
    const n = await update('Advisors', advisorUpdates, 'group');
    console.log(`   ✅ Linked ${n} advisors\n`);
  } else {
    console.log('   No new matches\n');
  }

  // 2. Fix Regions without groups
  console.log('2. Regions without groups...');
  const unlinkedRegions = regions.filter(r => !hasGroup(r));
  for (const r of unlinkedRegions) {
    console.log('   Unlinked:', r.fields.Name || r.fields.name);
  }
  console.log('');

  // 3. Fix Digital_Jobs (via client, or group_name field)
  console.log('3. Digital_Jobs without groups...');
  const digitalJobs = await getAll('Digital_Jobs');
  const digUpdates = [];
  for (const j of digitalJobs) {
    if (hasGroup(j)) continue;
    
    // Try client link
    const clientId = j.fields.client?.[0];
    if (clientId && advisorToGroup[clientId]) {
      digUpdates.push({ id: j.id, groupId: advisorToGroup[clientId] });
      continue;
    }
    
    // Try group_name text field
    const groupName = j.fields.group_name || j.fields['Group Name'] || '';
    const groupId = findGroup(groupName);
    if (groupId) {
      digUpdates.push({ id: j.id, groupId });
      continue;
    }
    
    // Try advisor_name field
    const advisorName = j.fields.advisor_name || '';
    const gid2 = findGroup(advisorName);
    if (gid2) {
      digUpdates.push({ id: j.id, groupId: gid2 });
    }
  }
  if (digUpdates.length > 0) {
    const n = await update('Digital_Jobs', digUpdates);
    console.log(`   ✅ Linked ${n} digital jobs\n`);
  } else {
    console.log('   No new matches\n');
  }

  // 4. Fix Direct_Mail_Jobs (via Order, or text fields)
  console.log('4. Direct_Mail_Jobs without groups...');
  const dmJobs = await getAll('Direct_Mail_Jobs');
  const dmUpdates = [];
  for (const j of dmJobs) {
    if (hasGroup(j)) continue;
    
    // Try Order link
    const orderId = j.fields.Order?.[0] || j.fields.order?.[0];
    if (orderId && orderToGroup[orderId]) {
      dmUpdates.push({ id: j.id, groupId: orderToGroup[orderId] });
      continue;
    }
    
    // Try group_name or client text fields
    const groupName = j.fields.group_name || j.fields['Group Name'] || j.fields.client_name || '';
    const groupId = findGroup(groupName);
    if (groupId) {
      dmUpdates.push({ id: j.id, groupId });
    }
  }
  if (dmUpdates.length > 0) {
    const n = await update('Direct_Mail_Jobs', dmUpdates);
    console.log(`   ✅ Linked ${n} DM jobs\n`);
  } else {
    console.log('   No new matches\n');
  }

  // 5. Fix Events_v2 (via Order)
  console.log('5. Events_v2 without groups...');
  const events = await getAll('Events_v2');
  const evtUpdates = [];
  for (const e of events) {
    if (hasGroup(e)) continue;
    
    const orderId = e.fields.Order?.[0];
    if (orderId && orderToGroup[orderId]) {
      evtUpdates.push({ id: e.id, groupId: orderToGroup[orderId] });
    }
  }
  if (evtUpdates.length > 0) {
    const n = await update('Events_v2', evtUpdates);
    console.log(`   ✅ Linked ${n} events\n`);
  } else {
    console.log('   No new matches\n');
  }

  // 6. Fix Venues (via Region)
  console.log('6. Venues without groups...');
  const venues = await getAll('Venues');
  const venueUpdates = [];
  for (const v of venues) {
    if (hasGroup(v)) continue;
    
    const regionId = v.fields.Region?.[0];
    if (regionId && regionToGroup[regionId]) {
      venueUpdates.push({ id: v.id, groupId: regionToGroup[regionId] });
    }
  }
  if (venueUpdates.length > 0) {
    const n = await update('Venues', venueUpdates);
    console.log(`   ✅ Linked ${n} venues\n`);
  } else {
    console.log('   No new matches\n');
  }

  // Final status
  console.log('=== Updated Status ===\n');
  const tables = ['Advisors', 'Regions', 'Orders', 'Digital_Jobs', 'Direct_Mail_Jobs', 'Events_v2', 'Venues'];
  for (const t of tables) {
    const recs = await getAll(t);
    const linked = recs.filter(hasGroup).length;
    const pct = recs.length > 0 ? Math.round(linked / recs.length * 100) : 0;
    const bar = '█'.repeat(Math.round(pct/10)) + '░'.repeat(10 - Math.round(pct/10));
    console.log(t.padEnd(18), (linked + '/' + recs.length).padEnd(10), bar, pct + '%');
  }
}

main().catch(console.error);
