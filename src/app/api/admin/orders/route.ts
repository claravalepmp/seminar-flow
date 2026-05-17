import { NextResponse } from 'next/server';
import { getEnrichedOrders } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includePast = searchParams.get('includePast') === 'true';
    const includeCompleted = searchParams.get('includeCompleted') === 'true';
    
    let orders = await getEnrichedOrders();
    
    // Default: only show upcoming active orders (not past, not completed)
    if (!includePast && !includeCompleted) {
      orders = orders.filter(o => 
        !o.isPast && 
        o.status !== 'completed' && 
        o.status !== 'cancelled'
      );
    }
    
    // Sort by days until event (nearest first)
    orders.sort((a, b) => {
      const aDays = a.daysUntilEvent ?? 999;
      const bDays = b.daysUntilEvent ?? 999;
      return aDays - bDays;
    });
    
    // Return only essential fields for list view
    const lightOrders = orders.map(o => ({
      id: o.id,
      order_number: o.order_number,
      advisor: o.advisor,
      group_name: o.group_name,
      office_location: o.office_location,
      first_event_date: o.first_event_date,
      second_event_date: o.second_event_date,
      venue_name: o.venue_name,
      venue_address: o.venue_address,
      start_time: o.start_time,
      end_time: o.end_time,
      charity: o.charity,
      landing_page_url: o.landing_page_url,
      class_type: o.class_type,
      mailing_quantity: o.mailing_quantity,
      status: o.status,
      daysUntilEvent: o.daysUntilEvent,
      isPast: o.isPast,
      isUrgent: o.isUrgent || false,
      weeksOut: o.daysUntilEvent !== null ? Math.ceil(o.daysUntilEvent / 7) : null,
    }));
    
    return NextResponse.json({
      orders: lightOrders,
      count: lightOrders.length,
    });
  } catch (error: any) {
    console.error('Error fetching orders from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
