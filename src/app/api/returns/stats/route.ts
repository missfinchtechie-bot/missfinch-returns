import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getServiceClient();

  const [inbox, shipping, old, done, flagged, all] = await Promise.all([
    supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'inbox'),
    supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'shipping'),
    supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'old'),
    supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'done'),
    supabase.from('returns').select('*', { count: 'exact', head: true }).eq('is_flagged', true).neq('status', 'done'),
    supabase.from('returns').select('*', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    inbox: inbox.count || 0,
    shipping: shipping.count || 0,
    old: old.count || 0,
    done: done.count || 0,
    flagged: flagged.count || 0,
    all: all.count || 0,
  });
}
