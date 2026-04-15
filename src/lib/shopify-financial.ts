import { shopifyGraphQL } from './shopify';
import { getServiceClient } from './supabase';

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || 'missfinchnyc.myshopify.com';
const API_VERSION = '2026-04';

type OrderNode = {
  id: string;
  name: string;
  createdAt: string;
  processedAt: string | null;
  cancelledAt: string | null;
  displayFinancialStatus: string | null;
  test: boolean;
  currencyCode: string;
  tags: string[];
  customer: { id: string; email: string | null } | null;
  subtotalPriceSet: { shopMoney: { amount: string } };
  totalPriceSet: { shopMoney: { amount: string } };
  totalTaxSet: { shopMoney: { amount: string } } | null;
  totalDiscountsSet: { shopMoney: { amount: string } } | null;
  totalShippingPriceSet: { shopMoney: { amount: string } } | null;
  totalRefundedSet: { shopMoney: { amount: string } } | null;
  refunds: {
    id: string;
    createdAt: string;
    totalRefundedSet: { shopMoney: { amount: string } };
    note: string | null;
  }[];
};

const gidToId = (gid: string): string => gid.split('/').pop() || gid;

const ORDERS_QUERY = `
  query SyncOrders($query: String!, $cursor: String) {
    orders(first: 100, after: $cursor, query: $query, sortKey: UPDATED_AT) {
      pageInfo { hasNextPage endCursor }
      edges {
        cursor
        node {
          id name createdAt processedAt cancelledAt
          displayFinancialStatus test currencyCode tags
          customer { id email }
          subtotalPriceSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
          totalTaxSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
          refunds(first: 50) {
            id createdAt note
            totalRefundedSet { shopMoney { amount } }
          }
        }
      }
    }
  }
`;

const num = (v: { shopMoney: { amount: string } } | null | undefined): number =>
  v ? parseFloat(v.shopMoney.amount) : 0;

export async function syncOrders(sinceIso: string): Promise<{ orders: number; refunds: number }> {
  const supabase = getServiceClient();
  let cursor: string | null = null;
  let orderCount = 0;
  let refundCount = 0;
  const queryFilter = `updated_at:>=${sinceIso}`;

  for (let page = 0; page < 200; page++) {
    const data = await shopifyGraphQL(ORDERS_QUERY, { query: queryFilter, cursor });
    const edges: { cursor: string; node: OrderNode }[] = data.orders.edges;
    if (edges.length === 0) break;

    const orderRows = edges.map(({ node: o }) => ({
      id: gidToId(o.id),
      order_number: o.name.replace(/\D/g, '') ? parseInt(o.name.replace(/\D/g, ''), 10) : null,
      name: o.name,
      created_at: o.createdAt,
      processed_at: o.processedAt,
      cancelled_at: o.cancelledAt,
      financial_status: o.displayFinancialStatus,
      currency: o.currencyCode,
      subtotal_price: num(o.subtotalPriceSet),
      total_price: num(o.totalPriceSet),
      total_tax: num(o.totalTaxSet),
      total_discounts: num(o.totalDiscountsSet),
      total_shipping: num(o.totalShippingPriceSet),
      total_refunded: num(o.totalRefundedSet),
      customer_id: o.customer ? gidToId(o.customer.id) : null,
      customer_email: o.customer?.email || null,
      tags: o.tags.join(','),
      test: o.test,
      synced_at: new Date().toISOString(),
    }));

    const { error: orderErr } = await supabase.from('shopify_orders').upsert(orderRows, { onConflict: 'id' });
    if (orderErr) throw new Error(`Upsert orders failed: ${orderErr.message}`);
    orderCount += orderRows.length;

    const refundRows = edges.flatMap(({ node: o }) =>
      o.refunds.map(r => ({
        id: gidToId(r.id),
        order_id: gidToId(o.id),
        created_at: r.createdAt,
        processed_at: r.createdAt,
        amount: num(r.totalRefundedSet),
        currency: o.currencyCode,
        note: r.note,
        synced_at: new Date().toISOString(),
      }))
    );

    if (refundRows.length > 0) {
      const { error: refundErr } = await supabase.from('shopify_refunds').upsert(refundRows, { onConflict: 'id' });
      if (refundErr) throw new Error(`Upsert refunds failed: ${refundErr.message}`);
      refundCount += refundRows.length;
    }

    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
  }

  await supabase.from('shopify_sync_state').upsert({
    key: 'orders',
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return { orders: orderCount, refunds: refundCount };
}

type BalanceTx = {
  id: number;
  type: string;
  test: boolean;
  payout_id: number | null;
  payout_status: string | null;
  currency: string;
  amount: string;
  fee: string;
  net: string;
  source_id: number | null;
  source_type: string | null;
  source_order_id: number | null;
  processed_at: string;
};

async function shopifyPaymentsREST(path: string): Promise<Response> {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) throw new Error('SHOPIFY_ACCESS_TOKEN missing');
  return fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/shopify_payments/${path}`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
}

export async function syncShopifyPaymentsFees(sinceIso: string): Promise<{ transactions: number; skipped: boolean }> {
  const supabase = getServiceClient();
  let url = `balance/transactions.json?limit=250&processed_at_min=${encodeURIComponent(sinceIso)}`;
  let total = 0;

  for (let page = 0; page < 50; page++) {
    const res = await shopifyPaymentsREST(url);
    if (res.status === 404 || res.status === 402) {
      return { transactions: 0, skipped: true };
    }
    if (!res.ok) throw new Error(`Shopify Payments ${res.status}: ${await res.text()}`);

    const json = await res.json();
    const txs: BalanceTx[] = json.transactions || [];
    if (txs.length === 0) break;

    const rows = txs.map(t => ({
      id: String(t.id),
      order_id: t.source_order_id ? String(t.source_order_id) : null,
      created_at: t.processed_at,
      type: t.type,
      amount: parseFloat(t.amount || '0'),
      fee: parseFloat(t.fee || '0'),
      net: parseFloat(t.net || '0'),
      currency: t.currency,
      source_type: t.source_type,
      source_id: t.source_id ? String(t.source_id) : null,
      payout_id: t.payout_id ? String(t.payout_id) : null,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('shopify_transactions').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`Upsert transactions failed: ${error.message}`);
    total += rows.length;

    const link = res.headers.get('link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    if (!next) break;
    const nextUrl = new URL(next[1]);
    url = `balance/transactions.json${nextUrl.search}`;
  }

  await supabase.from('shopify_sync_state').upsert({
    key: 'payments',
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return { transactions: total, skipped: false };
}

export async function runFullSync(days: number): Promise<{
  orders: number;
  refunds: number;
  transactions: number;
  paymentsSkipped: boolean;
  since: string;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const ordersResult = await syncOrders(since);
  const txResult = await syncShopifyPaymentsFees(since);
  return {
    orders: ordersResult.orders,
    refunds: ordersResult.refunds,
    transactions: txResult.transactions,
    paymentsSkipped: txResult.skipped,
    since,
  };
}
