import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// GET /api/returns/items?return_id=xxx
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const returnId = new URL(req.url).searchParams.get('return_id');

  if (!returnId) {
    return NextResponse.json({ error: 'Missing return_id' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('return_items')
    .select('*')
    .eq('return_id', returnId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data || [] });
}
