#!/usr/bin/env node
/**
 * Analyze Direct Mailing Google Sheet structure
 */

const { google } = require('googleapis');

const SHEET_ID = '1TO7awD6tA2UdgWTl1cr5ec9C0nl56huBmFLL_mgateg';
const SERVICE_ACCOUNT_EMAIL = 'clara-936@power-mailers-pl-1717002072449.iam.gserviceaccount.com';
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCTIh0raLB+QBVP
Yy4V4e20JPYX0pEJNlSMgFGMsK+rNQUhBhPQvupTlTEagER8x1rrW8xoBmyfF7Vk
J7uk0dvr7th6OtCnB5ts0BSJRi/BfTdhr61D9Ev1HerDWbhh0i5B6ccDXBJAemgR
v7zoYbOhxOpWBtud+7RcVsln57IOz4OLYL/2G09vChsELTpAnJdnxmKFL8mV6QcC
JIhJDvrNUwe5CkRThTZibaNyUiltyAXyWzYgM8cuVqRqXEjVPHqGNJt2cTf/CIKY
d+vADhEndNdb9n0ia38v4pZPVBJqcjBkiyhYT3SusURF0mG9u40LZ14ykKZZxFA0
Qd7Z2eMtAgMBAAECggEAFr7h2ombK1FV2gl/oONl/4DtSH6FbHKpPHVD5ieUaLfQ
HKxXWOCC0jwQtMOakt2w2Qy+e2Bu32NnZ93anN7SjFVGwxKfmgrLhNVgL16Z2GQ2
sRPbCdPVAEZJOjz/C6RWAVuWKBdOPQiPWRsWpaghAIO0JGt3/SLh3ZqPFVCUzsQa
1Kg91r8hxUJNg7fqrPVXPk6I1AxdNtjlCNJE/XGscBXeXzZi+Xv20w0EuiDpTyw9
f5z0TDrQwSwi8GocGs1yPa4deN5ffYRdXWZcbHhjcDNNBzCkoQK0lPybqaO2bNTa
OQXYaa35c/fp2VpJq+D+LH2lG9i4eLmgXnW3BrYZ0wKBgQDCpqPZvBh6s3xc+SnP
p5Qv4Tiy1W9UdxodQLMVVK7VeIPheqGJjYTMwJKJHk5ai6oNQSxo2yuz8QdTDZeo
aEcODkRc0DXV5kAlpBeBfvtMVwnZO1qt/4HteSKw8TwDhpgFN0HA9ss9llfSbbSo
7ExkiLtqJUh3kNdrl5z9+9nUFwKBgQDBgYW29q+ZQVG2QpDxkYpgYjyZRZ9Zoue6
oDiWunH2akqovKccYs1TfBWnXnJrUEu235aUInmduDb+rCU5hmbpoQcFDU2N43iv
LoZLvCt4Zvt3wPqEY/sgv+eDEeCEn7kxYh6tf4zNimYO02zsTAD6G05VeMmvONvi
rT4qWPzZWwKBgQCRLBNb2qsvKBoChVono0YkB4dv6Tsk9ccmNhDaQdQ7JazGR92e
Z0u6IY2ock/hu/RR+l+SvJN1mrfpu2N2mH8V/pIB3s+n/hetexqE3B20K94Og/P3
fW57nDLBYMlvn7xVd4a00dt2zWAmcuegbMv01v1gBvprIj1n4yWVT3aAdQKBgDJ3
WSwygfFyO6FREwQtdO1WMX+3zKtP9SeTCa8lyPr/FaGUMfERQ4N2ZR9VXnnmYxi6
j0brBtS/anhY5QxvpP9hY7dJlORgYuUtOREfbibklMjSp4NHoAMWiYaBbxCnp2Dd
uip9jXc9lQhg05N87vRLks5vxgnQxmgDzqa0tpzpAoGBALTyjfvs6kI3QCNRjPMU
rTsk0nEmTbU7uKFzhy1AY8GQCXVKHgQztuWwrNh+X0PX8wT0mNjZIzj6Zg/RNJMd
sSPYq0pl3ghmgtEwOVntj+lwo+CoGVuB0dsvCu6k14WlRS9C1xZ5jUGnUDbvDKUU
XnN6tSL9KBDobydLXNjq3RgL
-----END PRIVATE KEY-----
`;

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: SERVICE_ACCOUNT_EMAIL,
      private_key: PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  console.log('=== DIRECT MAILING SHEET ANALYSIS ===\n');
  
  // Get sheet metadata
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  console.log('Sheets in workbook:');
  for (const sheet of metadata.data.sheets) {
    console.log(`  - ${sheet.properties.title}`);
  }
  
  // Get first sheet data
  const firstSheet = metadata.data.sheets[0].properties.title;
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${firstSheet}'!A1:ZZ500`,
  });
  
  const rows = data.data.values || [];
  if (rows.length === 0) {
    console.log('No data found');
    return;
  }
  
  const headers = rows[0];
  console.log(`\n=== COLUMNS (${headers.length} total) ===`);
  headers.forEach((h, i) => {
    const colLetter = String.fromCharCode(65 + (i % 26));
    console.log(`  ${i + 1}. [${colLetter}] ${h || '(empty)'}`);
  });
  
  // Find status-related columns
  console.log('\n=== STATUS-RELATED COLUMNS ===');
  headers.forEach((h, i) => {
    if (h && (h.toLowerCase().includes('status') || 
              h.toLowerCase().includes('state') ||
              h.toLowerCase().includes('send') ||
              h.toLowerCase().includes('date') ||
              h.toLowerCase().includes('required'))) {
      console.log(`  ${i + 1}. ${h}`);
      // Get unique values
      const values = new Set();
      for (let r = 1; r < Math.min(rows.length, 100); r++) {
        if (rows[r][i]) values.add(rows[r][i]);
      }
      if (values.size > 0 && values.size < 20) {
        console.log(`     Values: ${[...values].slice(0, 10).join(', ')}${values.size > 10 ? '...' : ''}`);
      }
    }
  });
  
  // Sample 5 rows
  console.log(`\n=== SAMPLE DATA (5 rows of ${rows.length - 1} total) ===`);
  for (let r = 1; r <= Math.min(5, rows.length - 1); r++) {
    console.log(`\nRow ${r}:`);
    headers.forEach((h, i) => {
      if (rows[r][i]) {
        console.log(`  ${h || `Col${i}`}: ${rows[r][i]}`);
      }
    });
  }
  
  // Find rows with future dates
  console.log('\n=== FUTURE ORDERS (looking for Required Send dates) ===');
  const today = new Date();
  let futureCount = 0;
  
  // Find date columns
  const dateColIndices = headers.map((h, i) => {
    if (h && (h.toLowerCase().includes('date') || 
              h.toLowerCase().includes('send') ||
              h.toLowerCase().includes('event'))) {
      return i;
    }
    return -1;
  }).filter(i => i >= 0);
  
  console.log(`Date columns found: ${dateColIndices.map(i => headers[i]).join(', ')}`);
  
  for (let r = 1; r < rows.length && futureCount < 10; r++) {
    for (const i of dateColIndices) {
      const val = rows[r][i];
      if (val) {
        const d = new Date(val);
        if (!isNaN(d.getTime()) && d > today) {
          futureCount++;
          console.log(`\n  Row ${r}: ${headers[i]} = ${val}`);
          // Show key fields
          headers.slice(0, 10).forEach((h, j) => {
            if (rows[r][j]) console.log(`    ${h}: ${rows[r][j]}`);
          });
          break;
        }
      }
    }
  }
  
  console.log(`\nFound ${futureCount} future orders (showing first 10)`);
}

main().catch(console.error);
