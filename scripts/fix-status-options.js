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
  // Get Orders table schema
  const schema = await api(`/meta/bases/${BASE_ID}/tables`);
  const ordersTable = schema.tables.find(t => t.name === 'Orders');
  const statusField = ordersTable.fields.find(f => f.name === 'status');
  
  console.log('Current status field:', statusField);
  
  // Update status field with new options
  const result = await api(`/meta/bases/${BASE_ID}/tables/${ordersTable.id}/fields/${statusField.id}`, 'PATCH', {
    options: {
      choices: [
        { name: 'Order Sent' },
        { name: 'All Details Added' },
        { name: 'Proof Sent to Client' },
        { name: 'Issues' },
        { name: 'Pending' },
        { name: 'In Design' },
        { name: 'Needs Approval' },
        { name: 'Approved' },
        { name: 'Complete' },
      ]
    }
  });
  
  console.log('Updated:', result);
  
  // Also update class_type options
  const classTypeField = ordersTable.fields.find(f => f.name === 'class_type');
  if (classTypeField) {
    const classResult = await api(`/meta/bases/${BASE_ID}/tables/${ordersTable.id}/fields/${classTypeField.id}`, 'PATCH', {
      options: {
        choices: [
          { name: 'R90' },
          { name: 'R101' },
          { name: 'SS101' },
          { name: 'W101' },
          { name: 'T101' },
          { name: 'Taxes' },
          { name: 'Taxes in Retirement' },
          { name: 'Legacy Planning for your Retirement' },
          { name: 'Wealth 101' },
        ]
      }
    });
    console.log('Updated class_type:', classResult.name || classResult.error);
  }
}

main().catch(console.error);
