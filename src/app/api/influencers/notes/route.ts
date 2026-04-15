import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const id = new URL(req.url).searchParams.get('influencer_id');
  if (!id) return NextResponse.json({ error: 'influencer_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('influencer_notes').select('*')
    .eq('influencer_id', id).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: activity } = await supabase
    .from('influencer_activity_log').select('*')
    .eq('influencer_id', id).order('created_at', { ascending: true });

  return NextResponse.json({ notes: data || [], activity: activity || [] });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const { influencer_id, user_name, user_role, note_text } = await req.json();
  if (!influencer_id || !user_name || !user_role || !note_text) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const { data, error } = await supabase.from('influencer_notes').insert({
    influencer_id, user_name, user_role, note_text,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
}
