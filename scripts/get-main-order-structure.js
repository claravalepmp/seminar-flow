require('dotenv').config({ path: '.env.local' });
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');

const MAIN_ORDER_SHEET_ID = '1psPEGyNVpbQiWWtZgpMLU2GhE2AngjnEfBbrwV3ruWs';

async function main() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Get sheet names
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: MAIN_ORDER_SHEET_ID,
  });
  
  console.log('=== MAIN ORDER SHEET ===');
  console.log('Sheets:');
  for (const sheet of metadata.data.sheets) {
    console.log(`  - ${sheet.properties.title}`);
  }
  
  // Get headers from Direct Mail - Cam sheet
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: MAIN_ORDER_SHEET_ID,
    range: 'Direct Mail - Cam!A1:Z1',
  });
  
  console.log('\n=== COLUMNS IN "Direct Mail - Cam" ===');
  const headers = res.data.values?.[0] || [];
  headers.forEach((h, i) => {
    const col = String.fromCharCode(65 + i);
    console.log(`  ${col}. ${h || '(empty)'}`);
  });
  
  // Get sample data
  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: MAIN_ORDER_SHEET_ID,
    range: 'Direct Mail - Cam!A2:Z6',
  });
  
  console.log('\n=== SAMPLE DATA (5 rows) ===');
  const rows = dataRes.data.values || [];
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    console.log(`\nRow ${i + 1}:`);
    rows[i].forEach((val, j) => {
      if (val && headers[j]) {
        console.log(`  ${headers[j]}: ${val}`);
      }
    });
  }
}

main().catch(console.error);
