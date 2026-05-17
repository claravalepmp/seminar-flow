const AIRTABLE_PAT = 'pataw2JcEpZW4HmtX.45f15c063dca3972d4cd02218b89aa5bb30236204f952a381303b6bdec70a747';
const BASE_ID = 'appeEmOJVXDJ0WPF4';

async function api(endpoint) {
  const res = await fetch(`https://api.airtable.com/v0${endpoint}`, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` },
  });
  return res.json();
}

async function main() {
  const schema = await api(`/meta/bases/${BASE_ID}/tables`);
  const advisors = schema.tables.find(t => t.name === 'Advisors');
  console.log('Advisors table fields:');
  advisors.fields.forEach(f => console.log(`  ${f.name} (${f.type})`));
}

main().catch(console.error);
