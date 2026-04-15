import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

const ALLOWED_SORTS = ['created_at', 'follower_count', 'engagement_rate', 'status_changed_at'];

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;
  const sortKey = searchParams.get('sort') || 'created_at';
  const sortDir = searchParams.get('dir') === 'asc';
  const safeSort = ALLOWED_SORTS.includes(sortKey) ? sortKey : 'created_at';

  let query = supabase
    .from('influencers')
    .select('*', { count: 'exact' })
    .order(safeSort, { ascending: sortDir })
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') {
    if (status === 'active') {
      query = query.in('status', ['deal', 'shipped', 'content_pending']);
    } else {
      query = query.eq('status', status);
    }
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ influencers: data, total: count, page, limit });
}

export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const {
    instagram_handle, profile_url, follower_count, engagement_rate,
    niche_tags, content_types, bio_notes, dm_context, already_contacted,
    products_to_send, scraped_data, scraped_at,
    status, created_by = 'intern',
  } = body;

  if (!instagram_handle) return NextResponse.json({ error: 'Handle required' }, { status: 400 });

  const handle = instagram_handle.startsWith('@') ? instagram_handle : `@${instagram_handle}`;
  const newStatus = status === 'watchlist' ? 'watchlist' : 'pending_review';

  const { data, error } = await supabase.from('influencers').insert({
    instagram_handle: handle,
    profile_url: profile_url || null,
    follower_count: follower_count || null,
    engagement_rate: engagement_rate || null,
    niche_tags: niche_tags || [],
    content_types: content_types || [],
    bio_notes: bio_notes || null,
    dm_context: dm_context || null,
    already_contacted: !!already_contacted,
    products_to_send: products_to_send || [],
    scraped_data: scraped_data || null,
    scraped_at: scraped_at || null,
    created_by,
    status: newStatus,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('influencer_activity_log').insert({
    influencer_id: data.id,
    user_role: created_by,
    action: 'submitted',
    details: { handle },
  });

  return NextResponse.json({ influencer: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = getServiceClient();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: inf } = await supabase.from('influencers').select('instagram_handle').eq('id', id).single();
  if (inf) {
    await supabase.from('influencer_activity_log').insert({
      influencer_id: id, user_role: 'admin', action: 'deleted',
      details: { handle: inf.instagram_handle },
    });
  }

  // ON DELETE CASCADE on FK takes care of notes + activity
  const { error } = await supabase.from('influencers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { id, action, user_role = 'admin', ...fields } = body;
  if (!id || !action) return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });

  const now = new Date().toISOString();
  let update: Record<string, unknown> = { updated_at: now };
  let logDetails: Record<string, unknown> = {};

  if (action === 'approve') {
    update.status = 'approved';
    update.status_changed_at = now;
  } else if (action === 'decline') {
    if (!fields.declined_reason) return NextResponse.json({ error: 'Reason required' }, { status: 400 });
    update.status = 'declined';
    update.status_changed_at = now;
    update.declined_reason = fields.declined_reason;
    logDetails = { reason: fields.declined_reason };
  } else if (action === 'counter') {
    if (!fields.counter_note) return NextResponse.json({ error: 'Counter note required' }, { status: 400 });
    update.status = 'countered';
    update.status_changed_at = now;
    update.counter_note = fields.counter_note;
    update.declined_reason = fields.counter_note;
    logDetails = { note: fields.counter_note };
  } else if (action === 'add_to_watchlist' || action === 'watchlist') {
    update.status = 'watchlist';
    update.status_changed_at = now;
  } else if (action === 'content_pending') {
    update.status = 'content_pending';
    update.status_changed_at = now;
  } else if (action === 'move_to_pending') {
    update.status = 'pending_review';
    update.status_changed_at = now;
  } else if (action === 'mark_complete') {
    update.status = 'complete';
    update.status_changed_at = now;
  } else if (action === 'resubmit') {
    update.status = 'pending_review';
    update.status_changed_at = now;
    update.declined_reason = null;
    update.counter_note = null;
    const editable = ['follower_count', 'engagement_rate', 'niche_tags', 'content_types', 'bio_notes', 'dm_context', 'products_to_send'];
    for (const k of editable) if (fields[k] !== undefined) update[k] = fields[k];
  } else if (action === 'mark_content_pending') {
    update.status = 'content_pending';
    update.status_changed_at = now;
  } else if (action === 'set_deal') {
    update = {
      ...update,
      status: 'deal',
      status_changed_at: now,
      deal_type: fields.deal_type,
      payment_amount: fields.payment_amount || 0,
      products_to_send: fields.products_to_send || [],
      deliverables: fields.deliverables || null,
      expected_post_date: fields.expected_post_date || null,
      special_instructions: fields.special_instructions || null,
      discount_code: fields.discount_code || null,
      shipping_address: fields.shipping_address || null,
    };
    logDetails = { deal_type: fields.deal_type, payment_amount: fields.payment_amount };
  } else if (action === 'mark_shipped') {
    update.status = 'shipped';
    update.status_changed_at = now;
    if (fields.shopify_fulfillment_status) update.shopify_fulfillment_status = fields.shopify_fulfillment_status;
  } else if (action === 'log_content') {
    update.content_urls = fields.content_urls || [];
    update.content_posted_date = fields.content_posted_date || now.slice(0, 10);
    update.content_type_posted = fields.content_type_posted || [];
    // Per spec: saving content finalizes to complete (unless mark_complete=false explicitly)
    update.status = fields.mark_complete === false ? 'posted' : 'complete';
    update.status_changed_at = now;
    logDetails = { urls: fields.content_urls };
  } else if (action === 'update_fields') {
    const editable = [
      'follower_count', 'engagement_rate', 'niche_tags', 'content_types',
      'bio_notes', 'dm_context', 'already_contacted', 'profile_url',
      'products_to_send', 'scraped_data', 'scraped_at',
      'post_reach', 'post_impressions', 'post_engagement', 'post_shares', 'post_video_views',
    ];
    for (const k of editable) if (fields[k] !== undefined) update[k] = fields[k];
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data, error } = await supabase.from('influencers').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('influencer_activity_log').insert({
    influencer_id: id, user_role, action, details: logDetails,
  });

  return NextResponse.json({ influencer: data });
}
