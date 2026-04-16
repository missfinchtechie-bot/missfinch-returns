import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function authorized(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return /mf_auth=(authenticated|admin)(;|$)/.test(cookie);
}

type OrderRow = {
  id: string;
  created_at: string;
  cancelled_at: string | null;
  test: boolean;
  subtotal_price: number;
  total_price: number;
  total_tax: number;
  total_discounts: number;
  total_shipping: number;
  total_refunded: number;
  customer_email: string | null;
};

type RefundRow = { amount: number; created_at: string };
type TxRow = { fee: number; amount: number; type: string; created_at: string };

function bucketKey(iso: string, bucket: 'day' | 'week' | 'month'): string {
  const d = new Date(iso);
  if (bucket === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (bucket === 'week') {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 864e5).toISOString();
  const to = url.searchParams.get('to') || new Date().toISOString();

  const supabase = getServiceClient();

  const [ordersRes, refundsRes, txRes] = await Promise.all([
    supabase
      .from('shopify_orders')
      .select('id, created_at, cancelled_at, test, subtotal_price, total_price, total_tax, total_discounts, total_shipping, total_refunded, customer_email')
      .gte('created_at', from).lte('created_at', to).eq('test', false)
      .limit(50000),
    supabase.from('shopify_refunds').select('amount, created_at').gte('created_at', from).lte('created_at', to).limit(50000),
    supabase.from('shopify_transactions').select('fee, amount, type, created_at').gte('created_at', from).lte('created_at', to).limit(50000),
  ]);

  if (ordersRes.error) return NextResponse.json({ error: ordersRes.error.message }, { status: 500 });

  const orders: OrderRow[] = (ordersRes.data || []).filter(o => !o.cancelled_at);
  const refunds: RefundRow[] = refundsRes.data || [];
  const txs: TxRow[] = txRes.data || [];

  const grossRevenue = orders.reduce((s, o) => s + Number(o.subtotal_price), 0);
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_price), 0);
  const discounts = orders.reduce((s, o) => s + Number(o.total_discounts), 0);
  const shipping = orders.reduce((s, o) => s + Number(o.total_shipping), 0);
  const tax = orders.reduce((s, o) => s + Number(o.total_tax), 0);

  // Actual Shopify refunds (cash back)
  const shopifyRefunds = orders.reduce((s, o) => s + Number(o.total_refunded), 0);
  const netRevenue = grossRevenue - shopifyRefunds;
  const orderCount = orders.length;
  const aov = orderCount > 0 ? totalRevenue / orderCount : 0;
  const refundRate = grossRevenue > 0 ? (shopifyRefunds / grossRevenue) * 100 : 0;
  const shopifyFees = txs.reduce((s, t) => s + Number(t.fee), 0);

  // Customer metrics
  const emailCounts = new Map<string, number>();
  for (const o of orders) {
    if (o.customer_email) emailCounts.set(o.customer_email, (emailCounts.get(o.customer_email) || 0) + 1);
  }
  const uniqueCustomers = emailCounts.size;
  const repeatCustomers = Array.from(emailCounts.values()).filter(c => c >= 2).length;
  const repeatRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

  // COGS from shopify_variants
  const { data: variants } = await supabase.from('shopify_variants').select('id, unit_cost');
  const costMap = new Map<string, number>();
  for (const v of (variants || []) as { id: string; unit_cost: number | null }[]) {
    if (v.unit_cost !== null) costMap.set(v.id, Number(v.unit_cost));
  }
  const hasCogs = costMap.size > 0;
  let totalCogs = 0;
  if (hasCogs) {
    const { data: liData } = await supabase.from('shopify_order_line_items')
      .select('variant_id, quantity')
      .gte('order_created_at', from).lte('order_created_at', to).limit(50000);
    for (const li of (liData || []) as { variant_id: string | null; quantity: number }[]) {
      const uc = costMap.get(li.variant_id || '');
      if (uc) totalCogs += uc * (Number(li.quantity) || 1);
    }
  }
  const grossMargin = grossRevenue - totalCogs;
  const grossMarginPct = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;

  // Smart bucketing: day / week / month
  const daySpan = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  const bucket: 'day' | 'week' | 'month' = daySpan > 365 ? 'month' : daySpan > 90 ? 'week' : 'day';

  const byBucket = new Map<string, { date: string; revenue: number; orders: number; refunds: number; fees: number }>();
  const ensure = (k: string) => {
    if (!byBucket.has(k)) byBucket.set(k, { date: k, revenue: 0, orders: 0, refunds: 0, fees: 0 });
    return byBucket.get(k)!;
  };
  for (const o of orders) { const d = ensure(bucketKey(o.created_at, bucket)); d.revenue += Number(o.subtotal_price); d.orders += 1; }
  for (const r of refunds) ensure(bucketKey(r.created_at, bucket)).refunds += Number(r.amount);
  for (const t of txs) ensure(bucketKey(t.created_at, bucket)).fees += Number(t.fee);

  const daily = Array.from(byBucket.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Sync status
  const [{ data: lastSyncRow }, { count: syncOrders }, { count: syncRefunds }, { count: syncTx }] = await Promise.all([
    supabase.from('shopify_orders').select('synced_at').order('synced_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('shopify_orders').select('*', { count: 'exact', head: true }),
    supabase.from('shopify_refunds').select('*', { count: 'exact', head: true }),
    supabase.from('shopify_transactions').select('*', { count: 'exact', head: true }),
  ]);

  return NextResponse.json({
    range: { from, to },
    bucket,
    lastSynced: lastSyncRow?.synced_at || null,
    syncCounts: { orders: syncOrders || 0, refunds: syncRefunds || 0, transactions: syncTx || 0 },
    summary: {
      grossRevenue, netRevenue, totalRevenue, discounts, shipping, tax,
      shopifyRefunds, refundRate,
      orderCount, aov, shopifyFees,
      uniqueCustomers, repeatCustomers, repeatRate,
      hasCogs, totalCogs, grossMargin, grossMarginPct,
    },
    daily,
  });
}
