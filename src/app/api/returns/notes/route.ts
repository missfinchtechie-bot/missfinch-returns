import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const returnId = new URL(req.url).searchParams.get('return_id');
  if (!returnId) return NextResponse.json({ error: 'Missing return_id' }, { status: 400 });
  const supabase = getServiceClient();
  const { data } = await supabase.from('timeline_events').select('*').eq('return_id', returnId).eq('event', 'note').order('event_date', { ascending: false });
  return NextResponse.json({ notes: data || [] });
}

export async function POST(req: NextRequest) {
  const { return_id, note } = await req.json();
  if (!return_id || !note?.trim()) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
  const supabase = getServiceClient();
  const { error } = await supabase.from('timeline_events').insert({ return_id, event: 'note', detail: note.trim(), event_date: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
