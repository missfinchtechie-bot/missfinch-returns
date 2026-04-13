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

  // Get pending value (inbox returns total)
  const { data: inboxReturns } = await supabase
    .from('returns').select('subtotal, type').eq('status', 'inbox');

  const pendingRefund = (inboxReturns || []).filter(r => r.type === 'refund').reduce((s, r) => s + (r.subtotal || 0), 0);
  const pendingCredit = (inboxReturns || []).filter(r => r.type !== 'refund').reduce((s, r) => s + (r.subtotal || 0), 0);

  // Get processed this week
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: processedThisWeek } = await supabase
    .from('returns').select('*', { count: 'exact', head: true })
    .eq('status', 'done').gte('processed_at', weekAgo);

  // Get in-transit value
  const { data: shippingReturns } = await supabase
    .from('returns').select('subtotal').eq('status', 'shipping');
  const inTransitValue = (shippingReturns || []).reduce((s, r) => s + (r.subtotal || 0), 0);

  return NextResponse.json({
    inbox: inbox.count || 0,
    shipping: shipping.count || 0,
    old: old.count || 0,
    done: done.count || 0,
    flagged: flagged.count || 0,
    all: all.count || 0,
    pendingRefund,
    pendingCredit,
    inTransitValue,
    processedThisWeek: processedThisWeek || 0,
  });
}
