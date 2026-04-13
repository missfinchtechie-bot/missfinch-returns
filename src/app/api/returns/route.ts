import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// GET /api/returns?status=inbox&search=sarah
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('returns')
    .select('*', { count: 'exact' })
    .order('return_requested', { ascending: false })
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

// PATCH /api/returns — process a return (issue credit, refund, reject)
export async function PATCH(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { id, action, reject_reason } = body;

  if (!id || !action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (action === 'credit') {
    const { error } = await supabase
      .from('returns')
      .update({
        status: 'done',
        outcome: 'credit',
        processed_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // TODO: Call Shopify storeCreditAccountCredit API
    // TODO: Tag order in Shopify
    // TODO: Create timeline event

    return NextResponse.json({ success: true, action: 'credit' });
  }

  if (action === 'refund') {
    const { error } = await supabase
      .from('returns')
      .update({
        status: 'done',
        outcome: 'refund',
        processed_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // TODO: Call Shopify refundCreate API
    // TODO: Tag order in Shopify
    // TODO: Create timeline event

    return NextResponse.json({ success: true, action: 'refund' });
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('returns')
      .update({
        status: 'done',
        outcome: 'rejected',
        reject_reason: reject_reason || 'No reason provided',
        processed_at: now,
        updated_at: now,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, action: 'reject' });
  }

  if (action === 'received') {
    const { error } = await supabase
      .from('returns')
      .update({
        status: 'inbox',
        delivered_to_us: now,
        updated_at: now,
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, action: 'received' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
