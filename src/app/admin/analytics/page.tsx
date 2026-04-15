'use client';

import { useState, useEffect } from 'react';

type Analytics = {
  overview: {
    totalReturns: number; totalValue: number; avgValue: number; avgValueExcZero: number;
    rejectionRate: number; avgItemsPerReturn: number; zeroValueCount: number;
    last30Days: number; prior30Days: number; trend: number;
    totalRefunded: number; totalCredited: number; totalRejected: number; totalLost: number;
  };
  statusCounts: Record<string, number>;
  outcomeCounts: Record<string, number>;
  typeCounts: Record<string, { count: number; value: number }>;
  monthlyTrend: { month: string; returns: number; value: number; refunds: number; credits: number; exchanges: number }[];
  repeatReturners: { name: string; count: number; value: number }[];
  dayOfWeek: { day: string; count: number }[];
};

const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-block ml-1 cursor-help">
      <span className="text-[10px] text-[var(--muted-foreground)]/60 hover:text-[var(--muted-foreground)] transition-colors">ⓘ</span>
      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[var(--foreground)] text-[var(--background)] text-[11px] px-3 py-2 rounded-lg shadow-xl z-50 leading-relaxed whitespace-normal">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[var(--foreground)]" />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch('/api/auth', { method: 'GET' }).then(r => { if (r.ok) setAuthed(true); }).catch(() => {}); }, []);

  const login = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (res.ok) { setAuthed(true); setPwErr(''); } else setPwErr('Wrong password');
  };

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetch('/api/returns/analytics')
      .then(r => r.json()).then(d => setData(d)).catch(() => {})
      .finally(() => setLoading(false));
  }, [authed]);

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

  if (loading || !data) {
    return (<div className="min-h-screen bg-[var(--background)]"><Header /><div className="text-center py-20 text-[var(--muted-foreground)]">Loading analytics...</div></div>);
  }

  const o = data.overview;
  const maxMonthly = Math.max(1, ...data.monthlyTrend.map(m => m.returns));
  const maxDow = Math.max(1, ...data.dayOfWeek.map(d => d.count));
  const doneTotal = (o.totalRefunded || 0) + (o.totalCredited || 0) + (o.totalRejected || 0) + (o.totalLost || 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">Returns Analytics</h2>

        {/* ─── Overview Cards ─── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Total Returns" value={o.totalReturns.toLocaleString()} formula="COUNT(*) from returns table. Includes all statuses: inbox, shipping, backlog, done." />
          <MetricCard label="Total Value" value={fmtMoney(o.totalValue)} formula={`SUM(subtotal) across all ${o.totalReturns} returns. ${o.zeroValueCount} returns have $0 value (rejected Redo imports with no value captured).`} />
          <MetricCard label="Avg Return" value={`$${o.avgValueExcZero.toFixed(0)}`}
            sub={o.zeroValueCount > 0 ? `excl. ${o.zeroValueCount} at $0` : undefined}
            formula={`AVG(subtotal) WHERE subtotal > 0. Excludes ${o.zeroValueCount} returns with $0 (Redo imports missing value). Including $0s: $${o.avgValue.toFixed(0)}.`} />
          <MetricCard label="Rejection Rate" value={`${o.rejectionRate}%`}
            sub={`${o.totalRejected} of ${doneTotal} completed`}
            formula={`COUNT(outcome='rejected') / COUNT(status='done') × 100. Only counts completed returns (refunded + credited + rejected + lost = ${doneTotal}). Does not include inbox, shipping, or backlog.`} />
          <MetricCard label="Last 30 Days" value={String(o.last30Days)}
            sub={o.trend > 0 ? `↑ ${o.trend}% vs prior 30d` : o.trend < 0 ? `↓ ${Math.abs(o.trend)}% vs prior 30d` : 'Flat vs prior 30d'}
            trend={o.trend}
            formula={`COUNT(*) WHERE return_requested >= 30 days ago. Prior 30 days: ${o.prior30Days}. Trend: (${o.last30Days} - ${o.prior30Days}) / ${o.prior30Days} × 100 = ${o.trend}%. Positive = more returns (bad).`} />
          <MetricCard label="Avg Items" value={o.avgItemsPerReturn.toFixed(1)} sub="per return"
            formula="AVG(item_count) across all returns. Most returns are single-item." />
        </section>

        {/* ─── Outcome Summary ─── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Refunded" value={fmtMoney(o.totalRefunded)} sub={`${data.outcomeCounts.refund || 0} returns`} accent="emerald"
            formula={`SUM(subtotal) WHERE outcome='refund'. Count: ${data.outcomeCounts.refund || 0}. These were refunded to customer's original payment method.`} />
          <MetricCard label="Credited" value={fmtMoney(o.totalCredited)} sub={`${data.outcomeCounts.credit || 0} returns`} accent="emerald"
            formula={`SUM(subtotal) WHERE outcome='credit'. Count: ${data.outcomeCounts.credit || 0}. Issued as Shopify gift cards (store credit).`} />
          <MetricCard label="Rejected" value={fmtMoney(o.totalRejected)} sub={`${data.outcomeCounts.rejected || 0} returns`} accent="red"
            formula={`SUM(subtotal) WHERE outcome='rejected'. Count: ${data.outcomeCounts.rejected || 0}. Customer was denied the return (tags removed, wear, etc).`} />
          <MetricCard label="Lost" value={fmtMoney(o.totalLost)} sub={`${data.outcomeCounts.lost || 0} returns`} accent="purple"
            formula={`SUM(subtotal) WHERE outcome='lost'. Count: ${data.outcomeCounts.lost || 0}. Auto-marked: in transit 45+ days with no delivery confirmation.`} />
        </section>

        {/* ─── Monthly Trend ─── */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Monthly Returns (12 months)</h3>
              <Tooltip text="COUNT(*) grouped by YYYY-MM of return_requested date. Stacked by type: refund (amber), credit (green), exchange (blue). Hover bars for exact numbers." />
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500" /> Refunds</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Credits</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sky-500" /> Exchanges</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-48">
            {data.monthlyTrend.map(m => {
              const total = m.refunds + m.credits + m.exchanges;
              const height = (m.returns / maxMonthly) * 100;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center group relative min-w-0">
                  <div className="w-full flex flex-col justify-end h-full">
                    <div className="w-full rounded-t-sm overflow-hidden flex flex-col" style={{ height: `${height}%` }}>
                      {total > 0 && <div className="w-full bg-amber-500 flex-shrink-0" style={{ flexGrow: m.refunds }} />}
                      {total > 0 && <div className="w-full bg-emerald-500 flex-shrink-0" style={{ flexGrow: m.credits }} />}
                      {total > 0 && <div className="w-full bg-sky-500 flex-shrink-0" style={{ flexGrow: m.exchanges }} />}
                    </div>
                  </div>
                  <div className="hidden group-hover:block absolute bottom-full mb-2 bg-[var(--foreground)] text-[var(--background)] text-[10px] px-3 py-2 rounded-lg whitespace-nowrap z-10 shadow-xl">
                    <div className="font-semibold mb-1">{m.month}</div>
                    <div>{m.returns} returns · {fmtMoney(m.value)}</div>
                    <div className="text-[9px] opacity-80 mt-0.5">{m.refunds} refund · {m.credits} credit · {m.exchanges} exchange</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-[var(--muted-foreground)]">
            <span>{data.monthlyTrend[0]?.month}</span>
            <span>{data.monthlyTrend[data.monthlyTrend.length - 1]?.month}</span>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Type Breakdown ─── */}
          <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center mb-4">
              <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">By Type</h3>
              <Tooltip text="Grouped by returns.type field. 'Refund' = money back to payment method. 'Credit' = store credit (gift card). 'Exchange' = swap for different item (processed as credit)." />
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

          {/* ─── Outcome Breakdown ─── */}
          <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center mb-4">
              <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Outcomes</h3>
              <Tooltip text="Only completed returns (status='done'). Outcome field: refund, credit, rejected, or lost. Percentage = count / total done." />
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

        {/* ─── Day of Week ─── */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center mb-4">
            <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Returns by Day of Week</h3>
            <Tooltip text="EXTRACT(DOW FROM return_requested). Sun=0 through Sat=6. Pattern reflects your Orthodox Jewish customer base — Saturday (Shabbat) is consistently lowest." />
          </div>
          <div className="flex items-end gap-3 h-36">
            {data.dayOfWeek.map((d, i) => {
              const pct = (d.count / maxDow) * 100;
              const isSat = i === 6;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="text-[11px] font-semibold text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</div>
                  <div className={`w-full rounded-t-lg transition-all ${isSat ? 'bg-[var(--ring)]/20' : 'bg-[var(--ring)]/40'} group-hover:bg-[var(--ring)]/70`} style={{ height: `${pct}%` }} />
                  <span className={`text-[11px] font-medium ${isSat ? 'text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}>{d.day}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Repeat Returners ─── */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center">
            <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Repeat Returners (3+ returns)</h3>
            <Tooltip text="GROUP BY customer_name HAVING COUNT(*) >= 3. Sorted by return count desc. Value = SUM(subtotal). Includes all return types and statuses." />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {data.repeatReturners.map((c, i) => (
              <div key={c.name} className={`flex items-center justify-between px-5 py-3 ${i < 3 ? 'bg-red-50/30' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] w-6 h-6 rounded-full flex items-center justify-center font-bold ${i < 3 ? 'bg-red-100 text-red-600' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>{i + 1}</span>
                  <span className="text-sm text-[var(--foreground)] font-medium">{c.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-semibold ${c.count >= 10 ? 'text-red-600' : c.count >= 6 ? 'text-amber-600' : 'text-[var(--foreground)]'}`}>{c.count} returns</span>
                  <span className="text-sm text-[var(--muted-foreground)] w-20 text-right">{fmtMoney(c.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Data Quality Note ─── */}
        <section className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-4">
          <div className="text-[11px] text-amber-700 uppercase tracking-wider font-semibold mb-1">Data Notes</div>
          <div className="text-xs text-amber-700/80 space-y-1">
            <p>{o.zeroValueCount} returns have $0 value — these are rejected Redo imports where the return value was not captured during migration. They are excluded from average calculations but included in counts.</p>
            <p>Return reasons are mostly empty for Redo imports (pre-migration data). New returns submitted via portal will have reasons.</p>
            <p>All data sourced from Supabase returns table ({o.totalReturns} rows). Dates based on return_requested timestamp.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 py-3.5 shadow-sm">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <h1 className="font-heading text-lg sm:text-xl font-semibold italic text-[var(--foreground)]">Miss Finch</h1>
          <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">NYC</span>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <div className="flex items-center gap-0.5 bg-[var(--muted)] rounded-lg p-0.5">
            <a href="/admin" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors">Returns</a>
            <a href="/admin/messages" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors">Messages</a>
            <a href="/admin/financials" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors">Financials</a>
            <span className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-2 sm:px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md">Analytics</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function MetricCard({ label, value, sub, formula, trend, accent }: { label: string; value: string; sub?: string; formula: string; trend?: number; accent?: string }) {
  const accentClasses: Record<string, string> = {
    emerald: 'bg-emerald-50/50 border-emerald-200/60',
    red: 'bg-red-50/50 border-red-200/60',
    purple: 'bg-purple-50/50 border-purple-200/60',
  };
  const valueClasses: Record<string, string> = {
    emerald: 'text-emerald-700',
    red: 'text-red-600',
    purple: 'text-purple-600',
  };
  return (
    <div className={`border rounded-xl p-4 shadow-sm ${accent ? accentClasses[accent] || '' : 'bg-[var(--card)] border-[var(--border)]'}`}>
      <div className="flex items-center">
        <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">{label}</p>
        <Tooltip text={formula} />
      </div>
      <p className={`font-heading text-2xl font-semibold mt-1 ${accent ? valueClasses[accent] || 'text-[var(--foreground)]' : 'text-[var(--foreground)]'}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-1 ${trend !== undefined ? (trend > 0 ? 'text-red-500' : trend < 0 ? 'text-emerald-600' : 'text-[var(--muted-foreground)]') : 'text-[var(--muted-foreground)]'}`}>{sub}</p>}
    </div>
  );
}
