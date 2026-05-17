import { NextResponse } from 'next/server';
import { getAdvisors, getOrders } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const [advisors, orders] = await Promise.all([
      getAdvisors(),
      getOrders(),
    ]);
    
    // Enrich advisors with order counts
    const enrichedAdvisors = advisors.map(advisor => {
      const advisorOrders = orders.filter(o => 
        o.advisor === advisor.advisor_name || 
        o.advisor.toLowerCase().includes(advisor.advisor_name.toLowerCase())
      );
      
      const activeOrders = advisorOrders.filter(o => 
        !o.isPast && o.status !== 'completed' && o.status !== 'cancelled'
      );
      
      return {
        ...advisor,
        orderCount: advisorOrders.length,
        activeOrderCount: activeOrders.length,
        totalMailQuantity: advisorOrders.reduce((sum, o) => sum + o.mailing_quantity, 0),
      };
    });
    
    // Sort by active orders descending
    enrichedAdvisors.sort((a, b) => b.activeOrderCount - a.activeOrderCount);
    
    return NextResponse.json({
      advisors: enrichedAdvisors,
      count: enrichedAdvisors.length,
    });
  } catch (error: any) {
    console.error('Error fetching advisors from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch advisors' },
      { status: 500 }
    );
  }
}
