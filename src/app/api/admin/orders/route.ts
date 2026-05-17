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
    
    // Add weeksOut calculation
    orders = orders.map(o => {
      const weeksOut = o.daysUntilEvent !== null ? Math.ceil(o.daysUntilEvent / 7) : null;
      return { ...o, weeksOut };
    });
    
    // Default: only show upcoming active orders (not past, not completed)
    if (!includePast && !includeCompleted) {
      orders = orders.filter(o => 
        !o.isPast && 
        o.status !== 'completed' && 
        o.status !== 'cancelled'
      );
    }
    
    // Sort by weeks out (nearest first)
    orders.sort((a, b) => {
      const aWeeks = a.weeksOut ?? 999;
      const bWeeks = b.weeksOut ?? 999;
      return aWeeks - bWeeks;
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
