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
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data;
}

async function main() {
  // Get current schema
  console.log('Getting current schema...');
  const schema = await api(`/meta/bases/${BASE_ID}/tables`);
  console.log('Current tables:', schema.tables?.map(t => t.name).join(', '));
  
  // Check which tables exist
  const tableNames = schema.tables?.map(t => t.name) || [];
  
  // Create Groups table if missing
  if (!tableNames.includes('Groups')) {
    console.log('\nCreating Groups table...');
    const result = await api(`/meta/bases/${BASE_ID}/tables`, 'POST', {
      name: 'Groups',
      description: 'Advisor groups (FTA, SAM RIA, etc.)',
      fields: [
        { name: 'Name', type: 'singleLineText' },
        { name: 'Website', type: 'url' },
        { name: 'Registration Phone', type: 'phoneNumber' },
        { name: 'Registration URL', type: 'url' },
        { name: 'Address', type: 'multilineText' },
        { name: 'Responsibility', type: 'singleLineText' },
      ]
    });
    console.log('Created Groups table:', result.id);
  }
  
  // Create Regions table
  if (!tableNames.includes('Regions')) {
    console.log('\nCreating Regions table...');
    const result = await api(`/meta/bases/${BASE_ID}/tables`, 'POST', {
      name: 'Regions',
      description: 'Geographic regions/offices',
      fields: [
        { name: 'Name', type: 'singleLineText' },
        { name: 'State', type: 'singleLineText' },
        { name: 'Default Quantity', type: 'number', options: { precision: 0 } },
      ]
    });
    console.log('Created Regions table:', result.id);
  }
  
  // Create Charities table
  if (!tableNames.includes('Charities')) {
    console.log('\nCreating Charities table...');
    const result = await api(`/meta/bases/${BASE_ID}/tables`, 'POST', {
      name: 'Charities',
      description: 'Non-profits for mailers',
      fields: [
        { name: 'Name', type: 'singleLineText' },
        { name: 'Short Name', type: 'singleLineText' },
      ]
    });
    console.log('Created Charities table:', result.id);
  }
  
  console.log('\nDone setting up base tables!');
  
  // Get updated schema
  const updated = await api(`/meta/bases/${BASE_ID}/tables`);
  console.log('\nUpdated tables:', updated.tables?.map(t => `${t.name} (${t.id})`).join(', '));
}

main().catch(e => console.error('Error:', e.message));
