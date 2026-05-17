require('dotenv').config({ path: '.env.local' });

const PAT = process.env.AIRTABLE_PAT;
const BASE_ID = 'appeEmOJVXDJ0WPF4';

// Schema based on Google Sheets analysis
const TABLES_TO_CREATE = [
  {
    name: 'Clients',
    fields: [
      { name: 'advisor_name', type: 'singleLineText' },
      { name: 'group_name', type: 'singleLineText' },
      { name: 'business_name', type: 'singleLineText' },
      { name: 'business_website', type: 'url' },
      { name: 'business_address', type: 'singleLineText' },
      { name: 'business_city', type: 'singleLineText' },
      { name: 'business_state', type: 'singleLineText' },
      { name: 'mailer_return_address', type: 'multilineText' },
      { name: 'registration_phone', type: 'phoneNumber' },
      { name: 'website_registration_direct', type: 'url' },
      { name: 'website_registration_digital', type: 'url' },
      { name: 'ein', type: 'singleLineText' },
      { name: 'disclaimer', type: 'multilineText' },
      { name: 'main_contact_name', type: 'singleLineText' },
      { name: 'main_contact_email', type: 'email' },
      { name: 'main_contact_phone', type: 'phoneNumber' },
      { name: 'secondary_contact_name', type: 'singleLineText' },
      { name: 'secondary_contact_email', type: 'email' },
      { name: 'cc_emails', type: 'multilineText' },
      { name: 'preferred_mailer_topics', type: 'multilineText' },
      { name: 'mailer_type_used', type: 'singleLineText' },
      { name: 'order_instructions', type: 'multilineText' },
      { name: 'direct_mailer_rate', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'usual_mailing_quantity', type: 'number', options: { precision: 0 } },
      { name: 'default_digital_budget', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'direct_mail_discounts', type: 'multilineText' },
      { name: 'start_orders_before_paid', type: 'checkbox', options: { color: 'greenBright', icon: 'check' } },
      { name: 'non_profit_status', type: 'checkbox', options: { color: 'greenBright', icon: 'check' } },
      { name: 'client_notes', type: 'multilineText' }
    ]
  },
  {
    name: 'Digital_Jobs',
    fields: [
      { name: 'order_number', type: 'number', options: { precision: 0 } },
      { name: 'status', type: 'singleSelect', options: { choices: [
        { name: 'New', color: 'blueLight2' },
        { name: 'QA Pending', color: 'yellowLight2' },
        { name: 'TP Pending', color: 'orangeLight2' },
        { name: 'Active', color: 'greenLight2' },
        { name: 'Completed', color: 'grayLight2' },
        { name: 'Cancelled', color: 'redLight2' }
      ]}},
      { name: 'advisor_name', type: 'singleLineText' },
      { name: 'group_name', type: 'singleLineText' },
      { name: 'first_event_date', type: 'date', options: { dateFormat: { name: 'local' } } },
      { name: 'second_event_date', type: 'date', options: { dateFormat: { name: 'local' } } },
      { name: 'location_name', type: 'singleLineText' },
      { name: 'location_address', type: 'multilineText' },
      { name: 'start_time', type: 'singleLineText' },
      { name: 'end_time', type: 'singleLineText' },
      { name: 'class_type', type: 'singleLineText' },
      { name: 'qa_status', type: 'singleSelect', options: { choices: [
        { name: 'Pending', color: 'yellowLight2' },
        { name: 'Approved', color: 'greenLight2' },
        { name: 'Rejected', color: 'redLight2' }
      ]}},
      { name: 'tp_status', type: 'singleSelect', options: { choices: [
        { name: 'Pending', color: 'yellowLight2' },
        { name: 'Approved', color: 'greenLight2' },
        { name: 'Rejected', color: 'redLight2' }
      ]}},
      { name: 'sheet_needed', type: 'checkbox', options: { color: 'greenBright', icon: 'check' } },
      { name: 'landing_page_url', type: 'url' },
      { name: 'max_budget', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'notes', type: 'multilineText' },
      { name: 'privacy_company_name', type: 'singleLineText' },
      { name: 'privacy_company_website', type: 'url' },
      { name: 'disclaimer', type: 'multilineText' },
      { name: 'ethnicity_notes', type: 'multilineText' }
    ]
  },
  {
    name: 'Direct_Mail_Jobs',
    fields: [
      { name: 'job_name', type: 'singleLineText' },
      { name: 'order_number', type: 'number', options: { precision: 0 } },
      { name: 'status', type: 'singleSelect', options: { choices: [
        { name: 'Pending List', color: 'blueLight2' },
        { name: 'List Ready', color: 'cyanLight2' },
        { name: 'At Printer', color: 'yellowLight2' },
        { name: 'Mailed', color: 'greenLight2' },
        { name: 'Cancelled', color: 'redLight2' }
      ]}},
      { name: 'print_date', type: 'date', options: { dateFormat: { name: 'local' } } },
      { name: 'mail_date', type: 'date', options: { dateFormat: { name: 'local' } } },
      { name: 'quantity', type: 'number', options: { precision: 0 } },
      { name: 'targeting_criteria', type: 'multilineText' },
      { name: 'list_file', type: 'multipleAttachments' },
      { name: 'creative_code', type: 'singleLineText' },
      { name: 'proof_file', type: 'multipleAttachments' },
      { name: 'proof_status', type: 'singleSelect', options: { choices: [
        { name: 'Pending', color: 'yellowLight2' },
        { name: 'Approved', color: 'greenLight2' },
        { name: 'Revisions Needed', color: 'redLight2' }
      ]}},
      { name: 'proof_feedback', type: 'multilineText' }
    ]
  },
  {
    name: 'Creatives',
    fields: [
      { name: 'name', type: 'singleLineText' },
      { name: 'code', type: 'singleLineText' },
      { name: 'type', type: 'singleSelect', options: { choices: [
        { name: 'Postcard', color: 'blueLight2' },
        { name: 'Letter', color: 'greenLight2' },
        { name: 'Brochure', color: 'purpleLight2' }
      ]}},
      { name: 'topic', type: 'singleSelect', options: { choices: [
        { name: 'Retirement 101', color: 'blueLight2' },
        { name: 'Wealth 101', color: 'greenLight2' },
        { name: 'Women Wine Wealth', color: 'pinkLight2' },
        { name: 'Social Security', color: 'yellowLight2' },
        { name: 'Taxes', color: 'orangeLight2' },
        { name: 'Job Loss', color: 'redLight2' },
        { name: 'SS/Taxes', color: 'cyanLight2' }
      ]}},
      { name: 'preview_image', type: 'multipleAttachments' },
      { name: 'template_file', type: 'multipleAttachments' },
      { name: 'active', type: 'checkbox', options: { color: 'greenBright', icon: 'check' } }
    ]
  },
  {
    name: 'Invoices',
    fields: [
      { name: 'invoice_number', type: 'singleLineText' },
      { name: 'order_number', type: 'number', options: { precision: 0 } },
      { name: 'advisor_name', type: 'singleLineText' },
      { name: 'group_name', type: 'singleLineText' },
      { name: 'status', type: 'singleSelect', options: { choices: [
        { name: 'Draft', color: 'grayLight2' },
        { name: 'Sent', color: 'yellowLight2' },
        { name: 'Paid', color: 'greenLight2' },
        { name: 'Overdue', color: 'redLight2' },
        { name: 'Cancelled', color: 'grayLight2' }
      ]}},
      { name: 'sent_date', type: 'date', options: { dateFormat: { name: 'local' } } },
      { name: 'paid_date', type: 'date', options: { dateFormat: { name: 'local' } } },
      { name: 'first_class_day', type: 'date', options: { dateFormat: { name: 'local' } } },
      { name: 'direct_rate', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'mailing_quantity', type: 'number', options: { precision: 0 } },
      { name: 'direct_mail_discounts', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'invoiced_direct_mail', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'invoiced_digital', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'invoiced_tech_sequences', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'cc_processing', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'fl_state_tax', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'total_invoice', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'mailer_type', type: 'singleLineText' },
      { name: 'venue_info', type: 'multilineText' }
    ]
  }
];

async function listTables() {
  const resp = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { 'Authorization': `Bearer ${PAT}` }
  });
  const data = await resp.json();
  return data.tables || [];
}

async function createTable(tableConfig) {
  const resp = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(tableConfig)
  });
  return resp.json();
}

async function main() {
  console.log('=== CURRENT TABLES ===');
  const existing = await listTables();
  existing.forEach(t => console.log(`  ${t.name} (${t.id})`));
  const existingNames = existing.map(t => t.name);
  
  console.log('\n=== CREATING NEW TABLES ===');
  for (const table of TABLES_TO_CREATE) {
    if (existingNames.includes(table.name)) {
      console.log(`  ${table.name} - already exists, skipping`);
      continue;
    }
    
    const result = await createTable(table);
    if (result.error) {
      console.log(`  ${table.name} - ERROR: ${result.error.message}`);
    } else {
      console.log(`  ${table.name} - CREATED (${result.id})`);
    }
  }
  
  console.log('\n=== FINAL TABLES ===');
  const final = await listTables();
  final.forEach(t => console.log(`  ${t.name} (${t.fields?.length} fields)`));
}

main().catch(console.error);
