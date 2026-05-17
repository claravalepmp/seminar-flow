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

// Office location mapping based on advisor/venue patterns
function getOfficeLocation(order) {
  const advisor = (order.fields.advisor || '').toLowerCase();
  const venue = (order.fields.venue_address || '').toLowerCase();
  const groupName = (order.fields.group_name || '').toLowerCase();
  
  // FTA offices
  if (groupName.includes('fta') || advisor.includes('fta')) {
    if (advisor.includes('chicago') || advisor.includes('rolling') || venue.includes(', il')) {
      if (venue.includes('oak brook') || venue.includes('lisle') || venue.includes('romeoville') || venue.includes('lockport')) {
        return 'Oak Brook';
      }
      if (venue.includes('edwardsville') || venue.includes('belleville') || advisor.includes('southern')) {
        return 'Southern Illinois';
      }
      return 'Rolling Meadows';
    }
    if (advisor.includes('stl') || advisor.includes('st. louis') || advisor.includes('st louis') || venue.includes(', mo')) {
      return 'St. Louis';
    }
    if (advisor.includes('tx') || advisor.includes('dallas') || venue.includes(', tx')) {
      return 'Dallas';
    }
    if (advisor.includes('nashville') || advisor.includes('nsv') || venue.includes(', tn')) {
      return 'Nashville';
    }
  }
  
  // SAM RIA offices
  if (groupName.includes('sam') || advisor.includes('warner')) {
    if (venue.includes(', md')) return 'Maryland';
    if (venue.includes(', ct')) return 'Connecticut';
    if (venue.includes(', pa')) return 'Pennsylvania';
  }
  
  // Extract state from address as fallback
  const stateMatch = venue.match(/,\s*([a-z]{2})\s*\d{5}/i) || venue.match(/,\s*([a-z]{2})\s*$/i);
  if (stateMatch) {
    const stateNames = {
      'il': 'Illinois', 'tx': 'Texas', 'mo': 'Missouri', 'tn': 'Tennessee',
      'ca': 'California', 'az': 'Arizona', 'md': 'Maryland', 'pa': 'Pennsylvania',
      'ct': 'Connecticut', 'fl': 'Florida', 'nc': 'North Carolina', 'co': 'Colorado',
      'ri': 'Rhode Island', 'oh': 'Ohio', 'mi': 'Michigan', 'nj': 'New Jersey',
      'ks': 'Kansas', 'sc': 'South Carolina', 'ma': 'Massachusetts'
    };
    return stateNames[stateMatch[1].toLowerCase()] || stateMatch[1].toUpperCase();
  }
  
  return '';
}

async function main() {
  console.log('Loading orders...');
  const orders = await getAllRecords('Orders');
  
  // Add office_location field to orders
  let updates = [];
  orders.forEach(o => {
    const office = getOfficeLocation(o);
    if (office && office !== o.fields.office_location) {
      updates.push({
        id: o.id,
        fields: { office_location: office }
      });
    }
  });

  console.log(`Orders to update with office_location: ${updates.length}`);
  
  // Show sample
  console.log('\nSample mappings:');
  updates.slice(0, 15).forEach(u => {
    const o = orders.find(ord => ord.id === u.id);
    console.log(`  #${o.fields.order_number} ${o.fields.advisor} -> ${u.fields.office_location}`);
  });

  if (updates.length > 0) {
    console.log('\nUpdating...');
    for (let i = 0; i < updates.length; i += 10) {
      await base('Orders').update(updates.slice(i, i + 10));
      process.stdout.write(`  ${Math.min(i + 10, updates.length)}/${updates.length}\r`);
    }
    console.log('\nDone');
  }
}

main().catch(console.error);
