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

async function main() {
  const [orders, groups, regions] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Groups'),
    getAllRecords('Regions'),
  ]);

  // Build group -> regions from orders
  const groupRegions = new Map();
  orders.forEach(o => {
    const grpIds = o.fields.Group || [];
    const regIds = o.fields.Region || [];
    grpIds.forEach(gid => {
      if (!groupRegions.has(gid)) groupRegions.set(gid, new Set());
      regIds.forEach(rid => groupRegions.get(gid).add(rid));
    });
  });

  // Update all groups
  console.log('Updating groups with regions...');
  let updates = [];
  for (const [gid, regSet] of groupRegions) {
    const grp = groups.find(g => g.id === gid);
    if (grp && regSet.size > 0) {
      const existing = new Set(grp.fields.Regions || []);
      const all = [...new Set([...existing, ...regSet])];
      if (all.length > existing.size) {
        updates.push({ id: gid, fields: { Regions: all } });
      }
    }
  }

  console.log(`Groups to update: ${updates.length}`);
  for (let i = 0; i < updates.length; i += 10) {
    await base('Groups').update(updates.slice(i, i + 10));
  }

  // Also update regions with groups
  const regionGroups = new Map();
  for (const [gid, regSet] of groupRegions) {
    regSet.forEach(rid => {
      if (!regionGroups.has(rid)) regionGroups.set(rid, new Set());
      regionGroups.get(rid).add(gid);
    });
  }

  console.log('Updating regions with groups...');
  let regUpdates = [];
  for (const [rid, grpSet] of regionGroups) {
    const reg = regions.find(r => r.id === rid);
    if (reg && grpSet.size > 0) {
      const existing = new Set(reg.fields.Group || []);
      const all = [...new Set([...existing, ...grpSet])];
      if (all.length > existing.size) {
        regUpdates.push({ id: rid, fields: { Group: all } });
      }
    }
  }

  console.log(`Regions to update: ${regUpdates.length}`);
  for (let i = 0; i < regUpdates.length; i += 10) {
    await base('Regions').update(regUpdates.slice(i, i + 10));
  }

  // Show final summary
  const freshGroups = await getAllRecords('Groups');
  console.log('\n=== GROUP REGIONS ===');
  freshGroups.filter(g => (g.fields.Regions || []).length > 0).forEach(g => {
    const regNames = (g.fields.Regions || []).map(rid => {
      const r = regions.find(reg => reg.id === rid);
      return r?.fields.Name || rid;
    }).join(', ');
    console.log(`${g.fields.Name}: ${regNames}`);
  });

  console.log('\n✅ Done');
}

main().catch(console.error);
