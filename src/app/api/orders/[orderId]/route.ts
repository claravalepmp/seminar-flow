import { NextResponse } from 'next/server';
import { getOrder, getOrderByNumber } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    
    // Try to find by Airtable record ID first
    let order = await getOrder(orderId);
    
    // If not found, try by order number
    if (!order) {
      const orderNum = parseInt(orderId.replace('dm-', '').replace('ord-', ''), 10);
      if (!isNaN(orderNum)) {
        order = await getOrderByNumber(orderNum);
      }
    }
    
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    // Transform to expected format for detail page
    const transformed = {
      id: order.id,
      order_number: order.order_number,
      advisor: order.advisor,
      group_name: order.group_name,
      first_event_date: order.first_event_date,
      second_event_date: order.second_event_date,
      third_event_date: order.third_event_date,
      fourth_event_date: order.fourth_event_date,
      venue_name: order.venue_name,
      venue_address: order.venue_address,
      start_time: order.start_time,
      end_time: order.end_time,
      charity: '', // Not in current Airtable schema, would need to lookup
      class_type: order.class_type,
      mailing_quantity: order.mailing_quantity,
      mailer_type: order.mailer_type,
      landing_page_url: order.landing_page_url,
      registration_phone: '', // Would need to lookup from advisor
      status: order.status,
      daysUntilEvent: order.daysUntilEvent,
      isPast: order.isPast,
      isUrgent: order.isUrgent,
      notes: order.event_notes,
      needsDirectMail: order.needs_direct_mail,
      needsDigital: order.needs_digital,
      digitalBudget: order.digital_budget,
      market: order.market,
      officeLocation: order.office_location,
      overall_priority: order.overall_priority,
      order_summary: order.order_summary,
      proof_status: order.proof_status,
      proof_feedback: order.proof_feedback,
      // Jobs
      proofs: [],
      directMailJob: order.needs_direct_mail ? {
        status: order.status,
        quantity: order.mailing_quantity,
        type: order.mailer_type,
      } : null,
      digitalJob: order.needs_digital ? {
        status: order.status,
        maxBudget: order.digital_budget,
      } : null,
    };
    
    return NextResponse.json({ order: transformed });
  } catch (error: any) {
    console.error('Error fetching order from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
