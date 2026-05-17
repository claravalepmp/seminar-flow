import { NextResponse } from 'next/server';
import { getLookupData } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const lookups = await getLookupData();
    return NextResponse.json(lookups);
  } catch (error: any) {
    console.error('Error fetching lookups from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch lookups' },
      { status: 500 }
    );
  }
}
