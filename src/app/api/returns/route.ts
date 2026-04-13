import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { issueStoreCredit, tagOrder, getOrder } from '@/lib/shopify';

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

// PATCH /api/returns — process a return
export async function PATCH(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { id, action, reject_reason, amount } = body;

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
  const isImported = returnData.imported_from === 'redo';

  if (action === 'credit') {
    let shopifyError = null;

    if (!isImported && returnData.order_number) {
      try {
        const order = await getOrder(returnData.order_number);
        if (order?.customer?.id) {
          await issueStoreCredit(order.customer.id, amount || returnData.subtotal || 0);
        }
        if (order?.id) {
          await tagOrder(order.id, ['mf-return', 'credit-issued']);
        }
      } catch (err) {
        shopifyError = err instanceof Error ? err.message : 'Shopify API error';
        console.error('Shopify credit error:', err);
      }
    }

    const { error } = await supabase
      .from('returns')
      .update({ status: 'done', outcome: 'credit', final_amount: amount || returnData.subtotal || 0, processed_at: now, updated_at: now })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('timeline_events').insert({
      return_id: id, event: 'Store credit issued',
      detail: `$${(amount || returnData.subtotal || 0).toFixed(2)} credit${isImported ? ' (imported — Shopify not called)' : ''}${shopifyError ? ' — Error: ' + shopifyError : ''}`,
      event_date: now,
    });

    return NextResponse.json({ success: true, action: 'credit', shopify_called: !isImported, shopify_error: shopifyError });
  }

  if (action === 'refund') {
    let shopifyError = null;

    if (!isImported && returnData.order_number) {
      try {
        const order = await getOrder(returnData.order_number);
        if (order?.id) {
          await tagOrder(order.id, ['mf-return', 'refund-approved']);
        }
      } catch (err) {
        shopifyError = err instanceof Error ? err.message : 'Shopify API error';
      }
    }

    const { error } = await supabase
      .from('returns')
      .update({ status: 'done', outcome: 'refund', final_amount: amount || returnData.subtotal || 0, processed_at: now, updated_at: now })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('timeline_events').insert({
      return_id: id, event: 'Refund approved',
      detail: `$${(amount || returnData.subtotal || 0).toFixed(2)} refund${isImported ? ' (imported)' : ''}${shopifyError ? ' — Error: ' + shopifyError : ''}`,
      event_date: now,
    });

    return NextResponse.json({ success: true, action: 'refund', shopify_called: !isImported, shopify_error: shopifyError });
  }

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
