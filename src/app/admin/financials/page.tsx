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

  const sync = async (days: number | 'all') => {
    setSyncing(true);
    try {
      const param = days === 'all' ? 'all' : String(days);
      const res = await fetch(`/api/financials/sync?days=${param}`);
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
            <div className="flex gap-3">
              <button onClick={() => sync(90)} disabled={syncing}
                className="text-[11px] tracking-wider uppercase text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50">Backfill 90d</button>
              <button onClick={() => sync('all')} disabled={syncing}
                className="text-[11px] tracking-wider uppercase text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50">Backfill ALL</button>
            </div>
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

            {/* Product Performance */}
            <ProductBreakdown range={range} />
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

/* ─── Product Breakdown ─── */

type ProductRow = {
  product_id: string | null;
  title: string;
  units_sold: number;
  revenue: number;
  cost_per_unit: number | null;
  cogs: number;
  margin: number;
  units_returned: number;
  return_value: number;
  return_rate: number;
};

type ProductsResponse = {
  products: ProductRow[];
  totals: { revenue: number; cogs: number; margin: number; marginPct: number; productsWithCogs: number; productsTotal: number };
};

function ProductBreakdown({ range }: { range: { from: string; to: string } }) {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof ProductRow>('revenue');

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ from: range.from, to: range.to });
    fetch(`/api/financials/products?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  if (loading) return <section><div className="text-center py-8 text-xs text-[var(--muted-foreground)]">Loading product breakdown…</div></section>;
  if (!data || data.products.length === 0) return (
    <section>
      <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Product Performance</div>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center text-sm text-[var(--muted-foreground)]">
        No product data in this range. Run <b>Backfill ALL</b> in the header to pull all Shopify orders + products.
      </div>
    </section>
  );

  const sorted = [...data.products].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') return bv - av;
    return 0;
  });

  return (
    <section>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Product Performance</div>
        <Tooltip text="Top products by revenue in this date range. COGS pulled from Shopify variant unit_cost. Returns matched by product title from return_items." />
        <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">
          {data.totals.productsWithCogs}/{data.totals.productsTotal} products have COGS data
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <MetricCard label="Total Revenue" value={fmtMoney(data.totals.revenue)} sub="top 50 products" />
        <MetricCard label="Total COGS" value={fmtMoney(data.totals.cogs)} sub="cost of goods" />
        <MetricCard label="Gross Margin" value={fmtMoney(data.totals.margin)} sub={`${data.totals.marginPct}%`} accent="emerald" />
        <MetricCard label="Products" value={String(data.totals.productsTotal)} sub="with sales in range" />
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
              <th className="pl-4 pr-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left">Product</th>
              <Th label="Units" k="units_sold" sk={sortKey} on={setSortKey} />
              <Th label="Revenue" k="revenue" sk={sortKey} on={setSortKey} />
              <Th label="COGS" k="cogs" sk={sortKey} on={setSortKey} />
              <Th label="Margin" k="margin" sk={sortKey} on={setSortKey} />
              <Th label="Returned" k="units_returned" sk={sortKey} on={setSortKey} />
              <Th label="Return %" k="return_rate" sk={sortKey} on={setSortKey} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const marginPct = p.revenue > 0 ? (p.margin / p.revenue) * 100 : 0;
              const returnTone = p.return_rate >= 30 ? 'text-red-600 font-semibold' : p.return_rate >= 15 ? 'text-amber-700' : 'text-[var(--muted-foreground)]';
              return (
                <tr key={p.product_id || p.title} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--muted)]/20' : ''}`}>
                  <td className="pl-4 pr-2 py-2.5 text-sm text-[var(--foreground)] truncate max-w-[280px]" title={p.title}>{p.title}</td>
                  <td className="px-2 py-2.5 text-right text-sm tabular-nums">{p.units_sold}</td>
                  <td className="px-2 py-2.5 text-right text-sm tabular-nums font-semibold">{fmtMoney(p.revenue)}</td>
                  <td className="px-2 py-2.5 text-right text-sm tabular-nums text-[var(--muted-foreground)]">{p.cost_per_unit !== null ? fmtMoney(p.cogs) : '—'}</td>
                  <td className={`px-2 py-2.5 text-right text-sm tabular-nums ${p.cost_per_unit !== null ? 'text-emerald-700 font-semibold' : 'text-[var(--muted-foreground)]'}`}>
                    {p.cost_per_unit !== null ? `${fmtMoney(p.margin)}` : '—'}
                    {p.cost_per_unit !== null && <span className="text-[10px] text-[var(--muted-foreground)] ml-1">({marginPct.toFixed(0)}%)</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right text-sm tabular-nums text-[var(--muted-foreground)]">{p.units_returned || '—'}</td>
                  <td className={`px-2 pr-4 py-2.5 text-right text-sm tabular-nums ${returnTone}`}>{p.units_returned > 0 ? `${p.return_rate}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ label, k, sk, on }: { label: string; k: keyof ProductRow; sk: keyof ProductRow; on: (k: keyof ProductRow) => void }) {
  const active = sk === k;
  return (
    <th onClick={() => on(k)}
      className={`px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] text-right ${active ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
      {label}{active && ' ↓'}
    </th>
  );
}
