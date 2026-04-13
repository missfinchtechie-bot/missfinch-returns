import { getServiceClient } from './supabase';

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || 'missfinchnyc.myshopify.com';
const API_VERSION = '2026-04';

async function getAccessToken(): Promise<string> {
  // First check env var (for local dev)
  if (process.env.SHOPIFY_ACCESS_TOKEN) {
    return process.env.SHOPIFY_ACCESS_TOKEN;
  }

  // Then check Supabase (where OAuth stores it)
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'shopify_access_token')
    .single();

  if (data?.value) {
    return JSON.parse(data.value);
  }

  throw new Error('No Shopify access token. Visit /api/auth/shopify to connect.');
}

export async function shopifyGraphQL(query: string, variables?: Record<string, unknown>) {
  const token = await getAccessToken();
  const res = await fetch(
    `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

// Fetch an order by order number
export async function getOrder(orderNumber: string) {
  const query = `
    query GetOrder($query: String!) {
      orders(first: 1, query: $query) {
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet { shopMoney { amount currencyCode } }
            customer {
              id
              displayName
              email
              numberOfOrders
              amountSpent { amount currencyCode }
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  variantTitle
                  sku
                  quantity
                  originalUnitPriceSet { shopMoney { amount } }
                  image { url }
                }
              }
            }
            fulfillments(first: 10) {
              trackingInfo { number url company }
              deliveredAt
              createdAt
            }
            paymentGatewayNames
            transactions(first: 5) {
              gateway
              amountSet { shopMoney { amount } }
            }
            shippingAddress {
              address1
              address2
              city
              province
              zip
              country
            }
          }
        }
      }
    }
  `;

  const data = await shopifyGraphQL(query, { query: `name:${orderNumber}` });
  return data.orders.edges[0]?.node || null;
}

// Issue store credit to a customer
export async function issueStoreCredit(customerId: string, amount: number) {
  const query = `
    mutation IssueCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
      storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
        storeCreditAccountTransaction {
          amount { amount currencyCode }
          account { id balance { amount currencyCode } }
        }
        userErrors { message field }
      }
    }
  `;

  return shopifyGraphQL(query, {
    id: customerId,
    creditInput: {
      creditAmount: { amount: amount.toFixed(2), currencyCode: 'USD' },
    },
  });
}

// Create a refund
export async function createRefund(orderId: string, lineItems: { lineItemId: string; quantity: number }[], amount: number) {
  const query = `
    mutation RefundCreate($input: RefundInput!) {
      refundCreate(input: $input) {
        refund {
          id
          totalRefundedSet { shopMoney { amount } }
        }
        userErrors { message field }
      }
    }
  `;

  return shopifyGraphQL(query, {
    input: {
      orderId,
      refundLineItems: lineItems,
      transactions: [],
      note: 'Processed via Miss Finch Returns Dashboard',
    },
  });
}

// Approve a return request
export async function approveReturn(returnId: string) {
  const query = `
    mutation ApproveReturn($id: ID!) {
      returnApproveRequest(input: { id: $id }) {
        return { id status }
        userErrors { message field }
      }
    }
  `;

  return shopifyGraphQL(query, { id: returnId });
}

// Tag an order
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
