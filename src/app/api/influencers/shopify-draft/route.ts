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
  const { collab_id } = await req.json();
  if (!collab_id) return NextResponse.json({ error: 'collab_id required' }, { status: 400 });

  const { data: collab, error: cErr } = await supabase
    .from('influencer_collabs').select('*').eq('id', collab_id).single();
  if (cErr || !collab) return NextResponse.json({ error: 'Collab not found' }, { status: 404 });

  const { data: inf } = await supabase
    .from('influencers').select('*').eq('id', collab.influencer_id).single();
  if (!inf) return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });

  const products: Product[] = (collab.products as Product[]) || [];
  if (products.length === 0) return NextResponse.json({ error: 'No products on this collab' }, { status: 400 });

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

  // Address: collab.shipping_override beats influencer.shipping_*
  const ov = collab.shipping_override as ShippingAddress | null;
  const useOverride = ov && (ov.address1 || ov.firstName);
  const shippingAddress = useOverride ? {
    firstName: ov!.firstName || '', lastName: ov!.lastName || '',
    address1: ov!.address1 || '', address2: ov!.address2 || '',
    city: ov!.city || '', province: ov!.province || '',
    zip: ov!.zip || '',
    countryCode: (ov!.country || 'US').toUpperCase().slice(0, 2),
    phone: ov!.phone || '',
  } : (inf.shipping_address1 ? {
    firstName: (inf.shipping_name || '').split(' ').slice(0, -1).join(' ') || inf.shipping_name || '',
    lastName: (inf.shipping_name || '').split(' ').slice(-1).join(' ') || '',
    address1: inf.shipping_address1, address2: inf.shipping_address2 || '',
    city: inf.shipping_city || '', province: inf.shipping_state || '',
    zip: inf.shipping_zip || '',
    countryCode: (inf.shipping_country || 'US').toUpperCase().slice(0, 2),
    phone: inf.shipping_phone || '',
  } : null);

  if (!shippingAddress) {
    return NextResponse.json({ error: 'Enter shipping address first' }, { status: 400 });
  }

  const input: Record<string, unknown> = {
    lineItems,
    tags: ['influencer-gift'],
    note: `Influencer collab #${collab.collab_number}: ${inf.instagram_handle} — ${collab.deal_type || 'gifted'}`,
    useCustomerDefaultAddress: false,
    shippingAddress,
  };

  try {
    const res = await shopifyGraphQL(DRAFT_CREATE_MUTATION, { input });
    const errs = res?.draftOrderCreate?.userErrors || [];
    if (errs.length > 0) {
      return NextResponse.json({ error: errs.map((e: { field: string[]; message: string }) => `${e.field?.join('.')}: ${e.message}`).join('; ') }, { status: 400 });
    }
    const draft = res?.draftOrderCreate?.draftOrder;
    if (!draft) return NextResponse.json({ error: 'Draft not returned' }, { status: 500 });

    await supabase.from('influencer_collabs').update({
      shopify_draft_order_id: draft.id,
      shopify_order_name: draft.name,
      shopify_order_status: 'draft',
      status: 'shipped',
      status_changed_at: new Date().toISOString(),
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', collab_id);

    await supabase.from('influencer_activity_log').insert({
      influencer_id: collab.influencer_id, collab_id,
      user_role: 'admin', action: 'shopify_draft_created',
      details: { id: draft.id, name: draft.name, invoiceUrl: draft.invoiceUrl },
    });

    return NextResponse.json({ success: true, draft });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Shopify error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
