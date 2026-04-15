'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Summary = {
  grossRevenue: number;
  netRevenue: number;
  totalRevenue: number;
  discounts: number;
  shipping: number;
  tax: number;
  refundTotal: number;
  refundRate: number;
  orderCount: number;
  aov: number;
  shopifyFees: number;
};

type DailyPoint = { date: string; revenue: number; orders: number; refunds: number; fees: number };

type OverviewResponse = {
  range: { from: string; to: string };
  summary: Summary;
  daily: DailyPoint[];
};

type PresetKey = 'today' | 'week' | 'month' | 'last_month' | '90d' | 'custom';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'custom', label: 'Custom' },
];

function rangeFor(preset: PresetKey, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (preset === 'today') {
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (preset === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: startOfDay(start).toISOString(), to: endOfDay(end).toISOString() };
  }
  if (preset === '90d') {
    const start = new Date(now); start.setDate(now.getDate() - 90);
    return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() };
  }
  return {
    from: customFrom ? new Date(customFrom).toISOString() : startOfDay(now).toISOString(),
    to: customTo ? endOfDay(new Date(customTo)).toISOString() : endOfDay(now).toISOString(),
  };
}

const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtMoneyCents = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default function FinancialsPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [preset, setPreset] = useState<PresetKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { fetch('/api/auth', { method: 'GET' }).then(r => { if (r.ok) setAuthed(true); }).catch(() => {}); }, []);

  const login = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (res.ok) { setAuthed(true); setPwErr(''); } else setPwErr('Wrong password');
  };

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/financials/overview?${p}`);
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, [range.from, range.to]);

  useEffect(() => { if (authed) fetchOverview(); }, [authed, fetchOverview]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const sync = async (days: number) => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/financials/sync?days=${days}`);
      const json = await res.json();
      if (json.success) { showToast(`Synced ${json.orders} orders, ${json.refunds} refunds, ${json.transactions} fees`); await fetchOverview(); }
      else showToast(`Sync failed: ${json.error}`);
    } catch (e) { showToast(`Sync error: ${e instanceof Error ? e.message : 'unknown'}`); }
    finally { setSyncing(false); }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-semibold text-[var(--foreground)] tracking-wide">MISS FINCH</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 tracking-widest uppercase">Financials</p>
          </div>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter password" className="w-full p-4 rounded-xl border border-[var(--border)] text-lg text-center focus:outline-none focus:border-[var(--primary)] bg-[var(--card)]" />
          {pwErr && <p className="text-red-500 text-center text-sm mt-3">{pwErr}</p>}
          <button onClick={login} className="w-full mt-4 p-4 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-base font-semibold hover:opacity-90 transition-opacity">Log In</button>
        </div>
      </div>
    );
  }

  const s = data?.summary;
  const daily = data?.daily || [];
  const maxBar = Math.max(1, ...daily.map(d => Math.max(d.revenue, d.refunds)));

  // Mock data for sections not yet wired up
  const mockAdSpend = { meta: 4820, google: 3150, totalSpend: 7970, metaRoas: 3.2, googleRoas: 2.8, blendedRoas: 3.0, blendedCac: 42 };
  const mockExpenses = [
    { category: 'Ad Spend', amount: 7970, pct: 48 },
    { category: 'Shopify Fees', amount: s?.shopifyFees || 890, pct: 11 },
    { category: 'Shipping', amount: 1240, pct: 8 },
    { category: 'Apps & Tools', amount: 896, pct: 5 },
    { category: 'Redo (Returns)', amount: 596, pct: 4 },
    { category: 'Rent & Office', amount: 2800, pct: 17 },
    { category: 'Owner Draw', amount: 3500, pct: 21 },
  ];
  const mockCogs = 6200;
  const netRev = s?.netRevenue || 0;
  const grossMargin = netRev - mockCogs;
  const totalExpenses = mockExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossMargin - totalExpenses + (s?.shopifyFees || 0); // shopify fees already in expenses

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--primary-foreground)] px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}

      <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <h1 className="font-heading text-lg sm:text-xl font-semibold italic text-[var(--foreground)]">Miss Finch</h1>
            <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">NYC</span>
            <span className="mx-1 h-5 w-px bg-[var(--border)]" />
            <div className="flex items-center gap-0.5 bg-[var(--muted)] rounded-lg p-0.5">
              <a href="/admin" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors">Returns</a>
              <a href="/admin/messages" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors">Messages</a>
              <span className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-2 sm:px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md">Financials</span>
            </div>
          </div>
          <button onClick={() => sync(30)} disabled={syncing}
            className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-3 sm:px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity">
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Date picker */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">Financial Overview</h2>
            <button onClick={() => sync(90)} disabled={syncing}
              className="text-[11px] tracking-wider uppercase text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50">Backfill 90d</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-2">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => setPreset(p.key)}
                className={`text-[11px] sm:text-xs tracking-wider uppercase px-3 py-1.5 rounded-md transition-colors ${preset === p.key ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}>
                {p.label}
              </button>
            ))}
            {preset === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="text-xs px-2 py-1 border border-[var(--border)] rounded-md bg-[var(--card)]" />
                <span className="text-[var(--muted-foreground)] text-xs">→</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="text-xs px-2 py-1 border border-[var(--border)] rounded-md bg-[var(--card)]" />
              </div>
            )}
          </div>
        </section>

        {loading && !s && <p className="text-[var(--muted-foreground)] text-sm py-12 text-center">Loading…</p>}

        {s && (
          <>
            {/* ─── Revenue Cards ─── */}
            <section>
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Revenue</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card label="Net Revenue" value={fmtMoney(s.netRevenue)} sub={`${s.orderCount} orders`} accent />
                <Card label="Gross Revenue" value={fmtMoney(s.grossRevenue)} sub="Before refunds" />
                <Card label="Refunds" value={fmtMoney(s.refundTotal)} sub={fmtPct(s.refundRate)} negative />
                <Card label="Avg Order" value={fmtMoneyCents(s.aov)} sub="Including tax + ship" />
                <Card label="Discounts" value={fmtMoney(s.discounts)} sub="Codes + promos" negative />
                <Card label="Shipping" value={fmtMoney(s.shipping)} sub="Collected from customers" />
              </div>
            </section>

            {/* ─── Revenue Chart ─── */}
            <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Daily Revenue vs Refunds</h3>
                <div className="flex items-center gap-3 text-[11px] text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Revenue</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-400" /> Refunds</span>
                </div>
              </div>
              {daily.length === 0 ? (
                <p className="text-[var(--muted-foreground)] text-sm py-12 text-center">No data in this range. Try &quot;Sync Now&quot; or a wider window.</p>
              ) : (
                <div className="flex items-end gap-1 h-48">
                  {daily.map(d => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative min-w-0">
                      <div className="w-full flex items-end gap-0.5 h-full">
                        <div className="flex-1 bg-emerald-500 rounded-t-sm min-h-[1px]" style={{ height: `${(d.revenue / maxBar) * 100}%` }} />
                        <div className="flex-1 bg-red-400 rounded-t-sm min-h-[1px]" style={{ height: `${(d.refunds / maxBar) * 100}%` }} />
                      </div>
                      <div className="hidden group-hover:block absolute bottom-full mb-2 bg-[var(--foreground)] text-[var(--background)] text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {d.date}: {fmtMoney(d.revenue)} / {fmtMoney(d.refunds)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {daily.length > 0 && (
                <div className="flex justify-between mt-2 text-[10px] text-[var(--muted-foreground)]">
                  <span>{daily[0].date}</span>
                  <span>{daily[daily.length - 1].date}</span>
                </div>
              )}
            </section>

            {/* ─── Ad Spend (mock) ─── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Ad Spend</div>
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200/80 px-2 py-0.5 rounded-lg font-semibold">Mock Data</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card label="Meta Ads" value={fmtMoney(mockAdSpend.meta)} sub={`${mockAdSpend.metaRoas}x ROAS`} />
                <Card label="Google Ads" value={fmtMoney(mockAdSpend.google)} sub={`${mockAdSpend.googleRoas}x ROAS`} />
                <Card label="Total Spend" value={fmtMoney(mockAdSpend.totalSpend)} sub={`${mockAdSpend.blendedRoas}x blended`} negative />
                <Card label="Blended CAC" value={`$${mockAdSpend.blendedCac}`} sub={`${s.orderCount} orders`} />
              </div>
            </section>

            {/* ─── Expenses (mock) ─── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Expenses</div>
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200/80 px-2 py-0.5 rounded-lg font-semibold">Mock Data</span>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                {mockExpenses.map((e, i) => (
                  <div key={e.category} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[var(--foreground)] font-medium">{e.category}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-2 bg-[var(--muted)] rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full bg-[var(--ring)] rounded-full" style={{ width: `${Math.min(e.pct * 2, 100)}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-[var(--foreground)] w-20 text-right">{fmtMoney(e.amount)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 border-t-2 border-[var(--foreground)]/10 bg-[var(--muted)]">
                  <span className="text-sm text-[var(--foreground)] font-bold">Total Expenses</span>
                  <span className="text-sm font-bold text-[var(--foreground)]">{fmtMoney(totalExpenses)}</span>
                </div>
              </div>
            </section>

            {/* ─── P&L Summary (mock) ─── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Profit & Loss</div>
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200/80 px-2 py-0.5 rounded-lg font-semibold">Mock Data</span>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                <PLRow label="Net Revenue" value={netRev} bold />
                <PLRow label="Cost of Goods Sold" value={-mockCogs} />
                <div className="border-t border-[var(--border)]" />
                <PLRow label="Gross Margin" value={grossMargin} bold sub={`${((grossMargin / netRev) * 100).toFixed(1)}% margin`} />
                <PLRow label="Ad Spend (Meta + Google)" value={-mockAdSpend.totalSpend} />
                <PLRow label="Shopify Fees" value={-(s.shopifyFees || 0)} />
                <PLRow label="Shipping Costs" value={-1240} />
                <PLRow label="Apps & Tools" value={-896} />
                <PLRow label="Redo (Returns)" value={-596} />
                <PLRow label="Rent & Office" value={-2800} />
                <PLRow label="Owner Draw" value={-3500} />
                <div className="border-t-2 border-[var(--foreground)]/20" />
                <PLRow label="Net Profit" value={netProfit} bold accent />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ label, value, sub, accent, negative }: { label: string; value: string; sub?: string; accent?: boolean; negative?: boolean }) {
  return (
    <div className={`border rounded-xl p-4 shadow-sm ${accent ? 'bg-emerald-50/50 border-emerald-200/60' : 'bg-[var(--card)] border-[var(--border)]'}`}>
      <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">{label}</p>
      <p className={`font-heading text-2xl font-semibold mt-1 ${negative ? 'text-red-600' : accent ? 'text-emerald-700' : 'text-[var(--foreground)]'}`}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--muted-foreground)] mt-1">{sub}</p>}
    </div>
  );
}

function PLRow({ label, value, bold, sub, accent }: { label: string; value: number; bold?: boolean; sub?: string; accent?: boolean }) {
  const isNeg = value < 0;
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className={`text-sm ${bold ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>{label}</span>
        {sub && <span className="text-[11px] text-[var(--muted-foreground)] ml-2">{sub}</span>}
      </div>
      <span className={`text-sm font-semibold ${accent ? (value >= 0 ? 'text-emerald-600' : 'text-red-600') : isNeg ? 'text-red-500' : 'text-[var(--foreground)]'}`}>
        {isNeg ? `-${fmtMoney(Math.abs(value))}` : fmtMoney(value)}
      </span>
    </div>
  );
}
