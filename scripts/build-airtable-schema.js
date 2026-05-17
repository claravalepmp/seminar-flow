const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

// Load extracted data
const clients = JSON.parse(fs.readFileSync('data/clients-raw.json', 'utf8'));
const orders = JSON.parse(fs.readFileSync('data/orders-raw.json', 'utf8'));
const analysis = JSON.parse(fs.readFileSync('data/analysis.json', 'utf8'));

// Normalize group names (merge duplicates)
const GROUP_NORMALIZE = {
  'FTA': 'FTA',
  'FTA TX': 'FTA',
  'SAM RIA': 'SAM RIA',
  'SAM-RIA': 'SAM RIA',
  'Sentinel Asset Management (SAM RIA)': 'SAM RIA',
  'Bone Asset': 'Bone Asset Management',
  'Bone Asset Management ': 'Bone Asset Management',
  'Scout Financial': 'Scout Financial Group',
  'Scout Financial Group': 'Scout Financial Group',
  'The Otoole Group': "The O'Toole Group",
  "The O'Toole Group": "The O'Toole Group",
};

function normalizeGroup(name) {
  return GROUP_NORMALIZE[name] || name;
}

// Normalize charity names
const CHARITY_NORMALIZE = {
  'STL crisis': 'Crisis Nursery',
  'Crisis Nursery': 'Crisis Nursery',
  'TOS': 'Township of Schaumburg',
  'Township of Schaumburg': 'Township of Schaumburg',
  'Glen ED': 'Glen-Ed Pantry',
  'Glen-Ed Pantry': 'Glen-Ed Pantry',
  'HCS': 'HCS Family Services',
  'HCS Family Services': 'HCS Family Services',
};

function normalizeCharity(name) {
  return CHARITY_NORMALIZE[name] || name;
}

// Build normalized data structures
console.log('=== BUILDING NORMALIZED DATA ===\n');

// 1. GROUPS - from client dictionary
const groupsMap = {};
clients.forEach(c => {
  const groupName = normalizeGroup(c['FMO/Group Name (Optional)'] || c['Advisor Name']);
  if (!groupName) return;
  
  if (!groupsMap[groupName]) {
    groupsMap[groupName] = {
      name: groupName,
      website: c['Business Website'] || '',
      registrationPhone: c['Registration Phone number'] || '',
      registrationUrl: c['Website Registration (Direct)'] || '',
      returnAddress: c['Mailer Return Address'] || '',
      responsibility: c['Responsibility'] || '',
      description: c['Description of Client'] || '',
      notes: c['Client Notes to Lookout for'] || '',
      advisors: [],
    };
  }
  
  // Add advisor to group
  if (c['Advisor Name']) {
    groupsMap[groupName].advisors.push({
      name: c['Advisor Name'],
      contactName: c['Main Contact Name'] || '',
      contactEmail: c['Main Contact Email'] || '',
      contactPhone: c['Main Contact Phone'] || '',
      businessName: c['Business Name'] || '',
      businessAddress: `${c['Business Address'] || ''}, ${c['Business City'] || ''}, ${c['Business State'] || ''}`.trim(),
    });
  }
});

console.log('Groups:', Object.keys(groupsMap).length);
Object.keys(groupsMap).forEach(g => {
  console.log(`  - ${g} (${groupsMap[g].advisors.length} advisors)`);
});

// 2. OFFICES/REGIONS - from orders
const officesMap = {};
orders.forEach(o => {
  const office = o['Office Location'];
  const group = normalizeGroup(o['Group Name']);
  if (!office || !group) return;
  
  const key = `${group}::${office}`;
  if (!officesMap[key]) {
    officesMap[key] = {
      name: office,
      group: group,
      orderCount: 0,
    };
  }
  officesMap[key].orderCount++;
});

console.log('\nOffices/Regions:', Object.keys(officesMap).length);

// 3. CHARITIES - from orders with region mapping
const charitiesMap = {};
orders.forEach(o => {
  const charity = normalizeCharity(o['Charity']);
  const office = o['Office Location'];
  if (!charity) return;
  
  if (!charitiesMap[charity]) {
    charitiesMap[charity] = {
      name: charity,
      offices: new Set(),
    };
  }
  if (office) charitiesMap[charity].offices.add(office);
});

console.log('\nCharities:', Object.keys(charitiesMap).length);
Object.keys(charitiesMap).forEach(c => {
  console.log(`  - ${c} (offices: ${[...charitiesMap[c].offices].join(', ')})`);
});

// 4. ORDERS - full order data
console.log('\nOrders:', orders.length);

// Save normalized data
const normalizedData = {
  groups: Object.values(groupsMap),
  offices: Object.values(officesMap),
  charities: Object.keys(charitiesMap).map(c => ({
    name: c,
    offices: [...charitiesMap[c].offices],
  })),
  orders: orders.map(o => ({
    orderNumber: o['Order Number'],
    status: o['Status'],
    advisor: o['Advisor Name'],
    group: normalizeGroup(o['Group Name']),
    office: o['Office Location'],
    charity: normalizeCharity(o['Charity']),
    classType: o['Class Type'],
    venueName: o['Venue Name & Room (if not different)'],
    venueAddress: o['Venue Address'],
    firstEventDate: o['First Event date'],
    firstEventRoom: o['First Event Room'],
    secondEventDate: o['Second Event Date'],
    secondEventRoom: o['Second Event Room'],
    mailingQuantity: o['Mailing Quantity'],
    mailerType: o['Mailer Type'],
    startTime: o['Start Time'],
    endTime: o['End Time'],
    registrationPhone: o['Registration Phone Number'],
    landingPageUrl: o['Landing Page URL (Direct)'],
    orderFolder: o['Order Google Folder (Sending List)'],
    clientApprovalDeadline: o['Client Approval Deadline'],
    orderSentDeadline: o['Order Sent Deadline'],
    firstClassDay: o['First Class Day'],
    instructions: o['Order Instructions (Always Double Click to see all Notes even if empty)'],
  })),
};

fs.writeFileSync('data/normalized.json', JSON.stringify(normalizedData, null, 2));
console.log('\nSaved normalized data to data/normalized.json');

// Print summary
console.log('\n=== SUMMARY ===');
console.log(`Groups: ${normalizedData.groups.length}`);
console.log(`Offices: ${normalizedData.offices.length}`);
console.log(`Charities: ${normalizedData.charities.length}`);
console.log(`Orders: ${normalizedData.orders.length}`);
