import { NextResponse } from 'next/server';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.AIRTABLE_BASE_ID!);

export async function GET() {
  try {
    const [advisorRecords, orderRecords] = await Promise.all([
      base('Advisors').select({
        sort: [{ field: 'advisor_name', direction: 'asc' }],
      }).all(),
      base('Orders').select().all(),
    ]);
    
    // Count orders per advisor
    const now = new Date();
    const ordersByAdvisor = orderRecords.reduce((acc, r) => {
      const advisor = r.get('advisor') as string || '';
      if (!advisor) return acc;
      
      const eventDate = r.get('first_event_date') ? new Date(r.get('first_event_date') as string) : null;
      const status = r.get('status') as string || '';
      const isPast = eventDate ? eventDate < now : false;
      const isActive = !isPast && status !== 'completed';
      
      if (!acc[advisor]) {
        acc[advisor] = { total: 0, active: 0, totalMail: 0 };
      }
      acc[advisor].total++;
      if (isActive) acc[advisor].active++;
      acc[advisor].totalMail += (r.get('mailing_quantity') as number) || 0;
      
      return acc;
    }, {} as Record<string, { total: number; active: number; totalMail: number }>);
    
    const advisors = advisorRecords.map(r => {
      const name = r.get('advisor_name') as string || '';
      const counts = ordersByAdvisor[name] || { total: 0, active: 0, totalMail: 0 };
      
      return {
        id: r.id,
        advisor_name: name,
        group_name: r.get('group_name') as string || '',
        business_name: r.get('business_name') as string || '',
        main_contact_email: r.get('main_contact_email') as string || '',
        main_contact_phone: r.get('main_contact_phone') as string || '',
        main_contact_name: r.get('main_contact_name') as string || '',
        registration_phone: r.get('registration_phone') as string || '',
        orderCount: counts.total,
        activeOrderCount: counts.active,
        totalMailQuantity: counts.totalMail,
      };
    });
    
    // Sort by active orders, then total orders
    advisors.sort((a, b) => {
      if (b.activeOrderCount !== a.activeOrderCount) {
        return b.activeOrderCount - a.activeOrderCount;
      }
      return b.orderCount - a.orderCount;
    });
    
    return NextResponse.json({ advisors });
  } catch (error) {
    console.error('Advisors API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch advisors', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
