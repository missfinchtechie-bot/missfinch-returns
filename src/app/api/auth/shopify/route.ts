import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/shopify — starts the OAuth flow
export async function GET(req: NextRequest) {
  const shop = process.env.SHOPIFY_STORE_DOMAIN || 'missfinchnyc.myshopify.com';
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.missfinchnyc.com'}/api/auth/shopify/callback`;
  
  const scopes = [
    'read_all_orders', 'read_analytics', 'read_customers', 'write_customers',
    'read_fulfillments', 'write_fulfillments', 'read_gift_cards', 'write_gift_cards',
    'read_orders', 'write_orders', 'read_products', 'write_products',
    'read_returns', 'write_returns',
    'read_store_credit_account_transactions', 'write_store_credit_account_transactions',
    'read_store_credit_accounts',
  ].join(',');

  const nonce = Math.random().toString(36).substring(2, 15);

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;

  return NextResponse.redirect(authUrl);
}
