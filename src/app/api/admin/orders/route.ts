import { NextResponse } from 'next/server';
import { getOrders } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includePast = searchParams.get('includePast') === 'true';
    const includeCompleted = searchParams.get('includeCompleted') === 'true';
    
    let orders = await getOrders();
    
    // Filter based on params
    if (!includePast && !includeCompleted) {
      orders = orders.filter(o => 
        !o.isPast && o.status !== 'completed' && o.status !== 'cancelled'
      );
    }
    
    // Sort: urgent first, then by days until event
    orders.sort((a, b) => {
      // Cancelled/completed go to end
      if (a.status === 'cancelled' && b.status !== 'cancelled') return 1;
      if (b.status === 'cancelled' && a.status !== 'cancelled') return -1;
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      
      // Past events go after upcoming
      if (a.isPast && !b.isPast) return 1;
      if (!a.isPast && b.isPast) return -1;
      
      // Urgent first
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      
      // Then by days until event
      const aDays = a.daysUntilEvent ?? 999;
      const bDays = b.daysUntilEvent ?? 999;
      return aDays - bDays;
    });
    
    return NextResponse.json({
      orders,
      count: orders.length,
    });
  } catch (error: any) {
    console.error('Error fetching orders from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
