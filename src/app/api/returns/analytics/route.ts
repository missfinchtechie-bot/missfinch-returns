import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getServiceClient();

  const { data: allReturns } = await supabase
    .from('returns')
    .select('status, type, outcome, subtotal, item_count, customer_name, return_requested, is_flagged, imported_from')
    .order('return_requested', { ascending: false });

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

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  returns.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  // Outcome breakdown
  const outcomeCounts: Record<string, number> = {};
  returns.filter(r => r.status === 'done').forEach(r => {
    const key = r.outcome || 'unknown';
    outcomeCounts[key] = (outcomeCounts[key] || 0) + 1;
  });

  // Outcome value totals
  const outcomeValues: Record<string, number> = {};
  returns.filter(r => r.status === 'done').forEach(r => {
    const key = r.outcome || 'unknown';
    outcomeValues[key] = (outcomeValues[key] || 0) + (r.subtotal || 0);
  });

  // Type breakdown
  const typeCounts: Record<string, { count: number; value: number }> = {};
  returns.forEach(r => {
    const t = typeCounts[r.type] || { count: 0, value: 0 };
    t.count++;
    t.value += r.subtotal || 0;
    typeCounts[r.type] = t;
  });

  // Repeat returners
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

  // Day of week pattern
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  returns.forEach(r => {
    if (!r.return_requested) return;
    const dow = new Date(r.return_requested).getDay();
    dowCounts[dow]++;
  });
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, i) => ({
    day: name, count: dowCounts[i],
  }));

  // Overall stats
  const totalReturns = returns.length;
  const totalValue = returns.reduce((s, r) => s + (r.subtotal || 0), 0);
  const avgValue = totalReturns > 0 ? totalValue / totalReturns : 0;
  
  // Avg excluding $0 returns (Redo imports with no value)
  const nonZeroReturns = returns.filter(r => r.subtotal && r.subtotal > 0);
  const avgValueExcZero = nonZeroReturns.length > 0 ? nonZeroReturns.reduce((s, r) => s + r.subtotal, 0) / nonZeroReturns.length : 0;
  const zeroValueCount = returns.filter(r => !r.subtotal || r.subtotal === 0).length;

  const doneReturns = returns.filter(r => r.status === 'done');
  const rejectionRate = doneReturns.length > 0 ? (returns.filter(r => r.outcome === 'rejected').length / doneReturns.length) * 100 : 0;
  const avgItemsPerReturn = totalReturns > 0 ? returns.reduce((s, r) => s + (r.item_count || 0), 0) / totalReturns : 0;

  // 30-day trend
  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyAgo = new Date(now.getTime() - 60 * 86400000);
  const recent = returns.filter(r => r.return_requested && new Date(r.return_requested) >= thirtyAgo);
  const prior = returns.filter(r => r.return_requested && new Date(r.return_requested) >= sixtyAgo && new Date(r.return_requested) < thirtyAgo);

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
    },
    statusCounts,
    outcomeCounts,
    typeCounts,
    monthlyTrend,
    repeatReturners,
    dayOfWeek,
  });
}
