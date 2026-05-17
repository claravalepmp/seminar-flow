import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    const { data: advisor, error } = await supabase
      .from('advisors')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !advisor) {
      return NextResponse.json(
        { success: false, error: 'Email not found. Contact support.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, advisor });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
