import { NextResponse } from 'next/server';
import { getAdvisor, getOrdersForAdvisor, getOrders } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get advisor from Airtable
    const advisor = await getAdvisor(id);
    
    if (!advisor) {
      return NextResponse.json(
        { error: 'Advisor not found' },
        { status: 404 }
      );
    }
    
    // Get orders for this advisor
    const orders = await getOrdersForAdvisor(advisor.advisor_name);
    
    // Calculate stats
    const activeOrders = orders.filter(o => 
      !o.isPast && o.status !== 'completed' && o.status !== 'cancelled'
    );
    const pastOrders = orders.filter(o => 
      o.isPast || o.status === 'completed'
    );
    const totalMailQuantity = orders.reduce((sum, o) => sum + o.mailing_quantity, 0);
    
    // Transform orders for response
    const transformedOrders = orders.map(o => ({
      id: o.id,
      order_number: o.order_number,
      first_event_date: o.first_event_date,
      venue_name: o.venue_name,
      class_type: o.class_type,
      mailing_quantity: o.mailing_quantity,
      status: o.status,
      daysUntil: o.daysUntilEvent,
      isPast: o.isPast,
    }));
    
    return NextResponse.json({
      advisor,
      orders: transformedOrders,
      stats: {
        activeOrders: activeOrders.length,
        pastOrders: pastOrders.length,
        totalOrders: orders.length,
        totalMailQuantity,
      },
    });
  } catch (error: any) {
    console.error('Error fetching advisor from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch advisor' },
      { status: 500 }
    );
  }
}
