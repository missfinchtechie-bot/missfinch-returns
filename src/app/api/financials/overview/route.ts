import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function authorized(req: Request): boolean {
  const cookie = req.headers.get('cookie') || '';
  return cookie.includes('mf_auth=authenticated');
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
};

type RefundRow = { amount: number; created_at: string };
type TxRow = { fee: number; amount: number; type: string; created_at: string };

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
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
      .select('id, created_at, cancelled_at, test, subtotal_price, total_price, total_tax, total_discounts, total_shipping, total_refunded')
      .gte('created_at', from)
      .lte('created_at', to)
      .eq('test', false)
      .limit(10000),
    supabase
      .from('shopify_refunds')
      .select('amount, created_at')
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(10000),
    supabase
      .from('shopify_transactions')
      .select('fee, amount, type, created_at')
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(20000),
  ]);

  if (ordersRes.error) return NextResponse.json({ error: ordersRes.error.message }, { status: 500 });
  if (refundsRes.error) return NextResponse.json({ error: refundsRes.error.message }, { status: 500 });
  if (txRes.error) return NextResponse.json({ error: txRes.error.message }, { status: 500 });

  const orders: OrderRow[] = (ordersRes.data || []).filter(o => !o.cancelled_at);
  const refunds: RefundRow[] = refundsRes.data || [];
  const txs: TxRow[] = txRes.data || [];

  const grossRevenue = orders.reduce((s, o) => s + Number(o.subtotal_price), 0);
  const discounts = orders.reduce((s, o) => s + Number(o.total_discounts), 0);
  const shipping = orders.reduce((s, o) => s + Number(o.total_shipping), 0);
  const tax = orders.reduce((s, o) => s + Number(o.total_tax), 0);
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_price), 0);
  const refundTotal = refunds.reduce((s, r) => s + Number(r.amount), 0);
  const netRevenue = grossRevenue - refundTotal;
  const orderCount = orders.length;
  const aov = orderCount > 0 ? totalRevenue / orderCount : 0;
  const refundRate = grossRevenue > 0 ? (refundTotal / grossRevenue) * 100 : 0;
  const shopifyFees = txs.reduce((s, t) => s + Number(t.fee), 0);

  const byDay = new Map<string, { date: string; revenue: number; orders: number; refunds: number; fees: number }>();
  const ensure = (k: string) => {
    if (!byDay.has(k)) byDay.set(k, { date: k, revenue: 0, orders: 0, refunds: 0, fees: 0 });
    return byDay.get(k)!;
  };
  for (const o of orders) {
    const d = ensure(dayKey(o.created_at));
    d.revenue += Number(o.subtotal_price);
    d.orders += 1;
  }
  for (const r of refunds) ensure(dayKey(r.created_at)).refunds += Number(r.amount);
  for (const t of txs) ensure(dayKey(t.created_at)).fees += Number(t.fee);

  const daily = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

  const { data: lastSyncRow } = await supabase
    .from('shopify_orders')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastSynced: string | null = lastSyncRow?.synced_at || null;

  return NextResponse.json({
    range: { from, to },
    lastSynced,
    summary: {
      grossRevenue,
      netRevenue,
      totalRevenue,
      discounts,
      shipping,
      tax,
      refundTotal,
      refundRate,
      orderCount,
      aov,
      shopifyFees,
    },
    daily,
  });
}
