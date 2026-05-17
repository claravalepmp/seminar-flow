import { NextRequest, NextResponse } from 'next/server';
import { getOrdersWithDeadlines, getOrderStats, filterOrdersForClient } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const view = (searchParams.get('view') as 'active' | 'past') || 'active';
    const group = searchParams.get('group') || undefined;
    
    const allOrders = await getOrdersWithDeadlines();
    const orders = filterOrdersForClient(allOrders, group, view);
    
    // Calculate stats for the client view
    const activeOrders = filterOrdersForClient(allOrders, group, 'active');
    const pastOrders = filterOrdersForClient(allOrders, group, 'past');
    
    const stats = {
      activeOrders: activeOrders.length,
      pastOrders: pastOrders.length,
      totalMailVolume: orders.reduce((sum, o) => sum + o.mailingQuantity, 0),
      upcomingUrgent: activeOrders.filter(o => o.isUrgent).length,
    };
    
    return NextResponse.json({
      orders,
      stats,
      count: orders.length,
    });
  } catch (error: any) {
    console.error('Error fetching client orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
