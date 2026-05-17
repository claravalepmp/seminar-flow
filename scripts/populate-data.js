const AIRTABLE_PAT = 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

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
  const data = await res.json();
  if (data.error) console.error('API Error:', JSON.stringify(data.error));
  return data;
}

async function createRecords(tableName, records) {
  console.log(`Creating ${records.length} records in ${tableName}...`);
  const result = await api(`/${BASE_ID}/${encodeURIComponent(tableName)}`, 'POST', {
    records: records.map(fields => ({ fields }))
  });
  if (result.records) {
    console.log(`  Created ${result.records.length} records`);
    return result.records;
  }
  return [];
}

async function main() {
  // 1. Create Groups
  const groups = await createRecords('Groups', [
    { 
      Name: 'FTA (Financial & Tax Architects)', 
      Website: 'https://fta-ria.com/',
      'Registration Phone': '(469) 916-2591',
      'Registration URL': 'https://fta-ria.com/register',
      Responsibility: 'Cameron'
    },
    { 
      Name: 'Sentinel Asset Management (SAM RIA)', 
      Website: 'https://sentinelassetmanagementllc.com/',
      'Registration Phone': '(301) 973-6855',
      'Registration URL': 'https://sentinelassetmanagementllc.com/register',
      Responsibility: 'Cameron, Chad'
    },
    { 
      Name: 'Bone Asset Management', 
      Website: 'https://www.boneasset.com/',
      'Registration Phone': '(947) 218-2092',
      'Registration URL': 'https://www.boneasset.com/seminars',
      Responsibility: 'Chad'
    },
    { 
      Name: 'Eagle Financial Solutions', 
      Website: 'https://eaglefinancialsolutions.com/',
      'Registration Phone': '(380) 225-5814',
      Responsibility: 'Cameron'
    },
    { 
      Name: 'Scout Financial Group', 
      Website: 'https://www.scoutfinancialgroup.com/',
      'Registration Phone': '(913) 354-4222',
      Responsibility: 'Cameron'
    },
    { 
      Name: "The O'Toole Group", 
      Website: 'https://www.theotoolegroup.com/',
      'Registration Phone': '(800) 775-5778',
      Responsibility: 'Cameron'
    },
    { 
      Name: 'Advanced Wealth Management', 
      'Registration Phone': '(949) 785-5407',
      Responsibility: 'Cameron'
    },
    { 
      Name: 'Kelly Capital Partners', 
      'Registration Phone': '(248) 282-5632',
      Responsibility: 'Cameron'
    },
  ]);
  
  // Build group lookup
  const groupLookup = {};
  groups.forEach(g => groupLookup[g.fields.Name] = g.id);
  console.log('Group IDs:', Object.keys(groupLookup).length);
  
  // 2. Create Regions with Group links
  const regions = await createRecords('Regions', [
    { Name: 'Dallas / Plano', State: 'TX', 'Default Quantity': 8000, Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { Name: 'Rolling Meadows', State: 'IL', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { Name: 'Oak Brook', State: 'IL', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { Name: 'St. Louis', State: 'MO', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { Name: 'Southern Illinois', State: 'IL', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { Name: 'Nashville', State: 'TN', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { Name: 'Connecticut', State: 'CT', 'Default Quantity': 9000, Group: [groupLookup['Sentinel Asset Management (SAM RIA)']] },
    { Name: 'Maryland', State: 'MD', 'Default Quantity': 6000, Group: [groupLookup['Sentinel Asset Management (SAM RIA)']] },
    { Name: 'Pennsylvania', State: 'PA', Group: [groupLookup['Sentinel Asset Management (SAM RIA)']] },
    { Name: 'Michigan', State: 'MI', Group: [groupLookup['Bone Asset Management']] },
    { Name: 'Ohio', State: 'OH', Group: [groupLookup['Eagle Financial Solutions']] },
    { Name: 'Kansas', State: 'KS', Group: [groupLookup['Scout Financial Group']] },
    { Name: 'Florida', State: 'FL', Group: [groupLookup["The O'Toole Group"]] },
    { Name: 'California', State: 'CA', Group: [groupLookup['Advanced Wealth Management']] },
  ]);
  
  // Build region lookup
  const regionLookup = {};
  regions.forEach(r => regionLookup[r.fields.Name] = r.id);
  console.log('Region IDs:', Object.keys(regionLookup).length);
  
  // 3. Create Charities with Region links
  const charities = await createRecords('Charities', [
    { Name: 'North Texas Food Bank', 'Short Name': 'NTFB', Region: [regionLookup['Dallas / Plano']] },
    { Name: 'Township of Schaumburg', 'Short Name': 'TOS', Region: [regionLookup['Rolling Meadows']] },
    { Name: 'HCS Family Services', 'Short Name': 'HCS', Region: [regionLookup['Oak Brook']] },
    { Name: 'Crisis Nursery', 'Short Name': 'STL Crisis', Region: [regionLookup['St. Louis']] },
    { Name: 'Glen-Ed Pantry', 'Short Name': 'Glen ED', Region: [regionLookup['Southern Illinois']] },
    { Name: 'Second Harvest', 'Short Name': 'Second Harvest', Region: [regionLookup['Nashville']] },
  ]);
  
  console.log('\nData populated!');
  console.log('Groups:', groups.length);
  console.log('Regions:', regions.length);
  console.log('Charities:', charities.length);
}

main().catch(e => console.error('Error:', e.message));
