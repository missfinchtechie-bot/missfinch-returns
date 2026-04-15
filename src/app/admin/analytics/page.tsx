'use client';

import { useState, useEffect } from 'react';

type Analytics = {
  overview: {
    totalReturns: number; totalValue: number; avgValue: number;
    rejectionRate: number; avgItemsPerReturn: number;
    last30Days: number; prior30Days: number; trend: number;
  };
  statusCounts: Record<string, number>;
  outcomeCounts: Record<string, number>;
  typeCounts: Record<string, { count: number; value: number }>;
  monthlyTrend: { month: string; returns: number; value: number; refunds: number; credits: number; exchanges: number }[];
  repeatReturners: { name: string; count: number; value: number }[];
  dayOfWeek: { day: string; count: number }[];
};

const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

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
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
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
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <Header />
        <div className="text-center py-20 text-[var(--muted-foreground)]">Loading analytics...</div>
      </div>
    );
  }

  const o = data.overview;
  const maxMonthly = Math.max(1, ...data.monthlyTrend.map(m => m.returns));
  const maxDow = Math.max(1, ...data.dayOfWeek.map(d => d.count));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">Returns Analytics</h2>

        {/* ─── Overview Cards ─── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card label="Total Returns" value={o.totalReturns.toLocaleString()} />
          <Card label="Total Value" value={fmtMoney(o.totalValue)} />
          <Card label="Avg Return" value={`$${o.avgValue.toFixed(0)}`} />
          <Card label="Rejection Rate" value={`${o.rejectionRate}%`} sub={`${data.outcomeCounts.rejected || 0} rejected`} />
          <Card label="Last 30 Days" value={String(o.last30Days)} sub={o.trend > 0 ? `↑ ${o.trend}%` : o.trend < 0 ? `↓ ${Math.abs(o.trend)}%` : 'Flat'} trend={o.trend} />
          <Card label="Avg Items" value={o.avgItemsPerReturn.toFixed(1)} sub="per return" />
        </section>

        {/* ─── Monthly Trend ─── */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Monthly Returns (12 months)</h3>
            <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500" /> Refunds</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Credits</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sky-500" /> Exchanges</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-48">
            {data.monthlyTrend.map(m => {
              const total = m.refunds + m.credits + m.exchanges;
              const refPct = total > 0 ? (m.refunds / total) * 100 : 0;
              const crPct = total > 0 ? (m.credits / total) * 100 : 0;
              const exPct = total > 0 ? (m.exchanges / total) * 100 : 0;
              const height = (m.returns / maxMonthly) * 100;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center group relative min-w-0">
                  <div className="w-full flex flex-col h-full justify-end">
                    <div className="w-full rounded-t-sm overflow-hidden" style={{ height: `${height}%` }}>
                      <div className="w-full bg-amber-500" style={{ height: `${refPct}%` }} />
                      <div className="w-full bg-emerald-500" style={{ height: `${crPct}%` }} />
                      <div className="w-full bg-sky-500" style={{ height: `${exPct}%` }} />
                    </div>
                  </div>
                  <div className="hidden group-hover:block absolute bottom-full mb-2 bg-[var(--foreground)] text-[var(--background)] text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                    {m.month}: {m.returns} returns · {fmtMoney(m.value)}
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
            <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-4">By Type</h3>
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
                    <div className="h-2 w-full bg-[var(--muted)] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[type] || 'bg-stone-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ─── Outcome Breakdown ─── */}
          <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-4">Outcomes (Completed Returns)</h3>
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
                    <div className="h-2 w-full bg-[var(--muted)] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[outcome] || 'bg-stone-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ─── Day of Week ─── */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-4">Returns by Day of Week</h3>
          <div className="flex items-end gap-3 h-32">
            {data.dayOfWeek.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-[var(--ring)]/30 rounded-t-md" style={{ height: `${(d.count / maxDow) * 100}%` }}>
                  <div className="w-full h-full bg-[var(--ring)] rounded-t-md opacity-60 hover:opacity-100 transition-opacity" />
                </div>
                <span className="text-[11px] text-[var(--muted-foreground)] font-medium">{d.day}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">{d.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Repeat Returners ─── */}
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Repeat Returners (3+ returns)</h3>
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

function Card({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm">
      <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">{label}</p>
      <p className="font-heading text-2xl font-semibold text-[var(--foreground)] mt-1">{value}</p>
      {sub && <p className={`text-[11px] mt-1 ${trend !== undefined ? (trend > 0 ? 'text-red-500' : trend < 0 ? 'text-emerald-600' : 'text-[var(--muted-foreground)]') : 'text-[var(--muted-foreground)]'}`}>{sub}</p>}
    </div>
  );
}
