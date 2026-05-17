import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const AIRTABLE_PAT = process.env.AIRTABLE_PAT!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;
const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(BASE_ID);

// Fields to DELETE from each table (duplicates, empty, unused)
const FIELDS_TO_DELETE: Record<string, string[]> = {
  'Orders': [
    'overall_priority', 'order_summary', 'proof_file', 'proof_status', 
    'proof_feedback', 'proof_approved_at', 'order_office_location', 'client',
    'Digital_Jobs', 'Direct_Mail_Jobs', 'Invoices', 'Events', 'Events_v2',
    'Digital_Jobs 2', 'Invoices 2', 'event_notes', 'first_event_room',
    'third_event_date', 'third_event_room', 'fourth_event_date', 'fourth_event_room',
    'second_event_room'
  ],
  'Groups': [
    'Website', 'Registration Phone', 'Registration URL', 'Address',
    'Regions', 'Clients', 'Events', 'Invoices', 'Venues 2', 
    'Events_v2', 'Charities 2', 'Creatives'
  ],
  'Advisors': [
    'business_website', 'business_address', 'business_city', 'business_state',
    'mailer_return_address', 'website_registration_direct', 'website_registration_digital',
    'ein', 'disclaimer', 'secondary_contact_name', 'secondary_contact_email',
    'cc_emails', 'preferred_mailer_topics', 'mailer_type_used', 'order_instructions',
    'direct_mailer_rate', 'direct_mail_discounts', 'start_orders_before_paid',
    'non_profit_status', 'client_notes', 'group', 'Digital_Jobs', 'Invoices',
    'Venues', 'Charities', 'Events', 'Events_v2', 'Direct_Mail_Jobs', 'Orders 2'
  ],
  'Digital_Jobs': [
    'qa_status', 'tp_status', 'sheet_needed', 'notes', 'privacy_company_name',
    'privacy_company_website', 'disclaimer', 'ethnicity_notes', 'order', 'client',
    'status_text', 'Direct_Mail_Jobs', 'Orders'
  ],
  'Direct_Mail_Jobs': [
    'job_name', 'print_date', 'mail_date', 'targeting_criteria', 'list_file',
    'creative_code', 'proof_file', 'proof_status', 'proof_feedback', 'order',
    'creative', 'Third Event Date', 'Fourth Event Date', 'First Event Room',
    'Second Event Room', 'Third Event Room', 'Fourth Event Room', 'Notes',
    'Responsibility', 'Digital Budget', 'Added to Sheets', 'Digital_Job',
    'first_event_date', 'second_event_date', 'Client', 'Mailer Return Address'
  ],
  'Venues': [
    'Full Name', 'Default Room', 'Capacity', 'Parking Notes', 'Region',
    'Events_v2', 'Clients', 'Groups'
  ],
  'Charities': [
    'Short Name', 'Region', 'Orders', 'Clients', 'Groups'
  ],
  'Regions': [
    'State', 'Default Quantity', 'Charities', 'Orders', 'Venues'
  ],
  'Invoices': [
    'venue_info', 'order', 'client', 'status_text', 'Orders'
  ],
  'Proofs': [
    'Notes', 'Assignee', 'Status', 'Attachments', 'Attachment Summary'
  ]
};

async function getTableSchema() {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` },
  });
  return (await res.json()).tables || [];
}

async function deleteField(tableId: string, fieldId: string, tableName: string, fieldName: string) {
  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables/${tableId}/fields/${fieldId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` },
    }
  );
  if (res.ok) {
    console.log(`  ✓ Deleted ${tableName}.${fieldName}`);
    return true;
  } else {
    const err = await res.json();
    // Don't log errors for fields that can't be deleted (primary, computed, etc)
    if (!err.error?.message?.includes('cannot be deleted')) {
      console.log(`  ✗ ${tableName}.${fieldName}: ${err.error?.message || res.status}`);
    }
    return false;
  }
}

async function main() {
  console.log('=== CLEANING UP AIRTABLE SCHEMA ===\n');
  
  const tables = await getTableSchema();
  const tableMap = new Map(tables.map((t: any) => [t.name, t]));
  
  for (const [tableName, fieldsToDelete] of Object.entries(FIELDS_TO_DELETE)) {
    const table = tableMap.get(tableName);
    if (!table) {
      console.log(`Table ${tableName} not found`);
      continue;
    }
    
    console.log(`\n${tableName}:`);
    
    for (const fieldName of fieldsToDelete) {
      const field = table.fields.find((f: any) => f.name === fieldName);
      if (field) {
        await deleteField(table.id, field.id, tableName, fieldName);
        await new Promise(r => setTimeout(r, 200)); // Rate limit
      }
    }
  }
  
  console.log('\n=== LINKING RECORDS ===\n');
  
  // Now link records properly
  // Get all lookup data
  const groups = await base('Groups').select().all();
  const regions = await base('Regions').select().all();
  const charities = await base('Charities').select().all();
  
  const groupLookup = new Map(groups.map(r => [(r.get('Name') as string || '').toLowerCase(), r.id]));
  const regionLookup = new Map(regions.map(r => [(r.get('Name') as string || '').toLowerCase(), r.id]));
  const charityLookup = new Map(charities.map(r => [(r.get('Name') as string || '').toLowerCase(), r.id]));
  
  console.log(`Lookups: ${groupLookup.size} groups, ${regionLookup.size} regions, ${charityLookup.size} charities`);
  
  // Link Orders to Groups, Regions, Charities
  console.log('\nLinking Orders...');
  const orders = await base('Orders').select().all();
  let linked = 0;
  
  for (const order of orders) {
    const groupName = (order.get('group_name') as string || '').toLowerCase();
    const market = (order.get('market') as string || '').toLowerCase();
    
    const updates: any = {};
    
    const groupId = groupLookup.get(groupName);
    if (groupId) updates.Group = [groupId];
    
    const regionId = regionLookup.get(market);
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
    const groupName = (advisor.get('group_name') as string || '').toLowerCase();
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
    const groupName = (job.get('group_name') as string || '').toLowerCase();
    const groupId = groupLookup.get(groupName);
    
    if (groupId) {
      try {
        await base('Digital_Jobs').update(job.id, { Group: [groupId] });
        linked++;
      } catch {}
    }
  }
  console.log(`Linked ${linked} digital jobs`);
  
  // Link Direct_Mail_Jobs to Groups
  console.log('\nLinking Direct_Mail_Jobs...');
  const dmJobs = await base('Direct_Mail_Jobs').select().all();
  linked = 0;
  
  for (const job of dmJobs) {
    const groupName = (job.get('Group Name') as string || '').toLowerCase();
    const charityName = (job.get('Charity') as string || '').toLowerCase();
    
    const updates: any = {};
    const groupId = groupLookup.get(groupName);
    if (groupId) updates.Group = [groupId];
    
    if (Object.keys(updates).length > 0) {
      try {
        await base('Direct_Mail_Jobs').update(job.id, updates);
        linked++;
      } catch {}
    }
  }
  console.log(`Linked ${linked} direct mail jobs`);
  
  console.log('\n=== DONE ===');
}

main().catch(console.error);
