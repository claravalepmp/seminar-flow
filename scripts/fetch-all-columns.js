#!/usr/bin/env node
/**
 * Fetch ALL columns from Direct Mailing sheet including far-right ones
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
  
  // Get row 1 (headers) across ALL columns
  const headerData = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Main Orders - ONLY ONE USED'!1:1",
  });
  
  const headers = headerData.data.values?.[0] || [];
  console.log(`=== ALL COLUMNS (${headers.length} total) ===\n`);
  
  // Convert to column letters
  function colLetter(n) {
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }
  
  headers.forEach((h, i) => {
    console.log(`  ${colLetter(i).padEnd(3)} ${h || '(empty)'}`);
  });
  
  // Look for "required" or "send" columns
  console.log('\n=== IMPORTANT COLUMNS FOR DASHBOARD ===\n');
  headers.forEach((h, i) => {
    const lower = (h || '').toLowerCase();
    if (lower.includes('required') || lower.includes('send') || 
        lower.includes('status') || lower.includes('deadline') ||
        lower.includes('approval') || lower.includes('proof')) {
      console.log(`  ${colLetter(i)}: ${h}`);
    }
  });
  
  // Get row 2-10 with ALL columns to see sample data
  const sampleData = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "'Main Orders - ONLY ONE USED'!A2:BZ5",
  });
  
  console.log('\n=== SAMPLE ROW DATA (showing non-empty values) ===');
  const rows = sampleData.data.values || [];
  for (let r = 0; r < rows.length; r++) {
    console.log(`\nRow ${r + 2}:`);
    rows[r].forEach((v, i) => {
      if (v && v.trim()) {
        console.log(`  ${colLetter(i)} (${headers[i] || 'unnamed'}): ${v}`);
      }
    });
  }
}

main().catch(console.error);
