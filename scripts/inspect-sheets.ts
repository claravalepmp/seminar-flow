import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  return new google.auth.JWT({ email, key, scopes: SCOPES });
}

async function getSheetData(spreadsheetId: string, range: string = 'A:ZZ') {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return response.data.values || [];
}

async function inspectSheets() {
  console.log('=== GOOGLE SHEETS INSPECTION ===\n');
  
  const sheetConfigs = [
    { name: 'Main Orders', id: process.env.SHEET_ID_MAIN_ORDER },
    { name: 'Direct Mailing', id: process.env.SHEET_ID_DIRECT_MAILING },
    { name: 'Digital Jobs', id: process.env.SHEET_ID_DIGITAL_JOBS },
    { name: 'Client Dictionary', id: process.env.SHEET_ID_CLIENT_DICTIONARY },
  ];
  
  for (const sheet of sheetConfigs) {
    if (!sheet.id) {
      console.log(`✗ ${sheet.name}: No sheet ID configured\n`);
      continue;
    }
    
    try {
      const rows = await getSheetData(sheet.id);
      console.log(`✓ ${sheet.name} (${rows.length - 1} data rows)`);
      
      if (rows.length > 0) {
        const headers = rows[0];
        console.log(`  Columns (${headers.length}):`, headers.slice(0, 15).join(', '), headers.length > 15 ? '...' : '');
        
        // Show sample data
        if (rows.length > 1) {
          console.log('\n  Sample Row 1:');
          const sample = rows[1];
          headers.slice(0, 10).forEach((h: string, i: number) => {
            if (sample[i]) console.log(`    ${h}: ${sample[i]?.substring?.(0, 60) || sample[i]}`);
          });
        }
        
        // Count non-empty rows
        const nonEmpty = rows.slice(1).filter((r: string[]) => r.some(c => c?.trim()));
        console.log(`\n  Non-empty rows: ${nonEmpty.length}`);
        
        // Find unique values in key columns
        const statusCol = headers.findIndex((h: string) => h.toLowerCase().includes('status'));
        if (statusCol >= 0) {
          const statuses = [...new Set(rows.slice(1).map((r: string[]) => r[statusCol]).filter(Boolean))];
          console.log(`  Statuses: ${statuses.join(', ')}`);
        }
        
        const advisorCol = headers.findIndex((h: string) => h.toLowerCase().includes('advisor'));
        if (advisorCol >= 0) {
          const advisors = [...new Set(rows.slice(1).map((r: string[]) => r[advisorCol]).filter(Boolean))];
          console.log(`  Unique Advisors: ${advisors.length}`);
          console.log(`    Names: ${advisors.slice(0, 10).join(', ')}${advisors.length > 10 ? '...' : ''}`);
        }
      }
      console.log('\n' + '='.repeat(60) + '\n');
    } catch (e: any) {
      console.log(`✗ ${sheet.name}: ${e.message}\n`);
    }
  }
}

inspectSheets().catch(console.error);
