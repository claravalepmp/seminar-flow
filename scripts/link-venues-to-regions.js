#!/usr/bin/env node
/**
 * Link Venues to Regions based on state/city matching
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
  console.log('🔗 Linking Venues to Regions\\n');
  
  // Get Regions
  const regions = await getAllRecords('tbl6zAmQvRL32KNvP');
  console.log(`Found ${regions.length} regions`);
  
  // Build region lookup by state and name
  const regionByState = {};
  const regionByName = {};
  regions.forEach(r => {
    const state = (r.fields.State || '').toUpperCase().trim();
    const name = (r.fields.Name || '').toLowerCase().trim();
    if (state) {
      if (!regionByState[state]) regionByState[state] = [];
      regionByState[state].push(r);
    }
    regionByName[name] = r.id;
  });
  
  // State to region mapping
  const stateMapping = {
    'TX': 'dallas',
    'IL': ['rolling meadows', 'oak brook', 'southern illinois'],
    'MO': 'st. louis',
    'CT': 'connecticut',
    'MD': 'maryland',
    'PA': 'pennsylvania',
    'MI': 'michigan',
    'OH': 'ohio',
    'KS': 'kansas',
    'FL': 'florida',
    'CA': 'california',
    'TN': 'nashville',
    'AZ': 'arizona',
    'NJ': 'new jersey',
    'GA': 'georgia',
  };
  
  // Get Venues
  const venues = await getAllRecords('tblNKGn5jq1yJlo9X');
  console.log(`Found ${venues.length} venues`);
  
  const updates = [];
  const unmatched = [];
  
  for (const venue of venues) {
    if (venue.fields.Region?.length > 0) continue; // Already linked
    
    const state = (venue.fields.State || '').toUpperCase().trim();
    const city = (venue.fields.City || '').toLowerCase().trim();
    const address = (venue.fields.Address || '').toLowerCase();
    
    let regionId = null;
    
    // Try to match by state mapping
    if (state && stateMapping[state]) {
      const mapping = stateMapping[state];
      if (Array.isArray(mapping)) {
        // Multiple regions for this state - try to match by city
        if (city.includes('oak brook') || address.includes('oak brook')) {
          regionId = regionByName['oak brook'];
        } else if (city.includes('edwardsville') || city.includes('southern')) {
          regionId = regionByName['southern illinois'];
        } else {
          regionId = regionByName['rolling meadows'] || regionByName[mapping[0]];
        }
      } else {
        regionId = regionByName[mapping];
      }
    }
    
    // Fallback: try direct state match in regions
    if (!regionId && state && regionByState[state]?.length === 1) {
      regionId = regionByState[state][0].id;
    }
    
    if (regionId) {
      updates.push({
        id: venue.id,
        fields: { Region: [regionId] }
      });
    } else if (state) {
      unmatched.push({
        name: venue.fields.Name,
        state: state,
        city: city
      });
    }
  }
  
  console.log(`\\nMatched: ${updates.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  
  // Show sample of unmatched
  if (unmatched.length > 0) {
    console.log('\\nSample unmatched (first 10):');
    unmatched.slice(0, 10).forEach(u => console.log(`  ○ ${u.name} (${u.state}, ${u.city})`));
  }
  
  // Apply updates
  if (updates.length > 0) {
    console.log('\\nApplying updates...');
    const results = await updateRecords('tblNKGn5jq1yJlo9X', updates);
    console.log(`Updated ${results.length} venue records`);
  }
  
  console.log('\\n✅ Done');
}

main().catch(e => console.error('Error:', e.message));
