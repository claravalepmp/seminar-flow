import { NextResponse } from 'next/server';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Try to find by record ID first, then by order number
    let record;
    try {
      record = await base('Orders').find(id);
    } catch {
      // Try finding by order number
      const records = await base('Orders').select({
        filterByFormula: `{order_number} = ${parseInt(id)}`,
        maxRecords: 1,
      }).firstPage();
      record = records[0];
    }
    
    if (!record) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    // Get linked group and advisor details
    const groupIds = record.get('Group') as string[] || [];
    const advisorIds = record.get('Advisor_Link') as string[] || [];
    
    let groupName = record.get('group_name') as string || '';
    let advisorDetails = null;
    
    if (groupIds.length > 0) {
      try {
        const group = await base('Groups').find(groupIds[0]);
        groupName = group.get('Name') as string || groupName;
      } catch {}
    }
    
    if (advisorIds.length > 0) {
      try {
        const advisor = await base('Advisors').find(advisorIds[0]);
        advisorDetails = {
          name: advisor.get('advisor_name') as string || '',
          email: advisor.get('main_contact_email') as string || '',
          phone: advisor.get('main_contact_phone') as string || '',
          business: advisor.get('business_name') as string || '',
        };
      } catch {}
    }
    
    // Get related proofs
    let proofs: any[] = [];
    try {
      const proofRecords = await base('Proofs').select({
        filterByFormula: `FIND("${record.id}", ARRAYJOIN({Order}))`,
      }).all();
      proofs = proofRecords.map(p => ({
        id: p.id,
        name: p.get('Name') as string || '',
        status: p.get('proof_status') as string || 'Pending Review',
        version: p.get('proof_version') as number || 1,
        feedback: p.get('proof_feedback') as string || '',
        files: p.get('proof_file') as any[] || [],
        uploadedAt: p.get('uploaded_at') as string || '',
        approvedAt: p.get('approved_at') as string || '',
      }));
    } catch {}
    
    // Get related digital job
    let digitalJob = null;
    try {
      const digitalRecords = await base('Digital_Jobs').select({
        filterByFormula: `{order_number} = ${record.get('order_number')}`,
        maxRecords: 1,
      }).firstPage();
      if (digitalRecords.length > 0) {
        const d = digitalRecords[0];
        digitalJob = {
          id: d.id,
          status: d.get('status') as string || '',
          maxBudget: d.get('max_budget') as number || 0,
          landingPage: d.get('landing_page_url') as string || '',
        };
      }
    } catch {}
    
    // Get related direct mail job
    let directMailJob = null;
    try {
      const dmRecords = await base('Direct_Mail_Jobs').select({
        filterByFormula: `{order_number} = ${record.get('order_number')}`,
        maxRecords: 1,
      }).firstPage();
      if (dmRecords.length > 0) {
        const d = dmRecords[0];
        directMailJob = {
          id: d.id,
          status: d.get('status') as string || '',
          quantity: d.get('quantity') as number || 0,
          mailerType: d.get('Mailer Type') as string || '',
          charity: d.get('Charity') as string || '',
        };
      }
    } catch {}
    
    const now = new Date();
    const eventDate = record.get('first_event_date') ? new Date(record.get('first_event_date') as string) : null;
    const daysUntilEvent = eventDate ? Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    
    const order = {
      id: record.id,
      order_number: record.get('order_number') as number || 0,
      advisor: record.get('advisor') as string || '',
      advisorDetails,
      group_name: groupName,
      first_event_date: record.get('first_event_date') as string || null,
      second_event_date: record.get('second_event_date') as string || null,
      third_event_date: record.get('third_event_date') as string || null,
      fourth_event_date: record.get('fourth_event_date') as string || null,
      needs_direct_mail: record.get('needs_direct_mail') as boolean || false,
      needs_digital: record.get('needs_digital') as boolean || false,
      market: record.get('market') as string || '',
      office_location: record.get('office_location') as string || '',
      class_type: record.get('class_type') as string || '',
      mailing_quantity: record.get('mailing_quantity') as number || 0,
      mailer_type: record.get('mailer_type') as string || '',
      digital_budget: record.get('digital_budget') as number || 0,
      landing_page_url: record.get('landing_page_url') as string || '',
      venue_name: record.get('venue_name') as string || '',
      venue_address: record.get('venue_address') as string || '',
      start_time: record.get('start_time') as string || '',
      end_time: record.get('end_time') as string || '',
      first_event_room: record.get('first_event_room') as string || '',
      second_event_room: record.get('second_event_room') as string || '',
      status: record.get('status') as string || 'pending',
      event_notes: record.get('event_notes') as string || '',
      created_at: record.get('created_at') as string || '',
      daysUntilEvent,
      isPast: daysUntilEvent !== null && daysUntilEvent < 0,
      proofs,
      digitalJob,
      directMailJob,
    };
    
    return NextResponse.json({ order });
  } catch (error) {
    console.error('Order detail API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Update the order
    const record = await base('Orders').update(id, body);
    
    return NextResponse.json({ 
      success: true,
      order: {
        id: record.id,
        status: record.get('status'),
      },
    });
  } catch (error) {
    console.error('Order update error:', error);
    return NextResponse.json(
      { error: 'Failed to update order', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
