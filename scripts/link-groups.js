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

async function batchUpdate(table, updates) {
  for (let i = 0; i < updates.length; i += 10) {
    await base(table).update(updates.slice(i, i + 10));
    process.stdout.write(`  ${Math.min(i + 10, updates.length)}/${updates.length}\r`);
  }
  console.log('');
}

async function main() {
  console.log('Loading...');
  const [orders, groups, regions, charities] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Groups'),
    getAllRecords('Regions'),
    getAllRecords('Charities'),
  ]);

  // Build group -> regions and group -> charities from orders
  const groupRegions = new Map();
  const groupCharities = new Map();

  orders.forEach(o => {
    const grpIds = o.fields.Group || [];
    const regIds = o.fields.Region || [];
    const charIds = o.fields.Charity || [];

    grpIds.forEach(gid => {
      if (!groupRegions.has(gid)) groupRegions.set(gid, new Set());
      if (!groupCharities.has(gid)) groupCharities.set(gid, new Set());
      
      regIds.forEach(rid => groupRegions.get(gid).add(rid));
      charIds.forEach(cid => groupCharities.get(gid).add(cid));
    });
  });

  // Update Groups with Regions
  console.log('\nLinking Regions to Groups...');
  let grpRegUpdates = [];
  for (const [gid, regSet] of groupRegions) {
    const grp = groups.find(g => g.id === gid);
    if (grp && regSet.size > 0) {
      const existing = new Set(grp.fields.Regions || []);
      const all = [...new Set([...existing, ...regSet])];
      if (all.length > existing.size) {
        grpRegUpdates.push({ id: gid, fields: { Regions: all } });
      }
    }
  }
  console.log(`Groups needing region links: ${grpRegUpdates.length}`);
  if (grpRegUpdates.length > 0) await batchUpdate('Groups', grpRegUpdates);

  // Update Groups with Charities
  console.log('\nLinking Charities to Groups...');
  let grpCharUpdates = [];
  for (const [gid, charSet] of groupCharities) {
    const grp = groups.find(g => g.id === gid);
    if (grp && charSet.size > 0) {
      const existing = new Set(grp.fields.Charities || []);
      const all = [...new Set([...existing, ...charSet])];
      if (all.length > existing.size) {
        grpCharUpdates.push({ id: gid, fields: { Charities: all } });
      }
    }
  }
  console.log(`Groups needing charity links: ${grpCharUpdates.length}`);
  if (grpCharUpdates.length > 0) await batchUpdate('Groups', grpCharUpdates);

  // Also link Regions back to Groups
  console.log('\nLinking Groups to Regions (reverse)...');
  const regionGroups = new Map();
  for (const [gid, regSet] of groupRegions) {
    regSet.forEach(rid => {
      if (!regionGroups.has(rid)) regionGroups.set(rid, new Set());
      regionGroups.get(rid).add(gid);
    });
  }

  let regGrpUpdates = [];
  for (const [rid, grpSet] of regionGroups) {
    const reg = regions.find(r => r.id === rid);
    if (reg && grpSet.size > 0) {
      const existing = new Set(reg.fields.Group || []);
      const all = [...new Set([...existing, ...grpSet])];
      if (all.length > existing.size) {
        regGrpUpdates.push({ id: rid, fields: { Group: all } });
      }
    }
  }
  console.log(`Regions needing group links: ${regGrpUpdates.length}`);
  if (regGrpUpdates.length > 0) await batchUpdate('Regions', regGrpUpdates);

  // Link Charities back to Groups
  console.log('\nLinking Groups to Charities (reverse)...');
  const charityGroups = new Map();
  for (const [gid, charSet] of groupCharities) {
    charSet.forEach(cid => {
      if (!charityGroups.has(cid)) charityGroups.set(cid, new Set());
      charityGroups.get(cid).add(gid);
    });
  }

  let charGrpUpdates = [];
  for (const [cid, grpSet] of charityGroups) {
    const char = charities.find(c => c.id === cid);
    if (char && grpSet.size > 0) {
      const existing = new Set(char.fields.Groups || char.fields.Group || []);
      const all = [...new Set([...existing, ...grpSet])];
      if (all.length > existing.size) {
        charGrpUpdates.push({ id: cid, fields: { Groups: all } });
      }
    }
  }
  console.log(`Charities needing group links: ${charGrpUpdates.length}`);
  if (charGrpUpdates.length > 0) await batchUpdate('Charities', charGrpUpdates);

  // Verify
  console.log('\n=== VERIFICATION ===');
  const freshGroups = await getAllRecords('Groups');
  freshGroups.forEach(g => {
    const regs = (g.fields.Regions || []).length;
    const chars = (g.fields.Charities || []).length;
    if (regs > 0 || chars > 0) {
      console.log(`${g.fields.Name}: ${regs} regions, ${chars} charities`);
    }
  });

  console.log('\n✅ Done!');
}

main().catch(console.error);
