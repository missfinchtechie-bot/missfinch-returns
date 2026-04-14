import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const status = new URL(req.url).searchParams.get('status') || 'all';
  const supabase = getServiceClient();
  
  let query = supabase.from('message_log').select('*').order('created_at', { ascending: false }).limit(50);
  if (status !== 'all') query = query.eq('status', status);
  
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data || [] });
}
