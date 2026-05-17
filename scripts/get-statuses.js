require('dotenv').config({ path: '.env.local' });
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');

const DIRECT_MAILING_SHEET_ID = '1TO7awD6tA2UdgWTl1cr5ec9C0nl56huBmFLL_mgateg';

async function main() {
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Get all status values from column A
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: DIRECT_MAILING_SHEET_ID,
    range: 'Main Orders - ONLY ONE USED!A:A',
  });
  
  const values = res.data.values || [];
  const statusCounts = {};
  
  for (let i = 1; i < values.length; i++) {
    const status = values[i]?.[0] || 'Empty';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  
  console.log('=== STATUS VALUES FROM DIRECT MAILING SHEET ===');
  console.log('Column A (Status column)\n');
  
  const sorted = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sorted) {
    console.log(`  ${count.toString().padStart(3)} x "${status}"`);
  }
  
  console.log('\n=== TOTAL ROWS ===');
  console.log(`  ${values.length - 1} orders`);
}

main().catch(console.error);
