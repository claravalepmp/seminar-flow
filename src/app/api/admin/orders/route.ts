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
    
    // Filter based on params
    if (!includePast && !includeCompleted) {
      orders = orders.filter(o => 
        !o.isPast && o.status !== 'completed' && o.status !== 'cancelled'
      );
    }
    
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
