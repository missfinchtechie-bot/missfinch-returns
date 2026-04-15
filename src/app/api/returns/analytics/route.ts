import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase
    .from('returns')
    .select('status, type, outcome, subtotal, item_count, customer_name, return_requested, is_flagged, imported_from, delivered_to_customer, delivered_to_us, processed_at')
    .order('return_requested', { ascending: false });
  if (from) query = query.gte('return_requested', from);
  if (to) query = query.lte('return_requested', to);

  const { data: allReturns } = await query;
  const returns = allReturns || [];

  // Monthly aggregation
  const monthlyMap = new Map<string, { returns: number; value: number; refunds: number; credits: number; exchanges: number }>();
  returns.forEach(r => {
    if (!r.return_requested) return;
    const month = r.return_requested.slice(0, 7);
    const m = monthlyMap.get(month) || { returns: 0, value: 0, refunds: 0, credits: 0, exchanges: 0 };
    m.returns++;
    m.value += r.subtotal || 0;
    if (r.type === 'refund') m.refunds++;
    if (r.type === 'credit') m.credits++;
    if (r.type === 'exchange') m.exchanges++;
    monthlyMap.set(month, m);
  });
  const monthlyTrend = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, data]) => ({ month, ...data }));

  const statusCounts: Record<string, number> = {};
  returns.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  const outcomeCounts: Record<string, number> = {};
  returns.filter(r => r.status === 'done').forEach(r => {
    const key = r.outcome || 'unknown';
    outcomeCounts[key] = (outcomeCounts[key] || 0) + 1;
  });

  const outcomeValues: Record<string, number> = {};
  returns.filter(r => r.status === 'done').forEach(r => {
    const key = r.outcome || 'unknown';
    outcomeValues[key] = (outcomeValues[key] || 0) + (r.subtotal || 0);
  });

  const typeCounts: Record<string, { count: number; value: number }> = {};
  returns.forEach(r => {
    const t = typeCounts[r.type] || { count: 0, value: 0 };
    t.count++;
    t.value += r.subtotal || 0;
    typeCounts[r.type] = t;
  });

  const customerMap = new Map<string, { count: number; value: number }>();
  returns.forEach(r => {
    if (!r.customer_name) return;
    const c = customerMap.get(r.customer_name) || { count: 0, value: 0 };
    c.count++;
    c.value += r.subtotal || 0;
    customerMap.set(r.customer_name, c);
  });
  const repeatReturners = Array.from(customerMap.entries())
    .filter(([, d]) => d.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([name, data]) => ({ name, ...data }));

  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  returns.forEach(r => {
    if (!r.return_requested) return;
    const dow = new Date(r.return_requested).getDay();
    dowCounts[dow]++;
  });
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, i) => ({ day: name, count: dowCounts[i] }));

  const totalReturns = returns.length;
  const totalValue = returns.reduce((s, r) => s + (r.subtotal || 0), 0);
  const avgValue = totalReturns > 0 ? totalValue / totalReturns : 0;

  const nonZeroReturns = returns.filter(r => r.subtotal && r.subtotal > 0);
  const avgValueExcZero = nonZeroReturns.length > 0 ? nonZeroReturns.reduce((s, r) => s + r.subtotal, 0) / nonZeroReturns.length : 0;
  const zeroValueCount = returns.filter(r => !r.subtotal || r.subtotal === 0).length;

  const doneReturns = returns.filter(r => r.status === 'done');
  const rejectionRate = doneReturns.length > 0 ? (returns.filter(r => r.outcome === 'rejected').length / doneReturns.length) * 100 : 0;
  const avgItemsPerReturn = totalReturns > 0 ? returns.reduce((s, r) => s + (r.item_count || 0), 0) / totalReturns : 0;

  // Avg days to return (delivered_to_customer → return_requested)
  const daysToReturnPairs = returns
    .filter(r => r.delivered_to_customer && r.return_requested)
    .map(r => (new Date(r.return_requested!).getTime() - new Date(r.delivered_to_customer!).getTime()) / 86400000)
    .filter(d => d >= 0 && d < 365);
  const avgDaysToReturn = daysToReturnPairs.length > 0 ? daysToReturnPairs.reduce((s, d) => s + d, 0) / daysToReturnPairs.length : 0;

  // Avg days to process (delivered_to_us → processed_at)
  const daysToProcessPairs = returns
    .filter(r => r.delivered_to_us && r.processed_at)
    .map(r => (new Date(r.processed_at!).getTime() - new Date(r.delivered_to_us!).getTime()) / 86400000)
    .filter(d => d >= 0 && d < 365);
  const avgDaysToProcess = daysToProcessPairs.length > 0 ? daysToProcessPairs.reduce((s, d) => s + d, 0) / daysToProcessPairs.length : 0;

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyAgo = new Date(now.getTime() - 60 * 86400000);
  const recent = returns.filter(r => r.return_requested && new Date(r.return_requested) >= thirtyAgo);
  const prior = returns.filter(r => r.return_requested && new Date(r.return_requested) >= sixtyAgo && new Date(r.return_requested) < thirtyAgo);

  // Return rate: needs shopify_orders — query count of orders in range
  let orderCount: number | null = null;
  try {
    let oq = supabase.from('shopify_orders').select('id', { count: 'exact', head: true });
    if (from) oq = oq.gte('created_at', from);
    if (to) oq = oq.lte('created_at', to);
    const { count } = await oq;
    orderCount = count ?? null;
  } catch {
    orderCount = null;
  }
  const returnRate = orderCount && orderCount > 0 ? (totalReturns / orderCount) * 100 : null;

  return NextResponse.json({
    overview: {
      totalReturns,
      totalValue: Math.round(totalValue * 100) / 100,
      avgValue: Math.round(avgValue * 100) / 100,
      avgValueExcZero: Math.round(avgValueExcZero * 100) / 100,
      zeroValueCount,
      rejectionRate: Math.round(rejectionRate * 10) / 10,
      avgItemsPerReturn: Math.round(avgItemsPerReturn * 10) / 10,
      last30Days: recent.length,
      prior30Days: prior.length,
      trend: prior.length > 0 ? Math.round(((recent.length - prior.length) / prior.length) * 100) : 0,
      totalRefunded: Math.round((outcomeValues.refund || 0) * 100) / 100,
      totalCredited: Math.round((outcomeValues.credit || 0) * 100) / 100,
      totalRejected: Math.round((outcomeValues.rejected || 0) * 100) / 100,
      totalLost: Math.round((outcomeValues.lost || 0) * 100) / 100,
      avgDaysToReturn: Math.round(avgDaysToReturn * 10) / 10,
      avgDaysToProcess: Math.round(avgDaysToProcess * 10) / 10,
      orderCount,
      returnRate: returnRate !== null ? Math.round(returnRate * 10) / 10 : null,
    },
    statusCounts,
    outcomeCounts,
    typeCounts,
    monthlyTrend,
    repeatReturners,
    dayOfWeek,
  });
}
