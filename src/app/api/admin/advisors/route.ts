import { NextResponse } from 'next/server';
import { getEnrichedAdvisors } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const advisors = await getEnrichedAdvisors();
    
    return NextResponse.json({
      advisors,
      count: advisors.length,
    });
  } catch (error: any) {
    console.error('Error fetching advisors from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch advisors' },
      { status: 500 }
    );
  }
}
