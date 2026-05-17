#!/usr/bin/env node
/**
 * Analyze Main Order Google Sheet structure
 */

const { google } = require('googleapis');

const SHEET_ID = '1psPEGyNVpbQiWWtZgpMLU2GhE2AngjnEfBbrwV3ruWs';
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
  
  // Get metadata
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  console.log('=== MAIN ORDER SHEET ===\n');
  console.log('Sheets in workbook:');
  for (const sheet of metadata.data.sheets) {
    console.log(`  - ${sheet.properties.title}`);
  }
  
  // Get first sheet headers
  const firstSheet = metadata.data.sheets[0].properties.title;
  const headerData = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${firstSheet}'!1:1`,
  });
  
  const headers = headerData.data.values?.[0] || [];
  
  function colLetter(n) {
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }
  
  console.log(`\n=== ALL COLUMNS (${headers.length} total) ===\n`);
  headers.forEach((h, i) => {
    console.log(`  ${colLetter(i).padEnd(3)} ${h || '(empty)'}`);
  });
  
  // Look for important columns
  console.log('\n=== KEY COLUMNS ===\n');
  headers.forEach((h, i) => {
    const lower = (h || '').toLowerCase();
    if (lower.includes('required') || lower.includes('send') || 
        lower.includes('status') || lower.includes('deadline') ||
        lower.includes('approval') || lower.includes('proof') ||
        lower.includes('client')) {
      console.log(`  ${colLetter(i)}: ${h}`);
    }
  });
  
  // Get sample future orders
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${firstSheet}'!A1:BZ400`,
  });
  
  const rows = data.data.values || [];
  console.log(`\nTotal rows: ${rows.length - 1}`);
  
  // Find date column and show future orders
  const dateColIdx = headers.findIndex(h => h && h.toLowerCase().includes('event') && h.toLowerCase().includes('date'));
  const reqSendIdx = headers.findIndex(h => h && h.toLowerCase().includes('required') && h.toLowerCase().includes('send'));
  const statusIdx = headers.findIndex(h => h && (h.toLowerCase() === 'status' || h.toLowerCase().includes('order status')));
  
  console.log(`\nDate column: ${dateColIdx >= 0 ? headers[dateColIdx] : 'NOT FOUND'}`);
  console.log(`Required Send column: ${reqSendIdx >= 0 ? headers[reqSendIdx] : 'NOT FOUND'}`);
  console.log(`Status column: ${statusIdx >= 0 ? headers[statusIdx] : 'NOT FOUND (checking col A)'}`);
  
  // Show sample future orders
  console.log('\n=== SAMPLE FUTURE ORDERS ===');
  const today = new Date();
  let count = 0;
  
  for (let r = 1; r < rows.length && count < 5; r++) {
    const dateVal = rows[r][dateColIdx];
    if (dateVal) {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime()) && d > today) {
        count++;
        console.log(`\nRow ${r + 1}:`);
        // Show first 15 non-empty values
        let shown = 0;
        for (let i = 0; i < rows[r].length && shown < 15; i++) {
          if (rows[r][i] && rows[r][i].trim()) {
            console.log(`  ${colLetter(i)} (${headers[i] || 'unnamed'}): ${rows[r][i]}`);
            shown++;
          }
        }
      }
    }
  }
}

main().catch(console.error);
