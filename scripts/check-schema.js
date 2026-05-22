#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

async function checkSchema() {
  // Get a few records from each table and show all field names
  const tables = ['Orders', 'Advisors', 'Groups', 'Direct_Mail_Jobs'];
  
  for (const table of tables) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${table} - Field Names`);
    console.log('='.repeat(60));
    
    const records = await base(table).select({ maxRecords: 3 }).all();
    if (records.length === 0) {
      console.log('(no records)');
      continue;
    }
    
    // Collect all field names from all records
    const allFields = new Set();
    records.forEach(r => {
      Object.keys(r.fields).forEach(f => allFields.add(f));
    });
    
    // Show fields with sample values
    const fields = [...allFields].sort();
    console.log(`\nFound ${fields.length} fields:\n`);
    
    fields.forEach(f => {
      const sampleValue = records.find(r => r.fields[f] !== undefined)?.fields[f];
      let display = '';
      if (Array.isArray(sampleValue)) {
        if (sampleValue.length > 0 && typeof sampleValue[0] === 'string' && sampleValue[0].startsWith('rec')) {
          display = `[LINK] → ${sampleValue.length} linked records`;
        } else {
          display = `[Array] ${JSON.stringify(sampleValue).slice(0, 50)}`;
        }
      } else if (typeof sampleValue === 'object' && sampleValue !== null) {
        display = `[Object] ${JSON.stringify(sampleValue).slice(0, 50)}`;
      } else {
        display = String(sampleValue || '').slice(0, 50);
      }
      console.log(`  • ${f}: ${display}`);
    });
  }
}

checkSchema().catch(console.error);
