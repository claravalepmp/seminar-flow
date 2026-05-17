const AIRTABLE_PAT = 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

const TABLE_IDS = {
  Advisors: 'tbl50DjrGA07TaUzh',
  Orders: 'tblXNAKyqUgfIMRO9',
  Groups: 'tblYbSZsqlyB8yWMs',
  Regions: 'tbl6zAmQvRL32KNvP',
  Charities: 'tbllO26JAPm3LXzbe',
};

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
  if (data.error) {
    console.error('API Error:', data.error);
    return null;
  }
  return data;
}

async function addField(tableId, fieldDef) {
  console.log(`Adding field ${fieldDef.name} to ${tableId}...`);
  const result = await api(`/meta/bases/${BASE_ID}/tables/${tableId}/fields`, 'POST', fieldDef);
  if (result) console.log(`  Created: ${result.id}`);
  return result;
}

async function main() {
  // Add Group link to Regions
  await addField(TABLE_IDS.Regions, {
    name: 'Group',
    type: 'multipleRecordLinks',
    options: { linkedTableId: TABLE_IDS.Groups }
  });
  
  // Add Region link to Charities
  await addField(TABLE_IDS.Charities, {
    name: 'Region',
    type: 'multipleRecordLinks',
    options: { linkedTableId: TABLE_IDS.Regions }
  });
  
  // Add Group link to Advisors
  await addField(TABLE_IDS.Advisors, {
    name: 'Group',
    type: 'multipleRecordLinks',
    options: { linkedTableId: TABLE_IDS.Groups }
  });
  
  // Add Region link to Orders
  await addField(TABLE_IDS.Orders, {
    name: 'Region',
    type: 'multipleRecordLinks',
    options: { linkedTableId: TABLE_IDS.Regions }
  });
  
  // Add Charity link to Orders
  await addField(TABLE_IDS.Orders, {
    name: 'Charity',
    type: 'multipleRecordLinks',
    options: { linkedTableId: TABLE_IDS.Charities }
  });
  
  console.log('\nRelationships created!');
}

main().catch(e => console.error('Error:', e.message));
