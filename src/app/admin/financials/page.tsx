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
  shopifyRefunds: number; refundRate: number;
  orderCount: number; aov: number; shopifyFees: number;
  uniqueCustomers: number; repeatCustomers: number; repeatRate: number;
  hasCogs: boolean; totalCogs: number; grossMargin: number; grossMarginPct: number;
};
type DailyPoint = { date: string; revenue: number; orders: number; refunds: number; fees: number };
type SyncCounts = { orders: number; refunds: number; transactions: number };
type OverviewResponse = {
  range: { from: string; to: string }; bucket: 'day' | 'week' | 'month';
  summary: Summary; daily: DailyPoint[];
  lastSynced: string | null; syncCounts: SyncCounts;
};

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
      if (json.success) {
        showToast(`Synced ${json.orders} orders, ${json.refunds} refunds, ${json.products || 0} products, ${json.lineItems || 0} line items`);
        await fetchOverview();
      } else showToast(`Sync failed: ${json.error}`);
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
  const sc = data?.syncCounts;

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
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                Last synced: {fmtSynced(data?.lastSynced || null)}
                {sc && <span> · {sc.orders.toLocaleString()} orders · {sc.refunds.toLocaleString()} refunds · {sc.transactions.toLocaleString()} transactions</span>}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => sync(90)} disabled={syncing} className="text-[11px] tracking-wider uppercase text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50">Backfill 90d</button>
              <button onClick={() => sync('all')} disabled={syncing} className="text-[11px] tracking-wider uppercase text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50">Backfill ALL</button>
            </div>
          </div>
          <DateRangeSelector preset={preset} onPresetChange={setPreset} customFrom={customFrom} customTo={customTo}
            onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }} includeAll={false} />
        </section>

        {loading && !s && <p className="text-[var(--muted-foreground)] text-sm py-12 text-center">Loading…</p>}

        {s && (
          <>
            {/* ─── 12 Info Cards ─── */}
            <section>
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Revenue</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <MetricCard label="Gross Revenue" value={fmtMoney(s.grossRevenue)} sub={`${s.orderCount.toLocaleString()} orders`}
                  formula="SUM(subtotal_price) from non-cancelled, non-test orders in range." />
                <MetricCard label="Net Revenue" value={fmtMoney(s.netRevenue)} sub="after Shopify refunds" accent="emerald"
                  formula="Gross Revenue − SUM(total_refunded). Only actual cash refunds via Shopify, not return requests." />
                <MetricCard label="Refunded (Cash)" value={fmtMoney(s.shopifyRefunds)} sub={fmtPct(s.refundRate)} negative
                  formula="SUM(total_refunded) from shopify_orders. Actual cash returned to customers via Shopify." />
                <MetricCard label="Refund Rate" value={fmtPct(s.refundRate)} sub="of gross revenue"
                  formula="shopifyRefunds / grossRevenue × 100." />
              </div>
            </section>

            <section>
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Customers & Orders</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <MetricCard label="Orders" value={s.orderCount.toLocaleString()} sub="in range" formula="COUNT non-cancelled, non-test orders." />
                <MetricCard label="AOV" value={fmtMoneyCents(s.aov)} sub="avg total price" formula="totalRevenue / orderCount." />
                <MetricCard label="Unique Customers" value={s.uniqueCustomers.toLocaleString()} sub={`${s.repeatCustomers.toLocaleString()} repeat`}
                  formula="COUNT(DISTINCT customer_email)." />
                <MetricCard label="Repeat Rate" value={fmtPct(s.repeatRate)} sub={`${s.repeatCustomers} of ${s.uniqueCustomers}`}
                  formula="Customers with 2+ orders / unique customers × 100." />
              </div>
            </section>

            <section>
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Costs & Margins</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <MetricCard label="Discounts" value={fmtMoney(s.discounts)} sub="codes + promos" negative formula="SUM(total_discounts)." />
                <MetricCard label="Shipping Collected" value={fmtMoney(s.shipping)} sub="from customers" formula="SUM(total_shipping)." />
                <MetricCard label="COGS" value={s.hasCogs ? fmtMoney(s.totalCogs) : '—'} sub={s.hasCogs ? 'cost of goods' : 'add inventory scope'}
                  formula={s.hasCogs ? 'SUM(unit_cost × quantity) from shopify_variants × line_items.' : 'Requires read_inventory scope on Shopify app.'} />
                <MetricCard label="Gross Margin" value={s.hasCogs ? fmtMoney(s.grossMargin) : '—'} sub={s.hasCogs ? fmtPct(s.grossMarginPct) : 'needs COGS'}
                  accent={s.hasCogs ? 'emerald' : undefined}
                  formula={s.hasCogs ? 'Gross Revenue − COGS.' : 'Enable COGS to calculate margin.'} />
              </div>
            </section>

            {/* ─── Revenue Chart (bucketed) ─── */}
            <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center">
                  <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                    Revenue vs Refunds ({data?.bucket === 'month' ? 'Monthly' : data?.bucket === 'week' ? 'Weekly' : 'Daily'})
                  </h3>
                  <Tooltip text={`Aggregated by ${data?.bucket}. Revenue = subtotal_price. Refunds from shopify_refunds. Auto-switches: daily ≤90d, weekly 90-365d, monthly >365d.`} />
                </div>
              </div>
              {daily.length === 0 ? (
                <p className="text-[var(--muted-foreground)] text-sm py-12 text-center">No data in this range. Try &quot;Sync Now&quot; or a wider window.</p>
              ) : (
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10}
                        tickFormatter={(d: string) => data?.bucket === 'month' ? d : d.slice(5)} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11}
                        tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                      <RTooltip contentStyle={{ background: 'var(--foreground)', border: 'none', borderRadius: 8, color: 'var(--background)', fontSize: 12 }}
                        formatter={(v) => fmtMoneyCents(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="refunds" fill="#f87171" name="Refunds" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* ─── Return Impact ─── */}
            {money && (
              <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                <div className="flex items-center mb-3">
                  <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Return Impact on Revenue</h3>
                  <Tooltip text="Shows how returns affect your bottom line. Shopify Refunds = actual cash back. Credits = gift card liability. Rejected = money kept." />
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Gross Revenue" value={s.grossRevenue} bold />
                  <Row label="Cash Refunded (Shopify)" value={-s.shopifyRefunds} sub={fmtPct(s.refundRate)} />
                  <Row label="Store Credits Issued" value={-money.creditsIssued} sub="not cash, liability" />
                  <div className="border-t border-[var(--border)]" />
                  <Row label="Net Revenue" value={s.netRevenue} bold />
                  <Row label="Restocking Fees Earned" value={money.feesCollected} />
                  <Row label="Returns Rejected (kept)" value={money.rejectedValue} sub="customer got nothing back" />
                  <div className="border-t-2 border-[var(--foreground)]/20" />
                  <Row label="Adjusted Net" value={s.netRevenue + money.feesCollected} bold accent />
                </div>
              </section>
            )}

            {/* ─── Product Performance ─── */}
            <ProductBreakdown range={range} />
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, bold, sub, accent }: { label: string; value: number; bold?: boolean; sub?: string; accent?: boolean }) {
  const isNeg = value < 0;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`${bold ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>{label}</span>
        {sub && <span className="text-[10px] text-[var(--muted-foreground)]">{sub}</span>}
      </div>
      <span className={`font-semibold tabular-nums ${accent ? (value >= 0 ? 'text-emerald-600' : 'text-red-600') : isNeg ? 'text-red-500' : 'text-[var(--foreground)]'}`}>
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
        No line-item data. Click <b>Backfill ALL</b> to pull product-level data from Shopify.
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
        <Tooltip text="Top products by revenue. COGS from variant unit_cost. Returns matched by product_name from return_items table." />
        <span className="ml-auto text-[10px] text-[var(--muted-foreground)]">
          {data.totals.productsWithCogs}/{data.totals.productsTotal} with COGS
        </span>
      </div>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full min-w-[650px]">
          <thead>
            <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
              <th className="pl-4 pr-2 py-2 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left">Product</th>
              <Th label="Units" k="units_sold" sk={sortKey} on={setSortKey} />
              <Th label="Revenue" k="revenue" sk={sortKey} on={setSortKey} />
              <Th label="COGS" k="cogs" sk={sortKey} on={setSortKey} />
              <Th label="Margin" k="margin" sk={sortKey} on={setSortKey} />
              <Th label="Returned" k="units_returned" sk={sortKey} on={setSortKey} />
              <Th label="Return %" k="return_rate" sk={sortKey} on={setSortKey} />
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 20).map((p, i) => {
              const mPct = p.revenue > 0 ? (p.margin / p.revenue) * 100 : 0;
              const rTone = p.return_rate >= 30 ? 'text-red-600 font-semibold' : p.return_rate >= 15 ? 'text-amber-700' : 'text-[var(--muted-foreground)]';
              return (
                <tr key={p.product_id || p.title} className={`border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--muted)]/20' : ''}`}>
                  <td className="pl-4 pr-2 py-2 text-sm text-[var(--foreground)] truncate max-w-[260px]" title={p.title}>{p.title}</td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums">{p.units_sold}</td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums font-semibold">{fmtMoney(p.revenue)}</td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums text-[var(--muted-foreground)]">{p.cost_per_unit !== null ? fmtMoney(p.cogs) : '—'}</td>
                  <td className={`px-2 py-2 text-right text-sm tabular-nums ${p.cost_per_unit !== null ? 'text-emerald-700 font-semibold' : 'text-[var(--muted-foreground)]'}`}>
                    {p.cost_per_unit !== null ? `${fmtMoney(p.margin)} (${mPct.toFixed(0)}%)` : '—'}
                  </td>
                  <td className="px-2 py-2 text-right text-sm tabular-nums text-[var(--muted-foreground)]">{p.units_returned || '—'}</td>
                  <td className={`px-2 pr-4 py-2 text-right text-sm tabular-nums ${rTone}`}>{p.units_returned > 0 ? `${p.return_rate}%` : '—'}</td>
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
      className={`px-2 py-2 text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] text-right ${active ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
      {label}{active && ' ↓'}
    </th>
  );
}
