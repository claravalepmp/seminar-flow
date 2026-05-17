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
  const regions = await getAllRecords('Regions');
  console.log('Current regions:');
  regions.forEach(r => {
    console.log(`  ${r.fields.Name} | State: ${r.fields.State || 'EMPTY'} | DefQty: ${r.fields['Default Quantity'] || 0}`);
  });

  const orders = await getAllRecords('Orders');
  
  // Extract unique states from order addresses
  const stateCount = new Map();
  orders.forEach(o => {
    const addr = o.fields.venue_address || '';
    const stateMatch = addr.match(/,\s*([A-Z]{2})\s*\d{5}/i) || addr.match(/,\s*([A-Z]{2})\s*$/i);
    if (stateMatch) {
      const state = stateMatch[1].toUpperCase();
      stateCount.set(state, (stateCount.get(state) || 0) + 1);
    }
  });
  
  console.log('\nStates found in orders:');
  [...stateCount.entries()].sort((a,b) => b[1] - a[1]).forEach(([state, count]) => {
    console.log(`  ${state}: ${count} orders`);
  });

  // Build region name -> state mapping based on common patterns
  const regionStateMap = {
    'Chicago': 'IL',
    'Dallas': 'TX',
    'St. Louis': 'MO',
    'STL': 'MO',
    'Connecticut': 'CT',
    'Maryland': 'MD',
    'Pennsylvania': 'PA',
    'Rolling Meadows': 'IL',
    'Oak Brook': 'IL',
    'Des Plaines': 'IL',
    'Schaumburg': 'IL',
    'Illinois': 'IL',
    'Texas': 'TX',
    'Missouri': 'MO',
  };

  // Update regions with states if we can infer them
  let updates = [];
  regions.forEach(r => {
    const name = r.fields.Name || '';
    if (!r.fields.State) {
      // Try to match region name to state
      for (const [pattern, state] of Object.entries(regionStateMap)) {
        if (name.toLowerCase().includes(pattern.toLowerCase())) {
          updates.push({ id: r.id, fields: { State: state } });
          console.log(`  Would set ${name} -> ${state}`);
          break;
        }
      }
    }
  });

  if (updates.length > 0) {
    console.log(`\nUpdating ${updates.length} regions with states...`);
    for (let i = 0; i < updates.length; i += 10) {
      await base('Regions').update(updates.slice(i, i + 10));
    }
    console.log('Done.');
  }

  // Now link orders to regions by matching venue name/address to region name
  console.log('\nLinking orders to regions by name matching...');
  const freshRegions = await getAllRecords('Regions');
  
  let orderUpdates = [];
  orders.forEach(o => {
    if (o.fields.Region && o.fields.Region.length > 0) return; // Already linked
    
    const venue = (o.fields.venue_name || '').toLowerCase();
    const addr = (o.fields.venue_address || '').toLowerCase();
    const combined = venue + ' ' + addr;
    
    // Try to match to a region
    for (const reg of freshRegions) {
      const regName = (reg.fields.Name || '').toLowerCase();
      if (combined.includes(regName) || regName.split(/\s+/).every(word => combined.includes(word))) {
        orderUpdates.push({ id: o.id, fields: { Region: [reg.id] } });
        break;
      }
    }
  });

  console.log(`Orders to link to regions: ${orderUpdates.length}`);
  if (orderUpdates.length > 0) {
    for (let i = 0; i < orderUpdates.length; i += 10) {
      await base('Orders').update(orderUpdates.slice(i, i + 10));
      process.stdout.write(`  ${Math.min(i + 10, orderUpdates.length)}/${orderUpdates.length}\r`);
    }
    console.log('');
  }

  console.log('✅ Regions fixed!');
}

main().catch(console.error);
