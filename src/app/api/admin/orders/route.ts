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
    
    // Default: only show upcoming active orders (not past, not completed)
    if (!includePast && !includeCompleted) {
      orders = orders.filter(o => 
        !o.isPast && 
        o.status !== 'completed' && 
        o.status !== 'cancelled'
      );
    }
    
    // Sort by days until event (nearest first)
    orders.sort((a, b) => {
      const aDays = a.daysUntilEvent ?? 999;
      const bDays = b.daysUntilEvent ?? 999;
      return aDays - bDays;
    });
    
    // Return fields in camelCase format for dashboard
    const lightOrders = orders.map(o => {
      // Map DM status to dashboard status
      const dmStatus = o.direct_mail_jobs?.[0]?.status || '';
      let dashboardStatus = 'Not Started';
      if (dmStatus === 'Mailed') dashboardStatus = 'Order Completed';
      else if (dmStatus === 'Pending List') dashboardStatus = 'Pending Details';
      else if (o.status === 'completed') dashboardStatus = 'Order Completed';
      
      return {
        id: o.id,
        orderNumber: o.order_number,
        order_number: o.order_number, // Keep both for compatibility
        advisor: o.advisor,
        groupName: o.group_name || o.group_data?.name || '',
        group_name: o.group_name,
        officeLocation: o.office_location || '',
        office_location: o.office_location,
        market: o.market || '',
        firstEventDate: o.first_event_date,
        first_event_date: o.first_event_date,
        secondEventDate: o.second_event_date,
        second_event_date: o.second_event_date,
        thirdEventDate: o.third_event_date || null,
        fourthEventDate: o.fourth_event_date || null,
        venueName: o.venue_name || '',
        venue_name: o.venue_name,
        venueAddress: o.venue_address || '',
        venue_address: o.venue_address,
        firstEventRoom: o.first_event_room || '',
        startTime: o.start_time || '',
        start_time: o.start_time,
        endTime: o.end_time || '',
        end_time: o.end_time,
        charity: o.charity || o.charity_data?.name || '',
        classType: o.class_type || '',
        class_type: o.class_type,
        mailingQuantity: o.mailing_quantity || 0,
        mailing_quantity: o.mailing_quantity,
        mailerType: o.mailer_type || '',
        mailerReturnAddress: o.mailer_return_address || '',
        landingPageUrl: o.landing_page_url || '',
        landing_page_url: o.landing_page_url,
        registrationPhone: o.advisor_data?.registration_phone || o.group_data?.registration_phone || '',
        needsDirectMail: o.needs_direct_mail || false,
        needsDigital: o.needs_digital || false,
        digitalBudget: o.digital_budget || 0,
        status: dashboardStatus,
        statusCategory: o.status === 'completed' ? 'completed' : 'active',
        daysUntilEvent: o.daysUntilEvent,
        daysUntilDeadline: null,
        clientApprovalDeadline: null,
        orderSentDeadline: null,
        isPast: o.isPast,
        isUrgent: o.daysUntilEvent !== null && o.daysUntilEvent <= 14,
        weeksOut: o.daysUntilEvent !== null ? Math.ceil(o.daysUntilEvent / 7) : null,
        notes: o.event_notes || '',
      };
    });
    
    return NextResponse.json({
      orders: lightOrders,
      count: lightOrders.length,
    });
  } catch (error: any) {
    console.error('Error fetching orders from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
