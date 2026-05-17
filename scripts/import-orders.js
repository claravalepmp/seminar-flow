const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

async function api(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, opts);
  return res.json();
}

async function main() {
  const data = JSON.parse(fs.readFileSync('data/normalized.json', 'utf8'));
  
  // Get existing lookups
  const regions = await api(`/${BASE_ID}/Regions?maxRecords=100`);
  const charities = await api(`/${BASE_ID}/Charities?maxRecords=100`);
  const advisors = await api(`/${BASE_ID}/Advisors?maxRecords=100`);
  
  const regionLookup = {};
  regions.records?.forEach(r => regionLookup[r.fields.Name] = r.id);
  
  const charityLookup = {};
  charities.records?.forEach(r => charityLookup[r.fields.Name] = r.id);
  
  const advisorLookup = {};
  advisors.records?.forEach(r => {
    if (r.fields.contact_name) advisorLookup[r.fields.contact_name] = r.id;
  });
  
  console.log('Lookups loaded:', Object.keys(regionLookup).length, 'regions,', Object.keys(charityLookup).length, 'charities,', Object.keys(advisorLookup).length, 'advisors');
  
  // Import all orders
  const allOrders = data.orders.map(o => {
    const fields = {
      order_number: parseInt(o.orderNumber) || undefined,
      status: o.status || undefined,
      group_name: o.group || undefined,
      office_location: o.office || undefined,
      class_type: o.classType || undefined,
      venue_name: o.venueName || undefined,
      venue_address: o.venueAddress || undefined,
      mailing_quantity: parseInt(o.mailingQuantity?.replace(/,/g, '')) || undefined,
      mailer_type: o.mailerType || undefined,
      start_time: o.startTime || undefined,
      end_time: o.endTime || undefined,
      event_notes: o.instructions || undefined,
      landing_page_url: o.landingPageUrl || undefined,
      first_event_room: o.firstEventRoom || undefined,
      second_event_room: o.secondEventRoom || undefined,
    };
    
    // Parse dates
    if (o.firstEventDate) {
      const d = new Date(o.firstEventDate);
      if (!isNaN(d.getTime())) fields.first_event_date = d.toISOString().split('T')[0];
    }
    if (o.secondEventDate) {
      const d = new Date(o.secondEventDate);
      if (!isNaN(d.getTime())) fields.second_event_date = d.toISOString().split('T')[0];
    }
    
    // Link to region
    if (o.office && regionLookup[o.office]) {
      fields.Region = [regionLookup[o.office]];
    }
    
    // Link to charity
    if (o.charity && charityLookup[o.charity]) {
      fields.Charity = [charityLookup[o.charity]];
    }
    
    // Link to advisor
    if (o.advisor && advisorLookup[o.advisor]) {
      fields.advisor = [advisorLookup[o.advisor]];
    }
    
    // Remove undefined
    Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k]);
    
    return fields;
  });
  
  console.log(`Importing ${allOrders.length} orders...`);
  
  let created = 0;
  for (let i = 0; i < allOrders.length; i += 10) {
    const batch = allOrders.slice(i, i + 10);
    const result = await api(`/${BASE_ID}/Orders`, 'POST', {
      records: batch.map(fields => ({ fields }))
    });
    if (result.records) {
      created += result.records.length;
      process.stdout.write(`\r  Created ${created}/${allOrders.length}`);
    } else if (result.error) {
      console.error('\nError:', result.error.message);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n\nDone! Created ${created} orders`);
}

main().catch(console.error);
