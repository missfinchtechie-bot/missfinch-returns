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
  const pendingRefundGross = (inboxReturns || [])
    .filter(r => r.type === 'refund')
    .reduce((s, r) => s + (r.subtotal || 0), 0);
  const pendingRefundNet = pendingRefundGross * 0.95;
  const pendingRefund = pendingRefundNet; // back-compat: Total Owed uses net
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

  // Period aggregates — every return in the selected date range, grouped by outcome
  const { data: periodRows } = await withRange(
    supabase.from('returns').select('subtotal, final_amount, total_fees, bonus_amount, type, status, outcome')
  );
  const rows = (periodRows || []) as { subtotal: number | null; final_amount: number | null; total_fees: number | null; bonus_amount: number | null; type: string; status: string; outcome: string | null }[];

  const sumNet = (r: { final_amount: number | null; subtotal: number | null }) =>
    (r.final_amount && Number(r.final_amount) > 0) ? Number(r.final_amount) : Number(r.subtotal) || 0;

  const refundedRows = rows.filter(r => r.status === 'done' && r.outcome === 'refund');
  const creditedRows = rows.filter(r => r.status === 'done' && r.outcome === 'credit');
  const rejectedRows = rows.filter(r => r.status === 'done' && r.outcome === 'rejected');
  const lostRows = rows.filter(r => r.status === 'done' && r.outcome === 'lost');

  const totalRefundedPeriod = refundedRows.reduce((s, r) => s + sumNet(r), 0);
  const totalCreditedPeriod = creditedRows.reduce((s, r) => s + sumNet(r), 0);
  const totalRejectedPeriod = rejectedRows.reduce((s, r) => s + (Number(r.subtotal) || 0), 0);
  const totalLostPeriod = lostRows.reduce((s, r) => s + (Number(r.subtotal) || 0), 0);
  const feesCollectedPeriod = refundedRows.reduce((s, r) => {
    if (r.total_fees && Number(r.total_fees) > 0) return s + Number(r.total_fees);
    const sub = Number(r.subtotal) || 0;
    const fin = Number(r.final_amount) || 0;
    if (fin > 0 && sub > fin) return s + (sub - fin);
    return s + sub * 0.05; // legacy estimate
  }, 0);
  const totalReturnValuePeriod = rows.reduce((s, r) => s + (Number(r.subtotal) || 0), 0);
  const totalReturns = rows.length;
  const completedCount = refundedRows.length + creditedRows.length + rejectedRows.length + lostRows.length;
  const rejectionRate = completedCount > 0 ? (rejectedRows.length / completedCount) * 100 : 0;
  const avgRefundPeriod = refundedRows.length > 0 ? totalRefundedPeriod / refundedRows.length : 0;

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
    pendingRefundGross,
    pendingRefundNet,
    pendingCredit,
    inTransitValue,
    processedThisWeek: processedThisWeek || 0,
    backlogOwed,
    totalOwed: pendingRefund + pendingCredit + backlogOwed,
    processedThisMonth: processedThisMonth || 0,
    processedThisMonthValue,
    // Period aggregates (scoped by selected date range)
    period: {
      totalReturns,
      totalReturnValue: Math.round(totalReturnValuePeriod * 100) / 100,
      totalRefunded: Math.round(totalRefundedPeriod * 100) / 100,
      refundedCount: refundedRows.length,
      avgRefund: Math.round(avgRefundPeriod * 100) / 100,
      totalCredited: Math.round(totalCreditedPeriod * 100) / 100,
      creditedCount: creditedRows.length,
      totalRejected: Math.round(totalRejectedPeriod * 100) / 100,
      rejectedCount: rejectedRows.length,
      totalLost: Math.round(totalLostPeriod * 100) / 100,
      lostCount: lostRows.length,
      feesCollected: Math.round(feesCollectedPeriod * 100) / 100,
      rejectionRate: Math.round(rejectionRate * 10) / 10,
      completedCount,
    },
  });
}
