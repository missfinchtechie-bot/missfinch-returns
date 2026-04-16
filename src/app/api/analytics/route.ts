import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function authorized(req: Request): boolean {
  if (req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true;
  const cookie = req.headers.get('cookie') || '';
  return /mf_auth=(authenticated|admin)(;|$)/.test(cookie);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const supabase = getServiceClient();

  // ─── Revenue by day ───
  let oq = supabase.from('shopify_orders')
    .select('created_at, subtotal_price, total_price, customer_email, cancelled_at, test')
    .eq('test', false).is('cancelled_at', null);
  if (from) oq = oq.gte('created_at', from);
  if (to) oq = oq.lte('created_at', to);
  const { data: orders } = await oq.limit(50000);

  const byDay = new Map<string, { date: string; revenue: number; orders: number }>();
  const customerSet = new Set<string>();
  const emailCount = new Map<string, number>();
  for (const o of orders || []) {
    const d = o.created_at?.slice(0, 10);
    if (!d) continue;
    const e = byDay.get(d) || { date: d, revenue: 0, orders: 0 };
    e.revenue += Number(o.subtotal_price) || 0;
    e.orders += 1;
    byDay.set(d, e);
    if (o.customer_email) {
      customerSet.add(o.customer_email);
      emailCount.set(o.customer_email, (emailCount.get(o.customer_email) || 0) + 1);
    }
  }
  const revenueTrend = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Customer metrics
  const totalCustomers = customerSet.size;
  const repeatCustomers = Array.from(emailCount.values()).filter(c => c > 1).length;
  const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
  const totalOrders = (orders || []).length;
  const totalRevenue = (orders || []).reduce((s, o) => s + (Number(o.subtotal_price) || 0), 0);

  // ─── Product performance (top 30) ───
  let lq = supabase.from('shopify_order_line_items')
    .select('product_title, quantity, line_total');
  if (from) lq = lq.gte('order_created_at', from);
  if (to) lq = lq.lte('order_created_at', to);
  const { data: lineItems } = await lq.limit(50000);

  // Return items for matching
  const { data: retItems } = await supabase.from('return_items').select('product_name, price').limit(50000);
  const returnsByProduct = new Map<string, { count: number; value: number }>();
  for (const r of retItems || []) {
    if (!r.product_name) continue;
    const e = returnsByProduct.get(r.product_name) || { count: 0, value: 0 };
    e.count += 1;
    e.value += Number(r.price) || 0;
    returnsByProduct.set(r.product_name, e);
  }

  const productMap = new Map<string, { title: string; units: number; revenue: number; returned: number; returnValue: number }>();
  for (const li of lineItems || []) {
    const t = li.product_title || 'Unknown';
    const e = productMap.get(t) || { title: t, units: 0, revenue: 0, returned: 0, returnValue: 0 };
    e.units += Number(li.quantity) || 0;
    e.revenue += Number(li.line_total) || 0;
    productMap.set(t, e);
  }
  for (const [title, r] of returnsByProduct.entries()) {
    const e = productMap.get(title);
    if (e) { e.returned += r.count; e.returnValue += r.value; }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue).slice(0, 30)
    .map(p => ({ ...p, returnRate: p.units > 0 ? Math.round((p.returned / p.units) * 1000) / 10 : 0 }));

  // ─── Return reasons ───
  let rq = supabase.from('returns').select('reason');
  if (from) rq = rq.gte('return_requested', from);
  if (to) rq = rq.lte('return_requested', to);
  const { data: returns } = await rq.limit(50000);

  const reasonCounts = new Map<string, number>();
  for (const r of returns || []) {
    const reason = r.reason?.trim() || 'Not specified';
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  }
  const returnReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return NextResponse.json({
    revenueTrend,
    customers: {
      total: totalCustomers,
      repeat: repeatCustomers,
      repeatRate: Math.round(repeatRate * 10) / 10,
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    },
    topProducts,
    returnReasons,
  });
}
