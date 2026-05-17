import { NextResponse } from 'next/server';
import { getOrdersWithDeadlines, getOrderStats } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const orders = await getOrdersWithDeadlines();
    const stats = getOrderStats(orders);
    
    return NextResponse.json({
      ...stats,
      groups: stats.groups,
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
