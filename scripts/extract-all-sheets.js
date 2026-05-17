const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  // 1. CLIENT DICTIONARY - All client info
  console.log('=== FETCHING CLIENT DICTIONARY ===');
  const clientDict = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID_CLIENT_DICTIONARY,
    range: 'A1:Z100',
  });
  
  const clientHeaders = clientDict.data.values[0];
  const clientRows = clientDict.data.values.slice(1).filter(r => r[0]);
  
  console.log('Client Dictionary Headers:');
  clientHeaders.forEach((h, i) => console.log(`  ${i}: ${h}`));
  console.log(`\nTotal clients: ${clientRows.length}`);
  
  // Save client data
  const clients = clientRows.map(row => {
    const obj = {};
    clientHeaders.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
  
  require('fs').writeFileSync('data/clients-raw.json', JSON.stringify(clients, null, 2));
  console.log('Saved to data/clients-raw.json');
  
  // 2. MAIN ORDER SHEET - All orders
  console.log('\n=== FETCHING MAIN ORDER SHEET ===');
  const mainOrders = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID_MAIN_ORDER,
    range: 'A1:AZ1000',
  });
  
  const orderHeaders = mainOrders.data.values[0];
  const orderRows = mainOrders.data.values.slice(1).filter(r => r[1]); // Filter by Order Number
  
  console.log('Main Order Headers:');
  orderHeaders.forEach((h, i) => console.log(`  ${i}: ${h}`));
  console.log(`\nTotal orders: ${orderRows.length}`);
  
  const orders = orderRows.map(row => {
    const obj = {};
    orderHeaders.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
  
  require('fs').writeFileSync('data/orders-raw.json', JSON.stringify(orders, null, 2));
  console.log('Saved to data/orders-raw.json');
  
  // 3. DIRECT MAILING SHEET
  console.log('\n=== FETCHING DIRECT MAILING SHEET ===');
  const directMail = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID_DIRECT_MAILING,
    range: 'A1:AZ500',
  });
  
  const dmHeaders = directMail.data.values[0];
  const dmRows = directMail.data.values.slice(1).filter(r => r[0]);
  
  console.log('Direct Mailing Headers:');
  dmHeaders.forEach((h, i) => console.log(`  ${i}: ${h}`));
  console.log(`\nTotal DM entries: ${dmRows.length}`);
  
  const dmOrders = dmRows.map(row => {
    const obj = {};
    dmHeaders.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
  
  require('fs').writeFileSync('data/direct-mail-raw.json', JSON.stringify(dmOrders, null, 2));
  console.log('Saved to data/direct-mail-raw.json');
  
  // 4. Analyze unique values for relations
  console.log('\n=== ANALYZING DATA FOR RELATIONS ===');
  
  // Unique groups
  const groups = [...new Set(orders.map(o => o['Group Name']).filter(Boolean))];
  console.log('\nGroups:', groups);
  
  // Unique advisors with their groups
  const advisorMap = {};
  orders.forEach(o => {
    const advisor = o['Advisor Name'];
    const group = o['Group Name'];
    if (advisor && !advisorMap[advisor]) {
      advisorMap[advisor] = { name: advisor, group, offices: new Set() };
    }
    if (advisor && o['Office Location']) {
      advisorMap[advisor].offices.add(o['Office Location']);
    }
  });
  console.log('\nAdvisors:', Object.keys(advisorMap).length);
  
  // Unique charities
  const charities = [...new Set(orders.map(o => o['Charity']).filter(Boolean))];
  console.log('\nCharities:', charities);
  
  // Unique class types
  const classTypes = [...new Set(orders.map(o => o['Class Type']).filter(Boolean))];
  console.log('\nClass Types:', classTypes);
  
  // Unique statuses
  const statuses = [...new Set(orders.map(o => o['Status']).filter(Boolean))];
  console.log('\nStatuses:', statuses);
  
  // Save analysis
  const analysis = {
    groups,
    advisors: Object.values(advisorMap).map(a => ({
      name: a.name,
      group: a.group,
      offices: [...a.offices]
    })),
    charities,
    classTypes,
    statuses,
    orderCount: orders.length,
    clientCount: clients.length
  };
  
  require('fs').writeFileSync('data/analysis.json', JSON.stringify(analysis, null, 2));
  console.log('\nSaved analysis to data/analysis.json');
}

main().catch(console.error);
