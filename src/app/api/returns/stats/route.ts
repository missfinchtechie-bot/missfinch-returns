import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const withRange = <Q extends { gte: (col: string, val: string) => Q; lte: (col: string, val: string) => Q }>(q: Q, col = 'return_requested'): Q => {
    let out = q;
    if (from) out = out.gte(col, from);
    if (to) out = out.lte(col, to);
    return out;
  };

  const [inbox, shipping, old, done, flagged, all, lost] = await Promise.all([
    withRange(supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'inbox')),
    withRange(supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'shipping')),
    withRange(supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'old')),
    withRange(supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'done')),
    withRange(supabase.from('returns').select('*', { count: 'exact', head: true }).eq('is_flagged', true).neq('status', 'done')),
    withRange(supabase.from('returns').select('*', { count: 'exact', head: true })),
    withRange(supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'done').eq('outcome', 'lost')),
  ]);

  const { data: inboxReturns } = await withRange(
    supabase.from('returns').select('subtotal, type').eq('status', 'inbox')
  );
  // Apply 5% restocking fee on refunds; credits/exchanges are full subtotal
  const pendingRefund = (inboxReturns || [])
    .filter(r => r.type === 'refund')
    .reduce((s, r) => s + ((r.subtotal || 0) * 0.95), 0);
  const pendingCredit = (inboxReturns || [])
    .filter(r => r.type !== 'refund')
    .reduce((s, r) => s + (r.subtotal || 0), 0);

  const { data: backlogReturns } = await withRange(
    supabase.from('returns').select('subtotal').eq('status', 'old')
  );
  const backlogOwed = (backlogReturns || []).reduce((s, r) => s + (r.subtotal || 0), 0);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: processedMonthRows, count: processedThisMonth } = await supabase
    .from('returns').select('final_amount, subtotal, outcome', { count: 'exact' })
    .eq('status', 'done').gte('processed_at', monthStart);
  const processedThisMonthValue = (processedMonthRows || []).reduce((s, r) => {
    if (r.outcome === 'rejected' || r.outcome === 'lost') return s;
    return s + ((r.final_amount && r.final_amount > 0) ? Number(r.final_amount) : Number(r.subtotal || 0));
  }, 0);

  // Processed this week is always based on the last 7 days, regardless of date filter
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: processedThisWeek } = await supabase
    .from('returns').select('*', { count: 'exact', head: true })
    .eq('status', 'done').gte('processed_at', weekAgo);

  const { data: shippingReturns } = await withRange(
    supabase.from('returns').select('subtotal').eq('status', 'shipping')
  );
  const inTransitValue = (shippingReturns || []).reduce((s, r) => s + (r.subtotal || 0), 0);

  return NextResponse.json({
    inbox: inbox.count || 0,
    shipping: shipping.count || 0,
    old: old.count || 0,
    done: done.count || 0,
    flagged: flagged.count || 0,
    all: all.count || 0,
    lost: lost.count || 0,
    pendingRefund,
    pendingCredit,
    inTransitValue,
    processedThisWeek: processedThisWeek || 0,
    backlogOwed,
    totalOwed: pendingRefund + pendingCredit + backlogOwed,
    processedThisMonth: processedThisMonth || 0,
    processedThisMonthValue,
  });
}
