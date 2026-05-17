import { NextResponse } from 'next/server';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get advisor
    let advisor;
    try {
      advisor = await base('Advisors').find(id);
    } catch (e: any) {
      // Try to find by name if ID lookup fails
      const records = await base('Advisors').select({
        filterByFormula: `RECORD_ID() = '${id}'`,
        maxRecords: 1,
      }).firstPage();
      advisor = records[0];
    }
    
    if (!advisor) {
      return NextResponse.json({ error: 'Advisor not found' }, { status: 404 });
    }
    
    const advisorName = advisor.get('advisor_name') as string || '';
    const groupName = advisor.get('group_name') as string || '';
    
    // Get their orders
    const orderRecords = await base('Orders').select({
      sort: [{ field: 'first_event_date', direction: 'desc' }],
    }).all();
    
    // Filter orders by advisor name
    const advisorOrders = orderRecords.filter(r => 
      (r.get('advisor') as string || '').toLowerCase() === advisorName.toLowerCase()
    );
    
    const now = new Date();
    const orders = advisorOrders.map(r => {
      const eventDate = r.get('first_event_date') ? new Date(r.get('first_event_date') as string) : null;
      const daysUntil = eventDate ? Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
      
      return {
        id: r.id,
        order_number: r.get('order_number') as number || 0,
        first_event_date: r.get('first_event_date') as string || null,
        venue_name: r.get('venue_name') as string || '',
        class_type: r.get('class_type') as string || '',
        mailing_quantity: r.get('mailing_quantity') as number || 0,
        status: r.get('status') as string || 'pending',
        daysUntil,
        isPast: daysUntil !== null && daysUntil < 0,
      };
    });
    
    // Stats
    const activeOrders = orders.filter(o => !o.isPast && o.status !== 'completed').length;
    const pastOrders = orders.filter(o => o.isPast || o.status === 'completed').length;
    const totalMailQuantity = orders.reduce((sum, o) => sum + (o.mailing_quantity || 0), 0);
    
    return NextResponse.json({
      advisor: {
        id: advisor.id,
        advisor_name: advisorName,
        group_name: groupName,
        business_name: advisor.get('business_name') as string || '',
        main_contact_email: advisor.get('main_contact_email') as string || '',
        main_contact_phone: advisor.get('main_contact_phone') as string || '',
        main_contact_name: advisor.get('main_contact_name') as string || '',
        registration_phone: advisor.get('registration_phone') as string || '',
        usual_mailing_quantity: advisor.get('usual_mailing_quantity') as number || 0,
        default_digital_budget: advisor.get('default_digital_budget') as number || 0,
      },
      orders,
      stats: {
        activeOrders,
        pastOrders,
        totalOrders: orders.length,
        totalMailQuantity,
      },
    });
  } catch (error) {
    console.error('Advisor detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch advisor', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
