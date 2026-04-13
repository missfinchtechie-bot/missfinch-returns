import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// GET /api/auth/shopify/callback — Shopify redirects here after authorization
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');

  if (!code || !shop) {
    return NextResponse.json({ error: 'Missing code or shop' }, { status: 400 });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  // Exchange the authorization code for an access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: `Token exchange failed: ${text}` }, { status: 500 });
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Store the token in Supabase settings
  const supabase = getServiceClient();
  await supabase
    .from('settings')
    .upsert({
      key: 'shopify_access_token',
      value: JSON.stringify(accessToken),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  // Also store the shop domain
  await supabase
    .from('settings')
    .upsert({
      key: 'shopify_shop_domain',
      value: JSON.stringify(shop),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  // Redirect back to the admin dashboard
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.missfinchnyc.com';
  return NextResponse.redirect(`${appUrl}/admin?shopify=connected`);
}
