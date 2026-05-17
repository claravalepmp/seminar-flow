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
  return res.json();
}

async function main() {
  // Get groups for linking
  const groupsRes = await api(`/${BASE_ID}/Groups`);
  const groupLookup = {};
  groupsRes.records.forEach(r => groupLookup[r.fields.Name] = r.id);
  console.log('Groups loaded:', Object.keys(groupLookup).length);

  // Create real advisors (using correct field names: contact_name, company_name, email, phone)
  const advisors = [
    // FTA
    { contact_name: 'FTA Dallas', email: 'dallas@ftadvisors.com', phone: '(469) 916-2591', company_name: 'Financial & Tax Architects', territory: 'Dallas', status: 'active', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { contact_name: 'FTA Chicago - Rolling Meadows', email: 'chicago.rm@ftadvisors.com', phone: '(847) 994-3538', company_name: 'Financial & Tax Architects', territory: 'Rolling Meadows', status: 'active', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { contact_name: 'FTA Chicago - Oak Brook', email: 'chicago.ob@ftadvisors.com', phone: '(630) 556-8872', company_name: 'Financial & Tax Architects', territory: 'Oak Brook', status: 'active', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { contact_name: 'FTA St. Louis', email: 'stlouis@ftadvisors.com', phone: '(314) 579-3655', company_name: 'Financial & Tax Architects', territory: 'St. Louis', status: 'active', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { contact_name: 'FTA Southern Illinois', email: 'southernIL@ftadvisors.com', phone: '(618) 702-4274', company_name: 'Financial & Tax Architects', territory: 'Southern Illinois', status: 'active', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    { contact_name: 'FTA Nashville', email: 'nashville@ftadvisors.com', phone: '(629) 247-4404', company_name: 'Financial & Tax Architects', territory: 'Nashville', status: 'active', Group: [groupLookup['FTA (Financial & Tax Architects)']] },
    // SAM RIA
    { contact_name: 'Will Warner', email: 'will@samria.com', phone: '(301) 973-6855', company_name: 'Sentinel Asset Management', territory: 'CT/MD/PA', status: 'active', Group: [groupLookup['Sentinel Asset Management (SAM RIA)']] },
    // Bone Asset
    { contact_name: 'Rick Bone', email: 'rick@boneasset.com', phone: '(947) 218-2092', company_name: 'Bone Asset Management', territory: 'Michigan', status: 'active', Group: [groupLookup['Bone Asset Management']] },
    // Eagle
    { contact_name: 'Alex Huey', email: 'alex@eaglefinancial.com', phone: '(380) 225-5814', company_name: 'Eagle Financial Solutions', territory: 'Ohio', status: 'active', Group: [groupLookup['Eagle Financial Solutions']] },
    // Scout
    { contact_name: 'Jason Smitka', email: 'jason@scoutfinancial.com', phone: '(913) 354-4222', company_name: 'Scout Financial Group', territory: 'Kansas', status: 'active', Group: [groupLookup['Scout Financial Group']] },
    // O'Toole
    { contact_name: "Sean O'Toole", email: 'sean@otoolegroup.com', phone: '(800) 775-5778', company_name: "The O'Toole Group", territory: 'Florida', status: 'active', Group: [groupLookup["The O'Toole Group"]] },
    // Advanced Wealth
    { contact_name: 'Catherine Loquet', email: 'catherine@advancedwealth.com', phone: '(949) 785-5407', company_name: 'Advanced Wealth Management', territory: 'California', status: 'active', Group: [groupLookup['Advanced Wealth Management']] },
    // Kelly
    { contact_name: 'Janie Kelly', email: 'janie@kellycapital.com', phone: '(248) 282-5632', company_name: 'Kelly Capital Partners', territory: 'Michigan', status: 'active', Group: [groupLookup['Kelly Capital Partners']] },
  ];

  console.log('Creating', advisors.length, 'advisors...');
  const result = await api(`/${BASE_ID}/Advisors`, 'POST', {
    records: advisors.map(fields => ({ fields }))
  });
  
  if (result.error) {
    console.error('Error:', JSON.stringify(result.error, null, 2));
  } else {
    console.log('Created:', result.records?.length || 0, 'advisors');
  }
}

main().catch(e => console.error('Error:', e.message));
