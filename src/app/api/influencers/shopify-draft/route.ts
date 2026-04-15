import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { shopifyGraphQL } from '@/lib/shopify';

type Product = { variantId?: string; title?: string; price?: number; quantity?: number; sku?: string };
type ShippingAddress = {
  firstName?: string; lastName?: string;
  address1?: string; address2?: string;
  city?: string; province?: string; zip?: string; country?: string;
  phone?: string;
};

const DRAFT_CREATE_MUTATION = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name invoiceUrl }
      userErrors { field message }
    }
  }
`;

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const { influencer_id } = await req.json();
  if (!influencer_id) return NextResponse.json({ error: 'influencer_id required' }, { status: 400 });

  const { data: inf, error: fetchErr } = await supabase
    .from('influencers').select('*').eq('id', influencer_id).single();
  if (fetchErr || !inf) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });

  const products: Product[] = (inf.products_to_send as Product[]) || [];
  if (products.length === 0) return NextResponse.json({ error: 'No products configured' }, { status: 400 });

  const lineItems = products.map(p => {
    const base: Record<string, unknown> = {
      quantity: Number(p.quantity || 1),
      appliedDiscount: { valueType: 'PERCENTAGE', value: 100, title: 'Influencer gift' },
    };
    if (p.variantId) base.variantId = p.variantId;
    else {
      base.title = p.title || 'Influencer Gift Item';
      base.originalUnitPrice = String(p.price || 0);
    }
    return base;
  });

  const shipping = inf.shipping_address as ShippingAddress | null;
  const shippingAddress = shipping ? {
    firstName: shipping.firstName || '',
    lastName: shipping.lastName || '',
    address1: shipping.address1 || '',
    address2: shipping.address2 || '',
    city: shipping.city || '',
    province: shipping.province || '',
    zip: shipping.zip || '',
    countryCode: (shipping.country || 'US').toUpperCase().slice(0, 2),
    phone: shipping.phone || '',
  } : undefined;

  const input: Record<string, unknown> = {
    lineItems,
    tags: ['influencer-gift'],
    note: `Influencer collab: ${inf.instagram_handle} — ${inf.deal_type || 'gifted'}`,
    useCustomerDefaultAddress: false,
  };
  if (shippingAddress) input.shippingAddress = shippingAddress;

  try {
    const res = await shopifyGraphQL(DRAFT_CREATE_MUTATION, { input });
    const errs = res?.draftOrderCreate?.userErrors || [];
    if (errs.length > 0) {
      return NextResponse.json({ error: errs.map((e: { field: string[]; message: string }) => `${e.field?.join('.')}: ${e.message}`).join('; ') }, { status: 400 });
    }
    const draft = res?.draftOrderCreate?.draftOrder;
    if (!draft) return NextResponse.json({ error: 'Draft not returned' }, { status: 500 });

    await supabase.from('influencers').update({
      shopify_draft_order_id: draft.id,
      shopify_order_name: draft.name,
      updated_at: new Date().toISOString(),
    }).eq('id', influencer_id);

    await supabase.from('influencer_activity_log').insert({
      influencer_id, user_role: 'admin', action: 'shopify_draft_created',
      details: { id: draft.id, name: draft.name, invoiceUrl: draft.invoiceUrl },
    });

    return NextResponse.json({ success: true, draft });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Shopify error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
