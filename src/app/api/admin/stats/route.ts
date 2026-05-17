import { NextResponse } from 'next/server';
import { getOrderStats } from '@/lib/airtable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const stats = await getOrderStats();
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching stats from Airtable:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
