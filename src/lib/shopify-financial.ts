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

/* ─── Products + variants + COGS ─── */

type VariantNode = {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
  inventoryItem: { unitCost: { amount: string } | null } | null;
};

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  vendor: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  featuredImage: { url: string } | null;
  variants: { edges: { node: VariantNode }[] };
};

const PRODUCTS_QUERY = `
  query SyncProducts($cursor: String) {
    products(first: 50, after: $cursor, sortKey: UPDATED_AT) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id title handle status productType vendor tags
          createdAt updatedAt
          featuredImage { url }
          variants(first: 50) {
            edges {
              node {
                id title sku price compareAtPrice
                inventoryQuantity availableForSale
                selectedOptions { name value }
                inventoryItem { unitCost { amount } }
              }
            }
          }
        }
      }
    }
  }
`;

export async function syncProducts(): Promise<{ products: number; variants: number }> {
  const supabase = getServiceClient();
  let cursor: string | null = null;
  let productCount = 0;
  let variantCount = 0;
  const now = new Date().toISOString();

  for (let page = 0; page < 200; page++) {
    const data = await shopifyGraphQL(PRODUCTS_QUERY, { cursor });
    const edges: { node: ProductNode }[] = data.products.edges;
    if (edges.length === 0) break;

    const productRows = edges.map(({ node: p }) => ({
      id: gidToId(p.id),
      title: p.title,
      handle: p.handle,
      status: p.status,
      product_type: p.productType,
      vendor: p.vendor,
      tags: (p.tags || []).join(','),
      featured_image_url: p.featuredImage?.url || null,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      synced_at: now,
    }));
    const { error: pErr } = await supabase.from('shopify_products').upsert(productRows, { onConflict: 'id' });
    if (pErr) throw new Error(`Products upsert failed: ${pErr.message}`);
    productCount += productRows.length;

    const variantRows = edges.flatMap(({ node: p }) =>
      p.variants.edges.map(({ node: v }) => {
        const sizeOpt = v.selectedOptions.find(o => o.name.toLowerCase() === 'size');
        const colorOpt = v.selectedOptions.find(o => o.name.toLowerCase() === 'color');
        return {
          id: gidToId(v.id),
          product_id: gidToId(p.id),
          title: v.title,
          sku: v.sku,
          price: parseFloat(v.price) || 0,
          compare_at_price: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null,
          unit_cost: v.inventoryItem?.unitCost?.amount ? parseFloat(v.inventoryItem.unitCost.amount) : null,
          inventory_quantity: v.inventoryQuantity,
          available_for_sale: v.availableForSale,
          size: sizeOpt?.value || null,
          color: colorOpt?.value || null,
          synced_at: now,
        };
      })
    );
    if (variantRows.length > 0) {
      const { error: vErr } = await supabase.from('shopify_variants').upsert(variantRows, { onConflict: 'id' });
      if (vErr) throw new Error(`Variants upsert failed: ${vErr.message}`);
      variantCount += variantRows.length;
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  await supabase.from('shopify_sync_state').upsert({
    key: 'products', last_synced_at: now, updated_at: now,
  });
  return { products: productCount, variants: variantCount };
}

/* ─── Order line items (for product-level revenue) ─── */

type LineItemNode = {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  variant: { id: string; product: { id: string; title: string } | null } | null;
  originalUnitPriceSet: { shopMoney: { amount: string } };
  discountedUnitPriceSet: { shopMoney: { amount: string } };
};

const LINE_ITEMS_QUERY = `
  query OrderLineItems($query: String!, $cursor: String) {
    orders(first: 50, after: $cursor, query: $query, sortKey: UPDATED_AT) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id name createdAt
          lineItems(first: 50) {
            edges {
              node {
                id title sku quantity
                variant { id product { id title } }
                originalUnitPriceSet { shopMoney { amount } }
                discountedUnitPriceSet { shopMoney { amount } }
              }
            }
          }
        }
      }
    }
  }
`;

export async function syncOrderLineItems(sinceIso: string): Promise<{ lineItems: number }> {
  const supabase = getServiceClient();
  let cursor: string | null = null;
  let total = 0;
  const queryFilter = `updated_at:>=${sinceIso}`;
  const now = new Date().toISOString();

  for (let page = 0; page < 400; page++) {
    const data = await shopifyGraphQL(LINE_ITEMS_QUERY, { query: queryFilter, cursor });
    const edges = data.orders.edges as { node: { id: string; createdAt: string; lineItems: { edges: { node: LineItemNode }[] } } }[];
    if (edges.length === 0) break;

    const rows = edges.flatMap(({ node: o }) =>
      o.lineItems.edges.map(({ node: li }) => ({
        id: gidToId(li.id),
        order_id: gidToId(o.id),
        order_created_at: o.createdAt,
        product_id: li.variant?.product ? gidToId(li.variant.product.id) : null,
        variant_id: li.variant ? gidToId(li.variant.id) : null,
        product_title: li.variant?.product?.title || li.title,
        title: li.title,
        sku: li.sku,
        quantity: li.quantity,
        original_unit_price: parseFloat(li.originalUnitPriceSet.shopMoney.amount) || 0,
        discounted_unit_price: parseFloat(li.discountedUnitPriceSet.shopMoney.amount) || 0,
        line_total: (parseFloat(li.discountedUnitPriceSet.shopMoney.amount) || 0) * li.quantity,
        synced_at: now,
      }))
    );

    if (rows.length > 0) {
      const { error } = await supabase.from('shopify_order_line_items').upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`Line items upsert failed: ${error.message}`);
      total += rows.length;
    }

    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
  }

  return { lineItems: total };
}

export async function runFullSync(days: number): Promise<{
  orders: number;
  refunds: number;
  transactions: number;
  paymentsSkipped: boolean;
  products: number;
  variants: number;
  lineItems: number;
  since: string;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const ordersResult = await syncOrders(since);
  const txResult = await syncShopifyPaymentsFees(since);
  const productsResult = await syncProducts();
  const liResult = await syncOrderLineItems(since);
  return {
    orders: ordersResult.orders,
    refunds: ordersResult.refunds,
    transactions: txResult.transactions,
    paymentsSkipped: txResult.skipped,
    products: productsResult.products,
    variants: productsResult.variants,
    lineItems: liResult.lineItems,
    since,
  };
}
