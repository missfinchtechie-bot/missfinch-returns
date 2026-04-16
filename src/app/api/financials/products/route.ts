import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function authorized(req: Request): boolean {
  if (req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true;
  const cookie = req.headers.get('cookie') || '';
  return /mf_auth=(authenticated|admin)(;|$)/.test(cookie);
}

type LineItem = {
  product_id: string | null;
  product_title: string | null;
  quantity: number | null;
  line_total: number | null;
  order_created_at: string | null;
};

type Variant = {
  product_id: string | null;
  unit_cost: number | null;
};

type Return = {
  product_name: string | null;
  price: number | null;
  quantity: number | null;
};

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const supabase = getServiceClient();

  // Pull line items in window
  let liQ = supabase.from('shopify_order_line_items')
    .select('product_id, product_title, quantity, line_total, order_created_at');
  if (from) liQ = liQ.gte('order_created_at', from);
  if (to) liQ = liQ.lte('order_created_at', to);
  const { data: lineItems } = await liQ.limit(50000);

  // Pull variant costs (avg cost per product)
  const { data: variants } = await supabase.from('shopify_variants').select('product_id, unit_cost');
  const costByProduct = new Map<string, { sum: number; n: number }>();
  for (const v of (variants || []) as Variant[]) {
    if (!v.product_id || v.unit_cost === null) continue;
    const e = costByProduct.get(v.product_id) || { sum: 0, n: 0 };
    e.sum += Number(v.unit_cost) || 0;
    e.n += 1;
    costByProduct.set(v.product_id, e);
  }

  // Pull all returns from `return_items` (specific items being returned)
  const { data: retItems } = await supabase.from('return_items')
    .select('product_name, price, quantity')
    .limit(50000);

  // Aggregate by product
  type Agg = {
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
  const map = new Map<string, Agg>();
  for (const li of (lineItems || []) as LineItem[]) {
    const key = li.product_title || 'Unknown';
    const e = map.get(key) || {
      product_id: li.product_id, title: key,
      units_sold: 0, revenue: 0, cost_per_unit: null, cogs: 0,
      margin: 0, units_returned: 0, return_value: 0, return_rate: 0,
    };
    e.units_sold += Number(li.quantity) || 0;
    e.revenue += Number(li.line_total) || 0;
    if (!e.product_id && li.product_id) e.product_id = li.product_id;
    map.set(key, e);
  }

  // Apply COGS
  for (const e of map.values()) {
    if (e.product_id) {
      const c = costByProduct.get(e.product_id);
      if (c && c.n > 0) {
        e.cost_per_unit = c.sum / c.n;
        e.cogs = e.cost_per_unit * e.units_sold;
        e.margin = e.revenue - e.cogs;
      }
    }
  }

  // Match returns by title (return_items.product_name vs line_items.product_title)
  for (const r of (retItems || []) as Return[]) {
    if (!r.product_name) continue;
    const e = map.get(r.product_name);
    if (e) {
      e.units_returned += Number(r.quantity) || 1;
      e.return_value += Number(r.price) || 0;
    }
  }

  // Compute return rate
  for (const e of map.values()) {
    e.return_rate = e.units_sold > 0 ? (e.units_returned / e.units_sold) * 100 : 0;
  }

  const products = Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 50)
    .map(p => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
      cogs: Math.round(p.cogs * 100) / 100,
      margin: Math.round(p.margin * 100) / 100,
      return_value: Math.round(p.return_value * 100) / 100,
      return_rate: Math.round(p.return_rate * 10) / 10,
      cost_per_unit: p.cost_per_unit !== null ? Math.round(p.cost_per_unit * 100) / 100 : null,
    }));

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalCogs = products.reduce((s, p) => s + p.cogs, 0);
  const totalMargin = totalRevenue - totalCogs;
  const productsWithCogs = products.filter(p => p.cost_per_unit !== null).length;

  return NextResponse.json({
    products,
    totals: {
      revenue: Math.round(totalRevenue * 100) / 100,
      cogs: Math.round(totalCogs * 100) / 100,
      margin: Math.round(totalMargin * 100) / 100,
      marginPct: totalRevenue > 0 ? Math.round((totalMargin / totalRevenue) * 1000) / 10 : 0,
      productsWithCogs,
      productsTotal: products.length,
    },
  });
}
