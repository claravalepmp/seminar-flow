import Airtable from 'airtable';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

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
  console.log('=== FIXING LOOKUPS ===\n');
  
  // Get Direct Mail data for regions and charities
  const dmRows = await getSheetData(process.env.SHEET_ID_DIRECT_MAILING!);
  const headers = dmRows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  const dmData = dmRows.slice(1).map(row => {
    const obj: any = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
  
  // Extract regions (from market + office_location)
  const regionSet = new Set<string>();
  dmData.forEach(d => {
    const market = (d.market || '').trim();
    const office = (d.office_location || '').trim();
    if (market) regionSet.add(market);
    if (office && office !== market) regionSet.add(office);
  });
  
  // Extract charities
  const charitySet = new Set<string>();
  dmData.forEach(d => {
    const charity = (d.charity || '').trim();
    if (charity) charitySet.add(charity);
  });
  
  console.log(`Found ${regionSet.size} regions, ${charitySet.size} charities`);
  
  // Clear and repopulate Regions
  console.log('\nPopulating Regions...');
  const existingRegions = await base('Regions').select().all();
  for (let i = 0; i < existingRegions.length; i += 10) {
    await base('Regions').destroy(existingRegions.slice(i, i + 10).map(r => r.id));
  }
  
  const regionRecords = Array.from(regionSet).filter(r => r).map(name => ({ fields: { Name: name } }));
  for (let i = 0; i < regionRecords.length; i += 10) {
    await base('Regions').create(regionRecords.slice(i, i + 10));
  }
  console.log(`Created ${regionRecords.length} regions`);
  
  // Clear and repopulate Charities
  console.log('\nPopulating Charities...');
  const existingCharities = await base('Charities').select().all();
  for (let i = 0; i < existingCharities.length; i += 10) {
    await base('Charities').destroy(existingCharities.slice(i, i + 10).map(r => r.id));
  }
  
  const charityRecords = Array.from(charitySet).filter(c => c).map(name => ({ fields: { Name: name } }));
  for (let i = 0; i < charityRecords.length; i += 10) {
    await base('Charities').create(charityRecords.slice(i, i + 10));
  }
  console.log(`Created ${charityRecords.length} charities`);
  
  // Get fresh lookups
  const groups = await base('Groups').select().all();
  const regions = await base('Regions').select().all();
  const charities = await base('Charities').select().all();
  
  const groupLookup = new Map(groups.map(r => [(r.get('Name') as string || '').toLowerCase().trim(), r.id]));
  const regionLookup = new Map(regions.map(r => [(r.get('Name') as string || '').toLowerCase().trim(), r.id]));
  const charityLookup = new Map(charities.map(r => [(r.get('Name') as string || '').toLowerCase().trim(), r.id]));
  
  console.log(`\nLookups ready: ${groupLookup.size} groups, ${regionLookup.size} regions, ${charityLookup.size} charities`);
  
  // Link Direct_Mail_Jobs to Groups and Charities
  console.log('\nLinking Direct_Mail_Jobs...');
  const dmJobs = await base('Direct_Mail_Jobs').select().all();
  let linked = 0;
  
  for (const job of dmJobs) {
    const groupName = (job.get('Group Name') as string || '').toLowerCase().trim();
    const charityName = (job.get('Charity') as string || '').toLowerCase().trim();
    
    const updates: any = {};
    const groupId = groupLookup.get(groupName);
    const charityId = charityLookup.get(charityName);
    
    if (groupId) updates.Group = [groupId];
    
    if (Object.keys(updates).length > 0) {
      try {
        await base('Direct_Mail_Jobs').update(job.id, updates);
        linked++;
      } catch {}
    }
  }
  console.log(`Linked ${linked} direct mail jobs to groups`);
  
  // Link Orders to Groups and Regions
  console.log('\nLinking Orders...');
  const orders = await base('Orders').select().all();
  linked = 0;
  
  for (const order of orders) {
    const groupName = (order.get('group_name') as string || '').toLowerCase().trim();
    const market = (order.get('market') as string || '').toLowerCase().trim();
    
    const updates: any = {};
    const groupId = groupLookup.get(groupName);
    const regionId = regionLookup.get(market);
    
    if (groupId) updates.Group = [groupId];
    if (regionId) updates.Region = [regionId];
    
    if (Object.keys(updates).length > 0) {
      try {
        await base('Orders').update(order.id, updates);
        linked++;
      } catch {}
    }
  }
  console.log(`Linked ${linked} orders`);
  
  // Link Advisors to Groups
  console.log('\nLinking Advisors...');
  const advisors = await base('Advisors').select().all();
  linked = 0;
  
  for (const advisor of advisors) {
    const groupName = (advisor.get('group_name') as string || '').toLowerCase().trim();
    const groupId = groupLookup.get(groupName);
    
    if (groupId) {
      try {
        await base('Advisors').update(advisor.id, { Group: [groupId] });
        linked++;
      } catch {}
    }
  }
  console.log(`Linked ${linked} advisors`);
  
  // Link Digital_Jobs to Groups
  console.log('\nLinking Digital_Jobs...');
  const digitalJobs = await base('Digital_Jobs').select().all();
  linked = 0;
  
  for (const job of digitalJobs) {
    const groupName = (job.get('group_name') as string || '').toLowerCase().trim();
    const groupId = groupLookup.get(groupName);
    
    if (groupId) {
      try {
        await base('Digital_Jobs').update(job.id, { Group: [groupId] });
        linked++;
      } catch {}
    }
  }
  console.log(`Linked ${linked} digital jobs`);
  
  console.log('\n=== DONE ===');
}

main().catch(console.error);
