import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

const PERSON_FIELDS = [
  'full_name', 'email', 'profile_url', 'follower_count', 'engagement_rate',
  'niche_tags', 'content_types', 'bio', 'is_verified', 'preferred_sizes',
  'preferred_products', 'shipping_name', 'shipping_address1', 'shipping_address2',
  'shipping_city', 'shipping_state', 'shipping_zip', 'shipping_country',
  'shipping_phone', 'person_status', 'person_notes', 'scraped_data', 'scraped_at',
  'already_contacted',
];

// GET /api/influencers
//   ?status=active|all (default active)
//   ?collab_status=prospect|outreach|... (filters people whose LATEST collab matches)
//   ?search=text
export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const url = new URL(req.url);
  const collabStatus = url.searchParams.get('collab_status');
  const search = url.searchParams.get('search')?.trim().toLowerCase() || '';

  // 1) get all people
  const { data: people, error } = await supabase
    .from('influencers')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2) get all collabs
  const { data: collabs } = await supabase
    .from('influencer_collabs')
    .select('*')
    .order('collab_number', { ascending: false });

  const collabsByPerson = new Map<string, typeof collabs>();
  for (const c of collabs || []) {
    const arr = collabsByPerson.get(c.influencer_id) || [];
    arr.push(c);
    collabsByPerson.set(c.influencer_id, arr);
  }

  // 3) build rollup
  const rows = (people || []).map(p => {
    const personCollabs = collabsByPerson.get(p.id) || [];
    const latest = personCollabs[0] || null;
    const activeCollab = personCollabs.find(c => !['posted', 'passed'].includes(c.status)) || latest;
    return {
      ...p,
      collab_count: personCollabs.length,
      latest_collab: latest,
      active_collab: activeCollab,
      latest_status: activeCollab?.status || 'prospect',
      collabs: personCollabs,
    };
  });

  // 4) filter
  let filtered = rows;
  if (collabStatus && collabStatus !== 'all') {
    filtered = filtered.filter(r => r.latest_status === collabStatus);
  }
  if (search) {
    filtered = filtered.filter(r =>
      [r.instagram_handle, r.full_name, r.email, ...(r.niche_tags || []), r.person_notes, r.bio]
        .filter(Boolean).join(' ').toLowerCase().includes(search)
    );
  }

  return NextResponse.json({ influencers: filtered, total: filtered.length });
}

// POST /api/influencers — create person + first collab in one shot
export async function POST(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const {
    instagram_handle, profile_url, follower_count, engagement_rate,
    niche_tags, content_types, bio_notes, dm_context, already_contacted,
    products_to_send, scraped_data, scraped_at,
    full_name, email,
    status, // collab status
    created_by = 'intern',
  } = body;

  if (!instagram_handle) return NextResponse.json({ error: 'Handle required' }, { status: 400 });

  const handle = instagram_handle.startsWith('@') ? instagram_handle : `@${instagram_handle}`;

  // Find existing person OR insert new
  const { data: existing } = await supabase
    .from('influencers').select('id').eq('instagram_handle', handle).maybeSingle();

  let personId = existing?.id;
  if (!personId) {
    const { data: created, error } = await supabase.from('influencers').insert({
      instagram_handle: handle,
      profile_url: profile_url || null,
      follower_count: follower_count || null,
      engagement_rate: engagement_rate || null,
      niche_tags: niche_tags || [],
      content_types: content_types || [],
      bio: scraped_data?.biography || null,
      full_name: full_name || scraped_data?.fullName || null,
      email: email || null,
      is_verified: !!scraped_data?.isVerified,
      person_notes: bio_notes || null,
      already_contacted: !!already_contacted,
      scraped_data: scraped_data || null,
      scraped_at: scraped_at || null,
      created_by,
    }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    personId = created!.id;
  }

  // Determine next collab number
  const { data: lastCollab } = await supabase
    .from('influencer_collabs').select('collab_number')
    .eq('influencer_id', personId)
    .order('collab_number', { ascending: false }).limit(1).maybeSingle();
  const nextNumber = (lastCollab?.collab_number || 0) + 1;

  const collabStatus = status === 'watchlist' ? 'watchlist' : (status || 'prospect');

  const { data: collab, error: cErr } = await supabase.from('influencer_collabs').insert({
    influencer_id: personId,
    collab_number: nextNumber,
    status: collabStatus,
    intern_notes: bio_notes || null,
    dm_context: dm_context || null,
    products: products_to_send || [],
    created_by,
  }).select().single();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  await supabase.from('influencer_activity_log').insert({
    influencer_id: personId, collab_id: collab.id,
    user_role: created_by, action: 'collab_created',
    details: { collab_number: nextNumber, handle },
  });

  return NextResponse.json({ influencer_id: personId, collab });
}

// PATCH /api/influencers — person-level updates only
export async function PATCH(req: NextRequest) {
  const supabase = getServiceClient();
  const body = await req.json();
  const { id, action, user_role = 'admin', ...fields } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (action === 'update_profile') {
    for (const k of PERSON_FIELDS) if (fields[k] !== undefined) update[k] = fields[k];
  } else if (action === 'update_address') {
    const addrFields = ['shipping_name', 'shipping_address1', 'shipping_address2', 'shipping_city', 'shipping_state', 'shipping_zip', 'shipping_country', 'shipping_phone'];
    for (const k of addrFields) if (fields[k] !== undefined) update[k] = fields[k];
  } else if (action === 'rescrape') {
    if (fields.scraped_data) update.scraped_data = fields.scraped_data;
    if (fields.scraped_at) update.scraped_at = fields.scraped_at;
    if (fields.follower_count !== undefined) update.follower_count = fields.follower_count;
    if (fields.engagement_rate !== undefined) update.engagement_rate = fields.engagement_rate;
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data, error } = await supabase.from('influencers').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('influencer_activity_log').insert({
    influencer_id: id, user_role, action, details: {},
  });

  return NextResponse.json({ influencer: data });
}

// DELETE /api/influencers?id=xxx — removes person and cascades collabs/notes/activity
export async function DELETE(req: NextRequest) {
  const supabase = getServiceClient();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('influencers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
