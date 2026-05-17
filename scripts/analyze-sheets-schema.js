require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SHEETS = {
  MAIN_ORDER: process.env.SHEET_ID_MAIN_ORDER,
  CLIENT_DICTIONARY: process.env.SHEET_ID_CLIENT_DICTIONARY,
  CREATIVE_DICTIONARY: process.env.SHEET_ID_CREATIVE_DICTIONARY,
  DIGITAL_JOBS: process.env.SHEET_ID_DIGITAL_JOBS,
  DIRECT_MAILING: process.env.SHEET_ID_DIRECT_MAILING,
  INVOICE: process.env.SHEET_ID_INVOICE
};

async function analyze() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  for (const [name, id] of Object.entries(SHEETS)) {
    if (!id) continue;
    console.log(`\n=== ${name} ===`);
    console.log(`Sheet ID: ${id}`);
    
    try {
      // Get sheet metadata
      const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
      const sheetNames = meta.data.sheets.map(s => s.properties.title);
      console.log(`Tabs: ${sheetNames.join(', ')}`);
      
      // Get first sheet headers + sample
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: `${sheetNames[0]}!1:5`
      });
      
      if (resp.data.values) {
        console.log(`Headers (${resp.data.values[0]?.length || 0} cols):`);
        resp.data.values[0]?.forEach((h, i) => console.log(`  ${i}: ${h}`));
        console.log(`Sample rows: ${resp.data.values.length - 1}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

analyze();
