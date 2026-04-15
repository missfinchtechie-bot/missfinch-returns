'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Nav from '@/components/Nav';
import { MetricCard } from '@/components/MetricCard';
import { Tooltip } from '@/components/Tooltip';
import { DateRangeSelector, rangeFor, PresetKey } from '@/components/DateRangeSelector';

type MoneyFlow = {
  cashRefunded: number; creditsIssued: number; rejectedValue: number;
  feesCollected: number; bonusesGiven: number;
  totalReturnValue: number; totalPaidOut: number; totalKept: number;
};

type Summary = {
  grossRevenue: number; netRevenue: number; totalRevenue: number;
  discounts: number; shipping: number; tax: number;
  refundTotal: number; refundRate: number; orderCount: number; aov: number; shopifyFees: number;
};
type DailyPoint = { date: string; revenue: number; orders: number; refunds: number; fees: number };
type OverviewResponse = { range: { from: string; to: string }; summary: Summary; daily: DailyPoint[]; lastSynced: string | null };

const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtMoneyCents = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function fmtSynced(iso: string | null): string {
  if (!iso) return 'Never synced';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function FinancialsPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [preset, setPreset] = useState<PresetKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [money, setMoney] = useState<MoneyFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');
  const [plOpen, setPlOpen] = useState(true);

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

  const range = useMemo(() => {
    const r = rangeFor(preset, customFrom, customTo);
    if (!r) {
      const now = new Date();
      const start = new Date(now); start.setDate(now.getDate() - 365);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    return r;
  }, [preset, customFrom, customTo]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ from: range.from, to: range.to });
      const [ovRes, mfRes] = await Promise.all([
        fetch(`/api/financials/overview?${p}`),
        fetch(`/api/returns/money-flow?${p}`),
      ]);
      if (ovRes.ok) setData(await ovRes.json());
      if (mfRes.ok) setMoney(await mfRes.json());
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

  const mockAdSpend = { meta: 4820, google: 3150, totalSpend: 7970, metaRoas: 3.2, googleRoas: 2.8, blendedRoas: 3.0, blendedCac: 42 };
  const mockExpenses = [
    { category: 'Ad Spend', amount: 7970 },
    { category: 'Shopify Fees', amount: s?.shopifyFees || 890 },
    { category: 'Shipping', amount: 1240 },
    { category: 'Apps & Tools', amount: 896 },
    { category: 'Redo (Returns)', amount: 596 },
    { category: 'Rent & Office', amount: 2800 },
    { category: 'Owner Draw', amount: 3500 },
  ];
  const mockCogs = 6200;
  const netRev = s?.netRevenue || 0;
  const grossMargin = netRev - mockCogs;
  const totalExpenses = mockExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossMargin - totalExpenses;

  const syncButton = (
    <button onClick={() => sync(30)} disabled={syncing}
      className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-3 sm:px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity inline-flex items-center gap-2">
      {syncing && <span className="w-3 h-3 border-2 border-[var(--primary-foreground)]/30 border-t-[var(--primary-foreground)] rounded-full animate-spin" />}
      {syncing ? 'Syncing…' : 'Sync Now'}
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--primary-foreground)] px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}
      <Nav active="financials" right={syncButton} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">Financial Overview</h2>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Last synced: {fmtSynced(data?.lastSynced || null)}</p>
            </div>
            <button onClick={() => sync(90)} disabled={syncing}
              className="text-[11px] tracking-wider uppercase text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50">Backfill 90d</button>
          </div>
          <DateRangeSelector preset={preset} onPresetChange={setPreset} customFrom={customFrom} customTo={customTo}
            onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} includeAll={false} />
        </section>

        {loading && !s && <p className="text-[var(--muted-foreground)] text-sm py-12 text-center">Loading…</p>}

        {s && (
          <>
            {/* Revenue Cards */}
            <section>
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Revenue</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard label="Net Revenue" value={fmtMoney(s.netRevenue)} sub={`${s.orderCount} orders`} accent="emerald"
                  formula="grossRevenue − refunds. Net revenue is what you actually kept after processing returns." />
                <MetricCard label="Gross Revenue" value={fmtMoney(s.grossRevenue)} sub="Before refunds"
                  formula="SUM(subtotal_price) across all non-cancelled, non-test orders in range. Excludes tax and shipping." />
                <MetricCard label="Refunds" value={fmtMoney(s.refundTotal)} sub={fmtPct(s.refundRate)} negative
                  formula="SUM(amount) from shopify_refunds in range. Rate = refunds / grossRevenue × 100." />
                <MetricCard label="Avg Order" value={fmtMoneyCents(s.aov)} sub="Incl. tax + ship"
                  formula="totalRevenue / orderCount. Average total paid per order including tax and shipping." />
                <MetricCard label="Discounts" value={fmtMoney(s.discounts)} sub="Codes + promos" negative
                  formula="SUM(total_discounts). Total discount dollars applied across all orders in range." />
                <MetricCard label="Shipping" value={fmtMoney(s.shipping)} sub="Collected"
                  formula="SUM(total_shipping). Shipping charged to customers (not what you paid carriers)." />
              </div>
            </section>

            {/* Revenue Chart */}
            <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center">
                  <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Daily Revenue vs Refunds</h3>
                  <Tooltip text="Daily revenue (subtotal_price) from shopify_orders stacked vs daily refund totals. Green is what came in, red is what went back out." />
                </div>
              </div>
              {daily.length === 0 ? (
                <p className="text-[var(--muted-foreground)] text-sm py-12 text-center">No data in this range. Try &quot;Sync Now&quot; or a wider window.</p>
              ) : (
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => { const n = Number(v); return `$${n >= 1000 ? `${Math.round(n / 1000)}k` : n}`; }} />
                      <RTooltip contentStyle={{ background: 'var(--foreground)', border: 'none', borderRadius: 8, color: 'var(--background)', fontSize: 12 }} formatter={(v) => fmtMoneyCents(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="refunds" fill="#f87171" name="Refunds" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Return Impact */}
            {money && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Return Impact on Revenue</div>
                  <Tooltip text="Real P&L contribution of returns: what you paid back, what you kept, and what you earned in fees." />
                </div>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                  <PLRow label="Gross Revenue" value={s.grossRevenue} bold formula="SUM(subtotal_price) from shopify_orders in range. Excludes tax, shipping, cancellations, and test orders." />
                  <PLRow label="Cash Refunded" value={-money.cashRefunded} formula="SUM(final_amount) WHERE outcome='refund'. Falls back to subtotal for records without final_amount." />
                  <PLRow label="Credits Issued" value={-money.creditsIssued} sub="liability, not cash out" formula="SUM(final_amount) WHERE outcome='credit'. Not cash, but gift card liability to customers." />
                  <div className="border-t border-[var(--border)]" />
                  <PLRow label="Net Revenue After Returns" value={s.grossRevenue - money.cashRefunded - money.creditsIssued} bold formula="Gross − Cash Refunded − Credits Issued." />
                  <PLRow label="Restocking Fees Earned" value={money.feesCollected} formula="SUM(total_fees) WHERE outcome='refund'. Falls back to subtotal − final_amount for older records. 5% on refunds." />
                  <PLRow label="Rejected Returns (kept)" value={money.rejectedValue} sub={`revenue you didn't have to give back`} formula="SUM(subtotal) WHERE outcome='rejected'. Money retained when a return was denied." />
                  <div className="border-t-2 border-[var(--foreground)]/20" />
                  <PLRow label="Adjusted Net After Returns" value={s.grossRevenue - money.cashRefunded - money.creditsIssued + money.feesCollected} bold accent formula="Net Revenue After Returns + Restocking Fees. Real top-line after all return flows." />
                </div>
              </section>
            )}

            {/* Ad Spend (mock) */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Ad Spend</div>
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200/80 px-2 py-0.5 rounded-lg font-semibold">Mock Data</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="Meta Ads" value={fmtMoney(mockAdSpend.meta)} sub={`${mockAdSpend.metaRoas}x ROAS`}
                  formula="Placeholder — will pull from Meta Marketing API. ROAS = revenue attributed to Meta / spend." />
                <MetricCard label="Google Ads" value={fmtMoney(mockAdSpend.google)} sub={`${mockAdSpend.googleRoas}x ROAS`}
                  formula="Placeholder — will pull from Google Ads API. ROAS = revenue attributed to Google / spend." />
                <MetricCard label="Total Spend" value={fmtMoney(mockAdSpend.totalSpend)} sub={`${mockAdSpend.blendedRoas}x blended`} negative
                  formula="Meta + Google. Blended ROAS = netRevenue / totalSpend." />
                <MetricCard label="Blended CAC" value={`$${mockAdSpend.blendedCac}`} sub={`${s.orderCount} orders`}
                  formula="Total ad spend / new orders. Customer acquisition cost across paid channels." />
              </div>
            </section>

            {/* Expenses (mock) */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Expenses</div>
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200/80 px-2 py-0.5 rounded-lg font-semibold">Mock Data</span>
                <Tooltip text="These are placeholder values. Real expenses will come from Plaid (Chase bank feed) and manual categorization." />
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                {mockExpenses.map((e, i) => {
                  const pct = totalExpenses > 0 ? (e.amount / totalExpenses) * 100 : 0;
                  return (
                    <div key={e.category} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
                      <span className="text-sm text-[var(--foreground)] font-medium">{e.category}</span>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-2 bg-[var(--muted)] rounded-full overflow-hidden hidden sm:block">
                          <div className="h-full bg-[var(--ring)] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-[var(--foreground)] w-20 text-right">{fmtMoney(e.amount)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between px-5 py-3 border-t-2 border-[var(--foreground)]/10 bg-[var(--muted)]">
                  <span className="text-sm text-[var(--foreground)] font-bold">Total Expenses</span>
                  <span className="text-sm font-bold text-[var(--foreground)]">{fmtMoney(totalExpenses)}</span>
                </div>
              </div>
            </section>

            {/* P&L */}
            <section>
              <button onClick={() => setPlOpen(v => !v)} className="w-full flex items-center gap-2 mb-3 group">
                <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Profit &amp; Loss</div>
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200/80 px-2 py-0.5 rounded-lg font-semibold">Mock Data</span>
                <Tooltip text="P&L = Net Revenue − COGS − Ad Spend − Operating Expenses. COGS, ad spend, and most expenses are still placeholder." />
                <span className="ml-auto text-[var(--muted-foreground)] text-xs group-hover:text-[var(--foreground)]">{plOpen ? '▼' : '▶'}</span>
              </button>
              {plOpen && (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                  <PLRow label="Net Revenue" value={netRev} bold formula="grossRevenue − refunds (from Shopify)." />
                  <PLRow label="Cost of Goods Sold" value={-mockCogs} formula="Placeholder — will be sku-level cost data × units sold." />
                  <div className="border-t border-[var(--border)]" />
                  <PLRow label="Gross Margin" value={grossMargin} bold sub={netRev > 0 ? `${((grossMargin / netRev) * 100).toFixed(1)}% margin` : undefined} formula="Net Revenue − COGS. What's left after product costs." />
                  <PLRow label="Ad Spend (Meta + Google)" value={-mockAdSpend.totalSpend} formula="Placeholder — from Meta + Google Ads APIs." />
                  <PLRow label="Shopify Fees" value={-(s.shopifyFees || 0)} formula="SUM(fee) from shopify_transactions. Real data from Shopify." />
                  <PLRow label="Shipping Costs" value={-1240} formula="Placeholder — what you paid carriers (Shippo/UPS)." />
                  <PLRow label="Apps & Tools" value={-896} formula="Placeholder — Shopify app subscriptions + SaaS." />
                  <PLRow label="Redo (Returns)" value={-596} formula="Placeholder — $596/mo Redo subscription." />
                  <PLRow label="Rent & Office" value={-2800} formula="Placeholder — from Plaid bank feed." />
                  <PLRow label="Owner Draw" value={-3500} formula="Placeholder — distributions to owner." />
                  <div className="border-t-2 border-[var(--foreground)]/20" />
                  <PLRow label="Net Profit" value={netProfit} bold accent formula="Gross Margin − all operating expenses." />
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function PLRow({ label, value, bold, sub, accent, formula }: { label: string; value: number; bold?: boolean; sub?: string; accent?: boolean; formula?: string }) {
  const isNeg = value < 0;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <span className={`text-sm ${bold ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>{label}</span>
        {formula && <Tooltip text={formula} />}
        {sub && <span className="text-[11px] text-[var(--muted-foreground)] ml-2">{sub}</span>}
      </div>
      <span className={`text-sm font-semibold ${accent ? (value >= 0 ? 'text-emerald-600' : 'text-red-600') : isNeg ? 'text-red-500' : 'text-[var(--foreground)]'}`}>
        {isNeg ? `-${fmtMoney(Math.abs(value))}` : fmtMoney(value)}
      </span>
    </div>
  );
}
