import { NextResponse } from 'next/server';
import { getEnrichedAdvisor } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const advisor = await getEnrichedAdvisor(id);
    
    if (!advisor) {
      return NextResponse.json(
        { error: 'Advisor not found' },
        { status: 404 }
      );
    }
    
    // Calculate stats from linked orders
    const activeOrders = advisor.orders.filter(o => 
      !o.isPast && o.status !== 'completed' && o.status !== 'cancelled'
    );
    const pastOrders = advisor.orders.filter(o => 
      o.isPast || o.status === 'completed'
    );
    
    return NextResponse.json({
      advisor,
      orders: advisor.orders,
      stats: {
        activeOrders: activeOrders.length,
        pastOrders: pastOrders.length,
        totalOrders: advisor.orders.length,
        totalMailQuantity: advisor.totalMailQuantity,
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
