import { getServiceClient } from './supabase';

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || 'missfinchnyc.myshopify.com';
const API_VERSION = '2026-04';

async function getAccessToken(): Promise<string> {
  if (process.env.SHOPIFY_ACCESS_TOKEN) return process.env.SHOPIFY_ACCESS_TOKEN;
  const supabase = getServiceClient();
  const { data } = await supabase.from('settings').select('value').eq('key', 'shopify_access_token').single();
  if (data?.value) return JSON.parse(data.value);
  throw new Error('No Shopify access token.');
}

// ─── GraphQL ───

export async function shopifyGraphQL(query: string, variables?: Record<string, unknown>) {
  const token = await getAccessToken();
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`Shopify GQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

// ─── REST ───

async function shopifyREST(endpoint: string, method = 'GET', body?: unknown) {
  const token = await getAccessToken();
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Shopify REST ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Get Order (rich data for detail panel) ───

export async function getOrder(orderNumber: string) {
  const query = `
    query GetOrder($q: String!) {
      orders(first: 1, query: $q) {
        edges {
          node {
            id name createdAt
            totalPriceSet { shopMoney { amount } }
            subtotalPriceSet { shopMoney { amount } }
            currentTotalPriceSet { shopMoney { amount } }
            refundable
            customer {
              id displayName email phone numberOfOrders
              amountSpent { amount }
            }
            shippingAddress {
              name address1 address2 city provinceCode zip country phone
            }
            lineItems(first: 50) {
              edges {
                node {
                  id title variantTitle sku quantity
                  originalUnitPriceSet { shopMoney { amount } }
                  discountedUnitPriceSet { shopMoney { amount } }
                  image { url(transform: {maxWidth: 120}) }
                }
              }
            }
            fulfillments(first: 10) {
              trackingInfo { number url company }
              deliveredAt createdAt
            }
            transactions(first: 10) {
              id kind status gateway
              amountSet { shopMoney { amount } }
              parentTransaction { id }
            }
            paymentGatewayNames
            note
            tags
          }
        }
      }
    }
  `;
  const data = await shopifyGraphQL(query, { q: `name:${orderNumber}` });
  return data.orders.edges[0]?.node || null;
}

// ─── Get REST order ID from GraphQL GID ───

function gidToId(gid: string): string {
  return gid.split('/').pop() || '';
}

// ─── Calculate refund (safe — tells us exactly what Shopify will refund) ───

export async function calculateRefund(orderGid: string) {
  const orderId = gidToId(orderGid);
  const result = await shopifyREST(`orders/${orderId}/refunds/calculate.json`, 'POST', {
    refund: {
      currency: 'USD',
      shipping: { full_refund: false },
    },
  });

  const refund = result.refund;
  const tx = refund.transactions?.[0];

  return {
    maxRefundable: parseFloat(tx?.maximum_refundable || '0'),
    parentTransactionId: tx?.parent_id ? String(tx.parent_id) : null,
    gateway: tx?.gateway || null,
    suggestedAmount: parseFloat(tx?.amount || '0'),
  };
}

// ─── Execute refund to original payment method ───
// SAFETY: uses calculateRefund first to ensure we never refund more than allowed

export async function executeRefund(orderGid: string, amount: number, note?: string): Promise<{
  success: boolean;
  refundId?: string;
  amountRefunded?: number;
  error?: string;
}> {
  const orderId = gidToId(orderGid);

  // Step 1: Calculate to get parent transaction + max refundable
  const calc = await calculateRefund(orderGid);

  if (!calc.parentTransactionId) {
    return { success: false, error: 'No refundable transaction found on this order' };
  }

  // Step 2: Cap amount at maximum refundable — NEVER exceed
  const safeAmount = Math.min(amount, calc.maxRefundable);

  if (safeAmount <= 0) {
    return { success: false, error: `Nothing to refund. Max refundable: $${calc.maxRefundable.toFixed(2)}` };
  }

  // Step 3: Execute the refund
  const result = await shopifyREST(`orders/${orderId}/refunds.json`, 'POST', {
    refund: {
      currency: 'USD',
      notify: false, // We handle notifications via Klaviyo
      note: note || 'Processed via Miss Finch Returns Dashboard',
      transactions: [{
        parent_id: calc.parentTransactionId,
        amount: safeAmount.toFixed(2),
        kind: 'refund',
        gateway: calc.gateway || 'shopify_payments',
      }],
    },
  });

  const refund = result.refund;
  return {
    success: true,
    refundId: String(refund.id),
    amountRefunded: safeAmount,
  };
}

// ─── Issue store credit as gift card ───
// Not Shopify Plus, so we use gift cards (customer can use at checkout)

export async function issueStoreCredit(customerId: string, amount: number, note?: string): Promise<{
  success: boolean;
  giftCardId?: string;
  lastCharacters?: string;
  error?: string;
}> {
  if (amount <= 0) {
    return { success: false, error: 'Amount must be greater than 0' };
  }

  const query = `
    mutation CreateGiftCard($input: GiftCardCreateInput!) {
      giftCardCreate(input: $input) {
        giftCard {
          id lastCharacters
          balance { amount }
        }
        userErrors { message field }
      }
    }
  `;

  const data = await shopifyGraphQL(query, {
    input: {
      initialValue: amount.toFixed(2),
      note: note || 'Store credit via Miss Finch Returns',
      customerId,
    },
  });

  const result = data.giftCardCreate;
  if (result.userErrors?.length > 0) {
    return { success: false, error: result.userErrors.map((e: { message: string }) => e.message).join(', ') };
  }

  return {
    success: true,
    giftCardId: result.giftCard.id,
    lastCharacters: result.giftCard.lastCharacters,
  };
}

// ─── Tag an order ───

export async function tagOrder(orderId: string, tags: string[]) {
  const query = `
    mutation TagOrder($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors { message field }
      }
    }
  `;
  return shopifyGraphQL(query, { id: orderId, tags });
}
