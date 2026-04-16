'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import Nav from '@/components/Nav';
import { MetricCard } from '@/components/MetricCard';
import { Tooltip } from '@/components/Tooltip';
import { DateRangeSelector, rangeFor, PresetKey } from '@/components/DateRangeSelector';

type MoneyFlow = {
  cashRefunded: number; creditsIssued: number; rejectedValue: number;
  feesCollected: number; bonusesGiven: number;
  pendingRefunds: number; pendingCredits: number; backlogOwed: number;
  inTransitValue: number; lostValue: number;
  totalReturnValue: number; totalPaidOut: number; totalKept: number; totalPending: number;
  legacyRefundsNoAmount: number; legacyCreditsNoAmount: number;
  counts: { refund: number; credit: number; rejected: number; lost: number; inbox: number; shipping: number; old: number };
};

type Analytics = {
  overview: {
    totalReturns: number; totalValue: number; avgValue: number; avgValueExcZero: number;
    rejectionRate: number; avgItemsPerReturn: number; zeroValueCount: number;
    last30Days: number; prior30Days: number; trend: number;
    totalRefunded: number; totalCredited: number; totalRejected: number; totalLost: number;
    avgDaysToReturn: number; avgDaysToProcess: number;
    orderCount: number | null; returnRate: number | null;
  };
  statusCounts: Record<string, number>;
  outcomeCounts: Record<string, number>;
  typeCounts: Record<string, { count: number; value: number }>;
  monthlyTrend: { month: string; returns: number; value: number; refunds: number; credits: number; exchanges: number }[];
  repeatReturners: { name: string; count: number; value: number }[];
  dayOfWeek: { day: string; count: number }[];
};

const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

type BusinessAnalytics = {
  revenueTrend: { date: string; revenue: number; orders: number }[];
  customers: { total: number; repeat: number; repeatRate: number; totalOrders: number; totalRevenue: number };
  topProducts: { title: string; units: number; revenue: number; returned: number; returnValue: number; returnRate: number }[];
  returnReasons: { reason: string; count: number }[];
};

const PIE_COLORS = ['#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444', '#ec4899', '#f97316', '#6366f1', '#14b8a6', '#64748b'];

export default function AnalyticsPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [data, setData] = useState<Analytics | null>(null);
  const [money, setMoney] = useState<MoneyFlow | null>(null);
  const [biz, setBiz] = useState<BusinessAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PresetKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    fetch('/api/auth', { method: 'GET' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.role === 'intern') { window.location.href = '/admin/influencers'; return; }
        if (d?.role === 'admin') setAuthed(true);
      })
      .catch(() => {});
  }, []);

  const login = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (!res.ok) { setPwErr('Wrong password'); return; }
    const d = await res.json();
    if (d.role === 'intern') { window.location.href = '/admin/influencers'; return; }
    setAuthed(true); setPwErr('');
  };

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (range) { p.set('from', range.from); p.set('to', range.to); }
    try {
      const [a, m, b] = await Promise.all([
        fetch(`/api/returns/analytics?${p}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/returns/money-flow?${p}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/analytics?${p}`).then(r => r.ok ? r.json() : null),
      ]);
      if (a) setData(a);
      if (m) setMoney(m);
      if (b) setBiz(b);
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { if (authed) fetchData(); }, [authed, fetchData]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-semibold text-[var(--foreground)] tracking-wide">MISS FINCH</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 tracking-widest uppercase">Analytics</p>
          </div>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter password" className="w-full p-4 rounded-xl border border-[var(--border)] text-lg text-center focus:outline-none focus:border-[var(--primary)] bg-[var(--card)]" />
          {pwErr && <p className="text-red-500 text-center text-sm mt-3">{pwErr}</p>}
          <button onClick={login} className="w-full mt-4 p-4 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-base font-semibold hover:opacity-90 transition-opacity">Log In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Nav active="analytics" />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">Returns Analytics</h2>
          <DateRangeSelector preset={preset} onPresetChange={setPreset} customFrom={customFrom} customTo={customTo}
            onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} />
        </div>

        {loading || !data ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">Loading analytics…</div>
        ) : (
          <AnalyticsContent data={data} money={money} biz={biz} />
        )}
      </main>
    </div>
  );
}

function AnalyticsContent({ data, money, biz }: { data: Analytics; money: MoneyFlow | null; biz: BusinessAnalytics | null }) {
  const o = data.overview;
  const doneTotal = (o.totalRefunded || 0) + (o.totalCredited || 0) + (o.totalRejected || 0) + (o.totalLost || 0);
  const maxDow = Math.max(1, ...data.dayOfWeek.map(d => d.count));

  return (
    <>
      {/* ─── BUSINESS ANALYTICS (Shopify data) ─── */}
      {biz && (
        <>
          {/* Revenue Trend */}
          {biz.revenueTrend.length > 0 && (
            <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center mb-4">
                <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Revenue Trend</h3>
                <Tooltip text="Daily revenue from shopify_orders (subtotal_price, excl. cancelled/test). Line = revenue, bars = order count." />
              </div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={biz.revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis yAxisId="rev" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <YAxis yAxisId="ord" orientation="right" stroke="var(--muted-foreground)" fontSize={11} />
                    <RTooltip contentStyle={{ background: 'var(--foreground)', border: 'none', borderRadius: 8, color: 'var(--background)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="Revenue" />
                    <Bar yAxisId="ord" dataKey="orders" fill="#0ea5e9" opacity={0.3} name="Orders" radius={[2, 2, 0, 0]} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Customer Metrics */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Revenue" value={fmtMoney(biz.customers.totalRevenue)} sub={`${biz.customers.totalOrders} orders`} accent="emerald"
              formula="SUM(subtotal_price) from shopify_orders in range, excl. cancelled and test orders." />
            <MetricCard label="Unique Customers" value={String(biz.customers.total)} sub={`${biz.customers.repeat} repeat`}
              formula="COUNT(DISTINCT customer_email) from shopify_orders in range." />
            <MetricCard label="Repeat Rate" value={`${biz.customers.repeatRate}%`} sub={`${biz.customers.repeat} of ${biz.customers.total}`}
              formula="Customers with 2+ orders / total customers × 100." />
            <MetricCard label="Avg Order" value={fmtMoney(biz.customers.totalOrders > 0 ? biz.customers.totalRevenue / biz.customers.totalOrders : 0)} sub="avg subtotal"
              formula="Total revenue / total orders." />
          </section>

          {/* Product Performance */}
          {biz.topProducts.length > 0 && (
            <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center">
                <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Top Products</h3>
                <Tooltip text="Revenue by product from shopify_order_line_items. Return rate = return_items matched by product_name / units sold." />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                      <th className="pl-5 pr-2 py-2 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left">Product</th>
                      <th className="px-2 py-2 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-right">Units</th>
                      <th className="px-2 py-2 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-right">Revenue</th>
                      <th className="px-2 py-2 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-right">Returned</th>
                      <th className="px-2 pr-5 py-2 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-right">Return %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biz.topProducts.slice(0, 15).map((p, i) => (
                      <tr key={p.title} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--muted)]/20' : ''}`}>
                        <td className="pl-5 pr-2 py-2 text-sm text-[var(--foreground)] truncate max-w-[280px]" title={p.title}>{p.title}</td>
                        <td className="px-2 py-2 text-right text-sm tabular-nums">{p.units}</td>
                        <td className="px-2 py-2 text-right text-sm tabular-nums font-semibold">{fmtMoney(p.revenue)}</td>
                        <td className="px-2 py-2 text-right text-sm tabular-nums text-[var(--muted-foreground)]">{p.returned || '—'}</td>
                        <td className={`px-2 pr-5 py-2 text-right text-sm tabular-nums ${p.returnRate >= 30 ? 'text-red-600 font-semibold' : p.returnRate >= 15 ? 'text-amber-700' : 'text-[var(--muted-foreground)]'}`}>
                          {p.returned > 0 ? `${p.returnRate}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Return Reasons */}
          {biz.returnReasons.length > 0 && (
            <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center mb-4">
                <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Return Reasons</h3>
                <Tooltip text="Grouped by returns.reason. 'Not specified' = no reason given (most Redo imports)." />
              </div>
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div style={{ width: 220, height: 220 }} className="mx-auto lg:mx-0 flex-shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={biz.returnReasons} dataKey="count" nameKey="reason" cx="50%" cy="50%" outerRadius={90} innerRadius={40} paddingAngle={2}>
                        {biz.returnReasons.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RTooltip contentStyle={{ background: 'var(--foreground)', border: 'none', borderRadius: 8, color: 'var(--background)', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {biz.returnReasons.map((r, i) => {
                    const total = biz.returnReasons.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? (r.count / total) * 100 : 0;
                    return (
                      <div key={r.reason} className="flex items-center gap-3 text-sm">
                        <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="flex-1 truncate text-[var(--foreground)]">{r.reason}</span>
                        <span className="text-[var(--muted-foreground)] tabular-nums">{r.count}</span>
                        <span className="text-[var(--muted-foreground)] tabular-nums w-12 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Separator between business analytics and returns analytics */}
          <div className="border-t-2 border-[var(--border)] pt-2">
            <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Returns Analytics</div>
          </div>
        </>
      )}

      {/* Overview Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Returns" value={o.totalReturns.toLocaleString()} formula="COUNT(*) from returns table for the selected date range, filtered by return_requested." />
        <MetricCard label="Total Value" value={fmtMoney(o.totalValue)} formula={`SUM(subtotal) across ${o.totalReturns} returns. ${o.zeroValueCount} returns have $0 value (Redo imports).`} />
        <MetricCard label="Avg Return" value={`$${o.avgValueExcZero.toFixed(0)}`}
          sub={o.zeroValueCount > 0 ? `excl. ${o.zeroValueCount} at $0` : undefined}
          formula={`AVG(subtotal) WHERE subtotal > 0. Excludes ${o.zeroValueCount} $0 returns. Including $0s: $${o.avgValue.toFixed(0)}.`} />
        <MetricCard label="Rejection Rate" value={`${o.rejectionRate}%`}
          sub={`${data.outcomeCounts.rejected || 0} of ${doneTotal > 0 ? Object.values(data.outcomeCounts).reduce((s, c) => s + c, 0) : 0} completed`}
          formula={`COUNT(outcome='rejected') / COUNT(status='done') × 100. Only counts completed returns.`} />
        <MetricCard label="Last 30 Days" value={String(o.last30Days)}
          sub={o.trend > 0 ? `↑ ${o.trend}% vs prior 30d` : o.trend < 0 ? `↓ ${Math.abs(o.trend)}% vs prior 30d` : 'Flat vs prior 30d'}
          trend={o.trend}
          formula={`Returns in last 30 days vs prior 30 days. Based on return_requested. Positive trend = more returns (bad).`} />
        <MetricCard label="Avg Items" value={o.avgItemsPerReturn.toFixed(1)} sub="per return"
          formula="AVG(item_count) across all returns in range." />
      </section>

      {/* Timing Metrics */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Avg Days to Return" value={o.avgDaysToReturn > 0 ? `${o.avgDaysToReturn}d` : '—'} sub="from delivery to request"
          formula="AVG(return_requested - delivered_to_customer) for returns with both dates. Excludes outliers >365 days." />
        <MetricCard label="Avg Days to Process" value={o.avgDaysToProcess > 0 ? `${o.avgDaysToProcess}d` : '—'} sub="from arrival to decision"
          formula="AVG(processed_at - delivered_to_us) for returns with both dates. Measures how fast you close out returns after they arrive." />
        <MetricCard label="Return Rate" value={o.returnRate !== null ? `${o.returnRate}%` : '—'}
          sub={o.orderCount !== null ? `${o.totalReturns} of ${o.orderCount} orders` : 'Sync Shopify to enable'}
          formula={o.orderCount !== null ? `returns / shopify_orders × 100 in the selected range.` : 'Requires shopify_orders sync. Run Sync on Financials page.'} />
        <MetricCard label="Completed" value={`${doneTotal > 0 ? Object.values(data.outcomeCounts).reduce((s, c) => s + c, 0) : 0}`}
          sub={`${fmtMoney(doneTotal)} value`}
          formula={`COUNT(status='done'): returns that have been refunded, credited, rejected, or marked lost.`} />
      </section>

      {/* Outcome Summary */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Refunded" value={fmtMoney(o.totalRefunded)} sub={`${data.outcomeCounts.refund || 0} returns`} accent="emerald"
          formula={`SUM(subtotal) WHERE outcome='refund'.`} />
        <MetricCard label="Credited" value={fmtMoney(o.totalCredited)} sub={`${data.outcomeCounts.credit || 0} returns`} accent="emerald"
          formula={`SUM(subtotal) WHERE outcome='credit'. Issued as Shopify gift cards.`} />
        <MetricCard label="Rejected" value={fmtMoney(o.totalRejected)} sub={`${data.outcomeCounts.rejected || 0} returns`} accent="red"
          formula={`SUM(subtotal) WHERE outcome='rejected'.`} />
        <MetricCard label="Lost" value={fmtMoney(o.totalLost)} sub={`${data.outcomeCounts.lost || 0} returns`} accent="purple"
          formula={`SUM(subtotal) WHERE outcome='lost'. Auto-marked: in transit 45+ days with no delivery.`} />
      </section>

      {money && <MoneyFlowSection m={money} />}

      {/* Monthly Trend */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center">
            <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Monthly Returns</h3>
            <Tooltip text="Grouped by YYYY-MM of return_requested. Stacked by type: refund (amber), credit (green), exchange (blue)." />
          </div>
        </div>
        {data.monthlyTrend.length === 0 ? (
          <p className="text-[var(--muted-foreground)] text-sm py-12 text-center">No data in this range.</p>
        ) : (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <RTooltip contentStyle={{ background: 'var(--foreground)', border: 'none', borderRadius: 8, color: 'var(--background)', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="refunds" stackId="a" fill="#f59e0b" name="Refunds" />
                <Bar dataKey="credits" stackId="a" fill="#10b981" name="Credits" />
                <Bar dataKey="exchanges" stackId="a" fill="#0ea5e9" name="Exchanges" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Breakdown */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center mb-4">
            <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">By Type</h3>
            <Tooltip text="Grouped by returns.type. 'Refund' = money back. 'Credit' = store credit. 'Exchange' = swap, processed as credit." />
          </div>
          <div className="space-y-3">
            {Object.entries(data.typeCounts).sort((a, b) => b[1].count - a[1].count).map(([type, d]) => {
              const pct = o.totalReturns > 0 ? (d.count / o.totalReturns) * 100 : 0;
              const colors: Record<string, string> = { refund: 'bg-amber-500', credit: 'bg-emerald-500', exchange: 'bg-sky-500' };
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[var(--foreground)] font-medium capitalize">{type}</span>
                    <span className="text-[var(--muted-foreground)]">{d.count} ({pct.toFixed(0)}%) · {fmtMoney(d.value)}</span>
                  </div>
                  <div className="h-2.5 w-full bg-[var(--muted)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[type] || 'bg-stone-400'} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Outcome Breakdown */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center mb-4">
            <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Outcomes</h3>
            <Tooltip text="Only completed returns (status='done'). Outcome: refund, credit, rejected, or lost." />
          </div>
          <div className="space-y-3">
            {Object.entries(data.outcomeCounts).sort((a, b) => b[1] - a[1]).map(([outcome, count]) => {
              const total = Object.values(data.outcomeCounts).reduce((s, c) => s + c, 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              const colors: Record<string, string> = { refund: 'bg-amber-500', credit: 'bg-emerald-500', rejected: 'bg-red-400', lost: 'bg-purple-400' };
              return (
                <div key={outcome}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[var(--foreground)] font-medium capitalize">{outcome}</span>
                    <span className="text-[var(--muted-foreground)]">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2.5 w-full bg-[var(--muted)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[outcome] || 'bg-stone-400'} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Day of Week */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center mb-4">
          <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Returns by Day of Week</h3>
          <Tooltip text="EXTRACT(DOW FROM return_requested). Saturday is lowest — Shabbat effect from Orthodox Jewish customer base." />
        </div>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={data.dayOfWeek} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <RTooltip contentStyle={{ background: 'var(--foreground)', border: 'none', borderRadius: 8, color: 'var(--background)', fontSize: 12 }} />
              <Bar dataKey="count" fill="#8b7355" radius={[6, 6, 0, 0]} name="Returns" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] text-[var(--muted-foreground)] mt-2">Peak: {data.dayOfWeek.reduce((a, b) => a.count > b.count ? a : b, data.dayOfWeek[0])?.day} · Low: {data.dayOfWeek.reduce((a, b) => a.count < b.count ? a : b, data.dayOfWeek[0])?.day} · Max {maxDow}</div>
      </section>

      {/* Repeat Returners */}
      <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center">
          <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Repeat Returners (3+ returns)</h3>
          <Tooltip text="GROUP BY customer_name HAVING COUNT(*) >= 3. Click a name to filter the returns dashboard." />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {data.repeatReturners.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--muted-foreground)]">No repeat returners in this range.</div>
          ) : data.repeatReturners.map((c, i) => (
            <a key={c.name} href={`/admin?customer=${encodeURIComponent(c.name)}`}
              className={`flex items-center justify-between px-5 py-3 hover:bg-[var(--accent)]/40 transition-colors ${i < 3 ? 'bg-red-50/30' : ''}`}>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] w-6 h-6 rounded-full flex items-center justify-center font-bold ${i < 3 ? 'bg-red-100 text-red-600' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>{i + 1}</span>
                <span className="text-sm text-[var(--foreground)] font-medium">{c.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-semibold ${c.count >= 10 ? 'text-red-600' : c.count >= 6 ? 'text-amber-600' : 'text-[var(--foreground)]'}`}>{c.count} returns</span>
                <span className="text-sm text-[var(--muted-foreground)] w-20 text-right">{fmtMoney(c.value)}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Data Quality Note */}
      <section className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4">
        <div className="text-[11px] text-amber-700 uppercase tracking-wider font-semibold mb-1">Data Notes</div>
        <div className="text-xs text-amber-700/80 space-y-1">
          <p>{o.zeroValueCount} returns in this range have $0 value — these are rejected Redo imports where value wasn&apos;t captured during migration. They&apos;re excluded from average calculations but included in counts.</p>
          {o.orderCount === null && <p>Return Rate is unavailable — Shopify orders haven&apos;t been synced. Go to Financials → Sync Now to enable.</p>}
        </div>
      </section>
    </>
  );
}

function MoneyFlowSection({ m }: { m: MoneyFlow }) {
  const total = m.totalReturnValue || 1;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  const rows: { label: string; value: number; tone: 'red' | 'green' | 'amber' | 'purple' | 'muted'; formula: string; indent?: boolean }[] = [
    { label: 'Paid Out', value: m.totalPaidOut, tone: 'red', formula: 'cashRefunded + creditsIssued. Money that left your Shopify (refunds) or became liability (credits).' },
    { label: 'Cash Refunded', value: m.cashRefunded, tone: 'red', indent: true, formula: 'SUM(final_amount) WHERE outcome=refund. Falls back to subtotal for pre-Apr 2026 records without final_amount.' },
    { label: 'Credits Issued', value: m.creditsIssued, tone: 'red', indent: true, formula: 'SUM(final_amount) WHERE outcome=credit. Gift cards issued to customers. Still your liability.' },
    { label: 'Kept', value: m.totalKept, tone: 'green', formula: 'rejectedValue + feesCollected. Revenue you didn\'t have to return.' },
    { label: 'Rejected Returns', value: m.rejectedValue, tone: 'green', indent: true, formula: `SUM(subtotal) WHERE outcome=rejected. ${m.counts.rejected} returns denied — money stays with you.` },
    { label: 'Restocking Fees', value: m.feesCollected, tone: 'green', indent: true, formula: 'SUM(total_fees) WHERE outcome=refund. For older records falls back to (subtotal − final_amount). 5% on refunds.' },
    { label: 'Pending', value: m.totalPending, tone: 'amber', formula: 'pendingRefunds + pendingCredits + backlogOwed. Money you still might owe.' },
    { label: 'Action Needed (inbox)', value: m.pendingRefunds + m.pendingCredits, tone: 'amber', indent: true, formula: `SUM(subtotal) WHERE status=inbox. ${m.counts.inbox} returns delivered and ready to process.` },
    { label: 'Backlog (30+ days)', value: m.backlogOwed, tone: 'amber', indent: true, formula: `SUM(subtotal) WHERE status=old. ${m.counts.old} stale returns that should have been processed.` },
    { label: 'In Transit', value: m.inTransitValue, tone: 'amber', indent: true, formula: `SUM(subtotal) WHERE status=shipping. ${m.counts.shipping} packages on the way back to you.` },
    { label: 'Lost', value: m.lostValue, tone: 'purple', formula: `SUM(subtotal) WHERE outcome=lost. ${m.counts.lost} auto-marked after 45+ days in transit with no delivery.` },
  ];

  const toneCls = (t: 'red' | 'green' | 'amber' | 'purple' | 'muted'): string => ({
    red: 'text-red-600',
    green: 'text-emerald-600',
    amber: 'text-amber-700',
    purple: 'text-purple-600',
    muted: 'text-[var(--muted-foreground)]',
  }[t]);

  const barCls = (t: 'red' | 'green' | 'amber' | 'purple' | 'muted'): string => ({
    red: 'bg-red-400',
    green: 'bg-emerald-400',
    amber: 'bg-amber-400',
    purple: 'bg-purple-400',
    muted: 'bg-stone-300',
  }[t]);

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center">
          <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Money Flow</h3>
          <Tooltip text="Where every dollar of return value actually goes: paid back to customers, kept by you, still pending, or lost." />
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">
          Total Return Value: <span className="font-semibold text-[var(--foreground)]">{fmt(m.totalReturnValue)}</span>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const p = (r.value / total) * 100;
          return (
            <div key={i} className={`flex items-center gap-3 py-2 ${r.indent ? 'pl-6' : 'border-t border-[var(--border)] first:border-t-0 pt-3'}`}>
              <div className={`text-sm flex-shrink-0 ${r.indent ? 'w-44' : 'w-44 font-semibold'} text-[var(--foreground)] flex items-center`}>
                {r.label}
                <Tooltip text={r.formula} />
              </div>
              <div className="flex-1 h-2 bg-[var(--muted)] rounded-full overflow-hidden min-w-[60px]">
                <div className={`h-full ${barCls(r.tone)} rounded-full transition-all`} style={{ width: `${Math.min(100, p)}%` }} />
              </div>
              <div className={`text-sm font-semibold ${toneCls(r.tone)} w-28 text-right tabular-nums`}>
                {fmt(r.value)}
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)] w-14 text-right tabular-nums">{pct(r.value)}</div>
            </div>
          );
        })}
      </div>

      {(m.legacyRefundsNoAmount > 0 || m.legacyCreditsNoAmount > 0) && (
        <div className="mt-4 text-[11px] text-amber-700 bg-amber-50/50 border border-amber-200/60 rounded-lg px-3 py-2">
          <b>Data note:</b> {m.legacyRefundsNoAmount} refunds and {m.legacyCreditsNoAmount} credits have no final_amount recorded
          (pre-April 2026, before the fee engine was wired up). Subtotal is used as the estimate for those — fees and bonuses
          will be under-counted for older returns.
        </div>
      )}
    </section>
  );
}
