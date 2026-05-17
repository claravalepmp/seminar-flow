const AIRTABLE_PAT = process.env.AIRTABLE_PAT || 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function main() {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` }
  });
  const data = await res.json();
  const orders = data.tables.find(t => t.name === 'Orders');
  console.log('Orders table fields:');
  orders.fields.forEach(f => console.log(`  ${f.name} (${f.type})`));
}
main();
