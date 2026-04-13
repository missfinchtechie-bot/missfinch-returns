import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { canAutoApprove, shouldFlag } from '@/lib/fees';

// POST /api/webhooks/shopify — handles returns/request webhook
export async function POST(req: NextRequest) {
  const supabase = getServiceClient();

  // TODO: Verify Shopify HMAC signature
  const body = await req.json();
  const topic = req.headers.get('x-shopify-topic');

  if (topic === 'returns/request') {
    const returnData = body;
    const orderId = returnData.order?.admin_graphql_api_id;
    const returnId = returnData.admin_graphql_api_id;
    const orderName = returnData.order?.name || returnData.name?.split('-')[0];

    // Get customer return history from our DB
    const customerName = `${returnData.order?.customer?.first_name || ''} ${returnData.order?.customer?.last_name || ''}`.trim();

    const { data: customerReturns } = await supabase
      .from('returns')
      .select('id')
      .eq('customer_name', customerName)
      .gte('return_requested', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    const returnsIn90Days = customerReturns?.length || 0;
    const totalItems = returnData.return_line_items?.length || 1;

    // Determine type (we default to credit since we encourage it)
    const type = 'credit'; // Customer choice comes from the portal

    // Check auto-approve
    const autoApprove = canAutoApprove({
      type,
      itemCount: totalItems,
      returnsIn90Days,
      withinWindow: true, // Shopify already enforces window via return rules
    });

    const flag = shouldFlag(returnsIn90Days);

    // Create return in our database
    const { data: newReturn, error } = await supabase
      .from('returns')
      .insert({
        return_number: `MF-${Date.now()}`,
        shopify_order_id: orderId,
        shopify_return_id: returnId,
        order_number: orderName,
        customer_name: customerName,
        customer_email: returnData.order?.customer?.email,
        status: 'shipping', // Label will be sent, waiting for them to ship
        type,
        item_count: totalItems,
        return_requested: new Date().toISOString(),
        is_flagged: flag.flagged,
        flag_reason: flag.reason,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating return:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // TODO: If auto-approved, call Shopify returnApproveRequest
    // TODO: Generate EasyPost return label
    // TODO: Attach label to Shopify return
    // TODO: Create timeline events

    console.log(`Return ${newReturn.return_number} created. Auto-approve: ${autoApprove.approved}. Reason: ${autoApprove.reason}`);

    return NextResponse.json({ success: true, returnId: newReturn.id });
  }

  return NextResponse.json({ ok: true });
}
