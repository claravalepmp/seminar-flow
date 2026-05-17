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
  console.log('Loading data...');
  const [orders, venues, groups] = await Promise.all([
    getAllRecords('Orders'),
    getAllRecords('Venues'),
    getAllRecords('Groups'),
  ]);

  console.log(`Orders: ${orders.length}, Existing Venues: ${venues.length}`);

  // Extract unique venues from orders
  const venueMap = new Map();
  orders.forEach(o => {
    const name = o.fields.venue_name;
    if (name && name.trim()) {
      const key = name.toLowerCase().trim();
      if (!venueMap.has(key)) {
        venueMap.set(key, {
          name: name.trim(),
          address: o.fields.venue_address || '',
          groupName: o.fields.group_name || '',
        });
      } else {
        // Update with address if we have one
        const existing = venueMap.get(key);
        if (!existing.address && o.fields.venue_address) {
          existing.address = o.fields.venue_address;
        }
      }
    }
  });

  console.log(`Unique venues found in orders: ${venueMap.size}`);

  // Check which venues already exist
  const existingVenues = new Set();
  venues.forEach(v => {
    if (v.fields.Name) existingVenues.add(v.fields.Name.toLowerCase().trim());
  });

  // Create missing venues
  const venuesToCreate = [];
  const groupByName = new Map();
  groups.forEach(g => {
    if (g.fields.Name) groupByName.set(g.fields.Name.toLowerCase().trim(), g.id);
  });

  for (const [key, venue] of venueMap) {
    if (!existingVenues.has(key)) {
      const fields = { Name: venue.name };
      if (venue.address) fields.Address = venue.address;
      
      // Try to extract city/state from address
      if (venue.address) {
        const parts = venue.address.split(',').map(s => s.trim());
        if (parts.length >= 2) {
          // Last part might be "State ZIP" or just state
          const lastPart = parts[parts.length - 1];
          const stateMatch = lastPart.match(/([A-Z]{2})\s*\d{5}?/);
          if (stateMatch) {
            fields.State = stateMatch[1];
          }
          // Second to last is usually city
          if (parts.length >= 2) {
            fields.City = parts[parts.length - 2];
          }
        }
      }
      
      // Link to group if possible
      if (venue.groupName) {
        const groupId = groupByName.get(venue.groupName.toLowerCase().trim());
        if (groupId) {
          fields.Groups = [groupId];
        }
      }
      
      venuesToCreate.push({ fields });
    }
  }

  console.log(`Venues to create: ${venuesToCreate.length}`);

  if (venuesToCreate.length > 0) {
    console.log('Creating venues...');
    for (let i = 0; i < venuesToCreate.length; i += 10) {
      const batch = venuesToCreate.slice(i, i + 10);
      await base('Venues').create(batch);
      process.stdout.write(`  Created ${Math.min(i + 10, venuesToCreate.length)}/${venuesToCreate.length}\r`);
    }
    console.log('\n  Done creating venues.');
  }

  // Now reload and link orders to venues
  console.log('\nReloading venues and linking to orders...');
  const newVenues = await getAllRecords('Venues');
  const venueByName = new Map();
  newVenues.forEach(v => {
    if (v.fields.Name) venueByName.set(v.fields.Name.toLowerCase().trim(), v.id);
  });

  // This would need a Venue link field in Orders - check if it exists
  console.log(`Now have ${newVenues.length} venues in Airtable`);

  console.log('\n✅ Venues created!');
}

main().catch(console.error);
