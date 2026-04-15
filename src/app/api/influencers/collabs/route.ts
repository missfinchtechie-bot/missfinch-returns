import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

const COLLAB_FIELDS = [
  'deal_type', 'payment_amount', 'payment_method', 'deliverables',
  'num_reels', 'num_stories', 'num_posts', 'discount_code', 'commission_rate',
  'special_instructions', 'products', 'total_gift_value', 'shipping_override',
  'shopify_draft_order_id', 'shopify_order_id', 'shopify_order_name',
  'shopify_order_status', 'tracking_number', 'tracking_carrier', 'tracking_url',
  'shipped_at', 'delivered_at',
  'content_urls', 'content_posted_date', 'content_types_posted',
  'post_reach', 'post_impressions', 'post_engagement',
  'exchange_requested', 'exchange_items', 'exchange_return_tracking', 'exchange_return_received',
  'admin_notes', 'intern_notes', 'dm_context', 'counter_note', 'declined_reason',
  'expected_post_date',
];

// POST /api/influencers/collabs — start a new collab on an existing influencer
export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { influencer_id, status = 'negotiating', user_role = 'admin', ...fields } = body;
  if (!influencer_id) return NextResponse.json({ error: 'influencer_id required' }, { status: 400 });

  const { data: lastCollab } = await supabase
    .from('influencer_collabs').select('collab_number')
    .eq('influencer_id', influencer_id)
    .order('collab_number', { ascending: false }).limit(1).maybeSingle();
  const nextNumber = (lastCollab?.collab_number || 0) + 1;

  const insert: Record<string, unknown> = {
    influencer_id,
    collab_number: nextNumber,
    status,
    created_by: user_role,
  };
  for (const k of COLLAB_FIELDS) if (fields[k] !== undefined) insert[k] = fields[k];

  const { data, error } = await supabase.from('influencer_collabs').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('influencer_activity_log').insert({
    influencer_id, collab_id: data.id, user_role,
    action: 'collab_created', details: { collab_number: nextNumber },
  });

  return NextResponse.json({ collab: data });
}

// PATCH /api/influencers/collabs — actions on a specific collab
export async function PATCH(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { id, action, user_role = 'admin', ...fields } = body;
  if (!id || !action) return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  let logDetails: Record<string, unknown> = {};

  if (action === 'start_outreach') { update.status = 'outreach'; update.status_changed_at = now; }
  else if (action === 'move_to_negotiating') { update.status = 'negotiating'; update.status_changed_at = now; }
  else if (action === 'approve') { update.status = 'approved'; update.status_changed_at = now; update.counter_note = null; }
  else if (action === 'send_notes') {
    if (!fields.counter_note) return NextResponse.json({ error: 'Note required' }, { status: 400 });
    update.status = 'negotiating';
    update.counter_note = fields.counter_note;
    logDetails = { note: fields.counter_note };
    const { data: collab } = await supabase.from('influencer_collabs').select('influencer_id').eq('id', id).single();
    if (collab) {
      await supabase.from('influencer_notes').insert({
        influencer_id: collab.influencer_id, collab_id: id,
        user_name: 'Ryan', user_role: 'admin', note_text: fields.counter_note,
      });
    }
  }
  else if (action === 'pass') {
    update.status = 'passed';
    update.status_changed_at = now;
    if (fields.declined_reason) update.declined_reason = fields.declined_reason;
    logDetails = { reason: fields.declined_reason };
  }
  else if (action === 'reopen') { update.status = 'prospect'; update.status_changed_at = now; update.declined_reason = null; }
  else if (action === 'move_to_watchlist') { update.status = 'watchlist'; update.status_changed_at = now; }
  else if (action === 'mark_shipped') {
    update.status = 'shipped';
    update.status_changed_at = now;
    update.shipped_at = now;
    if (fields.shopify_order_status) update.shopify_order_status = fields.shopify_order_status;
  }
  else if (action === 'mark_posted') {
    update.status = 'posted';
    update.status_changed_at = now;
    update.completed_at = now;
    if (fields.content_urls) update.content_urls = fields.content_urls;
    if (fields.content_posted_date) update.content_posted_date = fields.content_posted_date;
    if (fields.content_types_posted) update.content_types_posted = fields.content_types_posted;
  }
  else if (action === 'set_deal') {
    update.status = 'approved';
    update.status_changed_at = now;
    for (const k of COLLAB_FIELDS) if (fields[k] !== undefined) update[k] = fields[k];
    logDetails = { deal_type: fields.deal_type, payment_amount: fields.payment_amount };
  }
  else if (action === 'update_fields') {
    for (const k of COLLAB_FIELDS) if (fields[k] !== undefined) update[k] = fields[k];
  }
  else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data, error } = await supabase.from('influencer_collabs').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('influencer_activity_log').insert({
    influencer_id: data.influencer_id, collab_id: id, user_role, action, details: logDetails,
  });

  return NextResponse.json({ collab: data });
}

// DELETE /api/influencers/collabs?id=xxx
export async function DELETE(req: NextRequest) {
  const supabase = getServiceClient();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await supabase.from('influencer_collabs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
