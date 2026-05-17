import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function getSheetData(spreadsheetId: string): Promise<string[][]> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A:ZZ' });
  return res.data.values || [];
}

async function main() {
  console.log('=== STUDYING GOOGLE SHEETS ===\n');
  
  // Direct Mail Sheet
  console.log('--- DIRECT MAIL SHEET ---');
  const dmRows = await getSheetData(process.env.SHEET_ID_DIRECT_MAILING!);
  const dmHeaders = dmRows[0];
  console.log('\nAll columns:');
  dmHeaders.forEach((h, i) => console.log(`  ${i}: ${h}`));
  
  // Find status column (usually first one or named "status")
  const statusIdx = dmHeaders.findIndex(h => h.toLowerCase() === 'status') || 0;
  console.log(`\nStatus column index: ${statusIdx} (${dmHeaders[statusIdx]})`);
  
  // Get all unique statuses
  const statuses = new Set<string>();
  dmRows.slice(1).forEach(row => {
    const status = row[statusIdx] || row[0];
    if (status) statuses.add(status);
  });
  console.log('\nAll statuses found:');
  Array.from(statuses).sort().forEach(s => console.log(`  - ${s}`));
  
  // Sample row
  console.log('\nSample row (first data row):');
  const sampleRow = dmRows[1];
  dmHeaders.forEach((h, i) => {
    if (sampleRow[i]) console.log(`  ${h}: ${sampleRow[i]}`);
  });
  
  // Find date-related columns
  console.log('\n\nDate-related columns:');
  dmHeaders.forEach((h, i) => {
    if (h.toLowerCase().includes('date') || h.toLowerCase().includes('deadline') || h.toLowerCase().includes('sent')) {
      console.log(`  ${i}: ${h}`);
      // Sample values
      const vals = dmRows.slice(1, 6).map(r => r[i]).filter(Boolean);
      if (vals.length) console.log(`     Sample: ${vals.join(', ')}`);
    }
  });
  
  // Digital Sheet
  console.log('\n\n--- DIGITAL JOBS SHEET ---');
  const digRows = await getSheetData(process.env.SHEET_ID_DIGITAL_JOBS!);
  const digHeaders = digRows[0];
  console.log('\nAll columns:');
  digHeaders.forEach((h, i) => console.log(`  ${i}: ${h}`));
  
  // Status
  const digStatusIdx = digHeaders.findIndex(h => h.toLowerCase() === 'status');
  console.log(`\nStatus column index: ${digStatusIdx}`);
  
  const digStatuses = new Set<string>();
  digRows.slice(1).forEach(row => {
    const status = row[digStatusIdx];
    if (status) digStatuses.add(status);
  });
  console.log('\nAll statuses found:');
  Array.from(digStatuses).sort().forEach(s => console.log(`  - ${s}`));
  
  // Main Order Sheet - for send deadlines
  console.log('\n\n--- MAIN ORDER SHEET (for deadlines) ---');
  const mainRows = await getSheetData(process.env.SHEET_ID_MAIN_ORDER!);
  const mainHeaders = mainRows[0];
  
  console.log('\nDeadline columns:');
  mainHeaders.forEach((h, i) => {
    if (h.toLowerCase().includes('deadline') || h.toLowerCase().includes('approval') || h.toLowerCase().includes('sent')) {
      console.log(`  ${i}: ${h}`);
      const vals = mainRows.slice(1, 4).map(r => r[i]).filter(Boolean);
      if (vals.length) console.log(`     Sample: ${vals.join(', ')}`);
    }
  });
}

main().catch(console.error);
