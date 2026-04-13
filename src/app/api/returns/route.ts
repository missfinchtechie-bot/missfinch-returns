import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { getOrder, issueStoreCredit, executeRefund, tagOrder } from '@/lib/shopify';

// GET /api/returns?status=inbox&search=sarah&sort=return_requested&dir=desc
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;
  const sortKey = searchParams.get('sort') || 'return_requested';
  const sortDir = searchParams.get('dir') === 'asc';

  // Validate sort key
  const allowedSorts = ['order_number', 'customer_name', 'subtotal', 'type', 'return_requested', 'status', 'item_count'];
  const safeSort = allowedSorts.includes(sortKey) ? sortKey : 'return_requested';

  let query = supabase
    .from('returns')
    .select('*', { count: 'exact' })
    .order(safeSort, { ascending: sortDir })
    .range(offset, offset + limit - 1);

  if (status && !search) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,order_number.ilike.%${search}%,return_number.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ returns: data, total: count, page, limit });
}

// PATCH /api/returns — process a return (EXECUTES REAL SHOPIFY ACTIONS)
export async function PATCH(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { id, action, reject_reason, amount, force_shopify } = body;

  if (!id || !action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
  }

  const { data: returnData, error: fetchError } = await supabase
    .from('returns')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !returnData) {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const isImported = returnData.imported_from === 'redo' && !force_shopify;
  const refundAmount = amount || returnData.subtotal || 0;

  // ─── STORE CREDIT (gift card) ───
  if (action === 'credit') {
    let shopifyResult: { giftCardId?: string; lastCharacters?: string; error?: string } = {};

    if (!isImported && returnData.order_number) {
      try {
        const order = await getOrder(returnData.order_number);
        if (!order?.customer?.id) {
          return NextResponse.json({ error: 'Customer not found on this order' }, { status: 400 });
        }

        // Issue gift card as store credit
        const creditResult = await issueStoreCredit(
          order.customer.id,
          refundAmount,
          `Store credit for return ${returnData.order_number} (${returnData.return_number})`
        );

        if (!creditResult.success) {
          return NextResponse.json({ error: `Shopify error: ${creditResult.error}` }, { status: 500 });
        }

        shopifyResult = creditResult;

        // Tag the order
        await tagOrder(order.id, ['mf-return', 'credit-issued']).catch(() => {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Shopify API error';
        console.error('Credit error:', err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Update return record
    const { error } = await supabase
      .from('returns')
      .update({
        status: 'done', outcome: 'credit',
        final_amount: refundAmount, processed_at: now, updated_at: now,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('timeline_events').insert({
      return_id: id,
      event: 'Store credit issued',
      detail: isImported
        ? `$${refundAmount.toFixed(2)} credit (Redo import — Shopify not called)`
        : `$${refundAmount.toFixed(2)} gift card issued (ending ${shopifyResult.lastCharacters || '?'})`,
      event_date: now,
    });

    return NextResponse.json({ success: true, action: 'credit', shopify_called: !isImported, ...shopifyResult });
  }

  // ─── REFUND (to original payment method) ───
  if (action === 'refund') {
    let refundResult: { refundId?: string; amountRefunded?: number; error?: string } = {};

    if (!isImported && returnData.order_number) {
      try {
        const order = await getOrder(returnData.order_number);
        if (!order?.id) {
          return NextResponse.json({ error: 'Order not found in Shopify' }, { status: 400 });
        }

        // Execute real refund — executeRefund caps at maximum_refundable automatically
        const result = await executeRefund(
          order.id,
          refundAmount,
          `Refund for return ${returnData.order_number} (${returnData.return_number})`
        );

        if (!result.success) {
          return NextResponse.json({ error: `Shopify refund failed: ${result.error}` }, { status: 500 });
        }

        refundResult = result;

        // Tag the order
        await tagOrder(order.id, ['mf-return', 'refunded']).catch(() => {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Shopify API error';
        console.error('Refund error:', err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    const actualAmount = refundResult.amountRefunded || refundAmount;

    const { error } = await supabase
      .from('returns')
      .update({
        status: 'done', outcome: 'refund',
        final_amount: actualAmount, processed_at: now, updated_at: now,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('timeline_events').insert({
      return_id: id,
      event: 'Refund issued',
      detail: isImported
        ? `$${refundAmount.toFixed(2)} refund (Redo import — Shopify not called)`
        : `$${actualAmount.toFixed(2)} refunded to original payment method`,
      event_date: now,
    });

    return NextResponse.json({ success: true, action: 'refund', shopify_called: !isImported, ...refundResult });
  }

  // ─── REJECT ───
  if (action === 'reject') {
    const { error } = await supabase
      .from('returns')
      .update({ status: 'done', outcome: 'rejected', reject_reason: reject_reason || 'No reason', processed_at: now, updated_at: now })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('timeline_events').insert({
      return_id: id, event: 'Return rejected', detail: `Reason: ${reject_reason || 'No reason'}`, event_date: now,
    });

    return NextResponse.json({ success: true, action: 'reject' });
  }

  // ─── MARK RECEIVED ───
  if (action === 'received') {
    const { error } = await supabase
      .from('returns')
      .update({ status: 'inbox', delivered_to_us: now, updated_at: now })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('timeline_events').insert({
      return_id: id, event: 'Item received', detail: 'Marked as received at warehouse', event_date: now,
    });

    return NextResponse.json({ success: true, action: 'received' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
