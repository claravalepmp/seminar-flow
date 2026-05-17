import { NextResponse } from 'next/server';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Get the next order number
    const orders = await base('Orders').select({
      sort: [{ field: 'order_number', direction: 'desc' }],
      maxRecords: 1,
    }).firstPage();
    
    const lastOrderNum = orders.length > 0 ? (orders[0].get('order_number') as number || 0) : 0;
    const newOrderNum = lastOrderNum + 1;
    
    // Create the order
    const record = await base('Orders').create({
      order_number: newOrderNum,
      advisor: body.advisor_name || '',
      group_name: body.group_name || '',
      first_event_date: body.first_event_date || null,
      second_event_date: body.second_event_date || null,
      venue_name: body.venue_name || '',
      venue_address: body.venue_address || '',
      start_time: body.start_time || '',
      end_time: body.end_time || '',
      market: body.region || '',
      mailing_quantity: body.mailing_quantity || 0,
      landing_page_url: '',
      needs_direct_mail: true,
      needs_digital: body.needs_digital || false,
      digital_budget: body.digital_budget || 0,
      status: 'not_started',
    });
    
    // Create related Direct Mail Job
    await base('Direct_Mail_Jobs').create({
      order_number: newOrderNum,
      'Advisor Name': body.advisor_name || '',
      'Group Name': body.group_name || '',
      'First Event Date': body.first_event_date || null,
      'Second Event Date': body.second_event_date || null,
      'Venue Name': body.venue_name || '',
      'Venue Address': body.venue_address || '',
      'Start Time': body.start_time || '',
      'End Time': body.end_time || '',
      'Market': body.region || '',
      'Charity': body.charity || '',
      quantity: body.mailing_quantity || 0,
      status: 'Pending List',
    });
    
    // Create Digital Job if needed
    if (body.needs_digital) {
      await base('Digital_Jobs').create({
        order_number: newOrderNum,
        advisor_name: body.advisor_name || '',
        group_name: body.group_name || '',
        first_event_date: body.first_event_date || null,
        second_event_date: body.second_event_date || null,
        location_name: body.venue_name || '',
        location_address: body.venue_address || '',
        start_time: body.start_time || '',
        end_time: body.end_time || '',
        max_budget: body.digital_budget || 0,
        status: 'not_started',
      });
    }
    
    return NextResponse.json({
      success: true,
      order: {
        id: record.id,
        order_number: newOrderNum,
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
