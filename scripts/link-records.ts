import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

async function batchUpdate(tableName: string, updates: { id: string; fields: any }[]) {
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    try {
      await base(tableName).update(batch);
      process.stdout.write('.');
    } catch (e: any) {
      // Try one by one
      for (const u of batch) {
        try {
          await base(tableName).update(u.id, u.fields);
        } catch {}
      }
    }
  }
}

async function main() {
  console.log('=== LINKING RECORDS ===\n');
  
  // Load Groups
  console.log('Loading Groups...');
  const groupRecords = await base('Groups').select().all();
  const groupLookup = new Map<string, string>();
  for (const r of groupRecords) {
    const name = (r.get('Name') as string || '').toLowerCase().trim();
    if (name) groupLookup.set(name, r.id);
  }
  console.log(`  ${groupLookup.size} groups loaded`);
  
  // Load Advisors
  console.log('Loading Advisors...');
  const advisorRecords = await base('Advisors').select().all();
  const advisorLookup = new Map<string, string>();
  for (const r of advisorRecords) {
    const name = (r.get('advisor_name') as string || '').toLowerCase().trim();
    if (name) advisorLookup.set(name, r.id);
  }
  console.log(`  ${advisorLookup.size} advisors loaded`);
  
  // Load Orders and create lookup by order_number
  console.log('Loading Orders...');
  const orderRecords = await base('Orders').select().all();
  const orderLookup = new Map<number, string>();
  for (const r of orderRecords) {
    const num = r.get('order_number') as number;
    if (num) orderLookup.set(num, r.id);
  }
  console.log(`  ${orderLookup.size} orders loaded`);
  
  // Link Orders to Groups and Advisors
  console.log('\nLinking Orders');
  const orderUpdates: { id: string; fields: any }[] = [];
  for (const order of orderRecords) {
    const groupName = (order.get('group_name') as string || '').toLowerCase().trim();
    const advisorName = (order.get('advisor') as string || '').toLowerCase().trim();
    
    const fields: any = {};
    const groupId = groupLookup.get(groupName);
    const advisorId = advisorLookup.get(advisorName);
    
    if (groupId) fields.Group = [groupId];
    if (advisorId) fields.Advisor_Link = [advisorId];
    
    if (Object.keys(fields).length > 0) {
      orderUpdates.push({ id: order.id, fields });
    }
  }
  await batchUpdate('Orders', orderUpdates);
  console.log(` ${orderUpdates.length} updated`);
  
  // Link Digital_Jobs to Groups and Orders
  console.log('\nLinking Digital_Jobs');
  const digitalRecords = await base('Digital_Jobs').select().all();
  const digitalUpdates: { id: string; fields: any }[] = [];
  for (const job of digitalRecords) {
    const groupName = (job.get('group_name') as string || '').toLowerCase().trim();
    const orderNum = job.get('order_number') as number;
    
    const fields: any = {};
    const groupId = groupLookup.get(groupName);
    const orderId = orderNum ? orderLookup.get(orderNum) : null;
    
    if (groupId) fields.Group = [groupId];
    if (orderId) fields.Order = [orderId];
    
    if (Object.keys(fields).length > 0) {
      digitalUpdates.push({ id: job.id, fields });
    }
  }
  await batchUpdate('Digital_Jobs', digitalUpdates);
  console.log(` ${digitalUpdates.length} updated`);
  
  // Link Direct_Mail_Jobs to Groups and Orders  
  console.log('\nLinking Direct_Mail_Jobs');
  const dmRecords = await base('Direct_Mail_Jobs').select().all();
  const dmUpdates: { id: string; fields: any }[] = [];
  for (const job of dmRecords) {
    const groupName = (job.get('Group Name') as string || '').toLowerCase().trim();
    const orderNum = job.get('order_number') as number;
    
    const fields: any = {};
    const groupId = groupLookup.get(groupName);
    const orderId = orderNum ? orderLookup.get(orderNum) : null;
    
    if (groupId) fields.Group = [groupId];
    if (orderId) fields.Order = [orderId];
    
    if (Object.keys(fields).length > 0) {
      dmUpdates.push({ id: job.id, fields });
    }
  }
  await batchUpdate('Direct_Mail_Jobs', dmUpdates);
  console.log(` ${dmUpdates.length} updated`);
  
  console.log('\n=== DONE ===');
}

main().catch(console.error);
