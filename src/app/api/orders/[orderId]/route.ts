import { NextResponse } from 'next/server';
import { getEnrichedOrder, getEnrichedOrderByNumber } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    
    // Try to find by Airtable record ID first
    let order = await getEnrichedOrder(orderId);
    
    // If not found, try by order number
    if (!order) {
      const orderNum = parseInt(orderId.replace('dm-', '').replace('ord-', ''), 10);
      if (!isNaN(orderNum)) {
        order = await getEnrichedOrderByNumber(orderNum);
      }
    }
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Error fetching order from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
