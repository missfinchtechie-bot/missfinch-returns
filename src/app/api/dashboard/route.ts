import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getServiceClient();
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Revenue 30d
  const { data: orders30 } = await supabase.from('shopify_orders')
    .select('subtotal_price').gte('created_at', d30).eq('test', false).is('cancelled_at', null);
  const revenue30 = (orders30 || []).reduce((s, o) => s + (Number(o.subtotal_price) || 0), 0);
  const orderCount30 = (orders30 || []).length;

  // Returns
  const { count: inboxCount } = await supabase.from('returns').select('*', { count: 'exact', head: true }).eq('status', 'inbox');
  const { count: returnsThisMonth } = await supabase.from('returns').select('*', { count: 'exact', head: true }).gte('return_requested', monthStart);
  const returnRate = orderCount30 > 0 ? ((returnsThisMonth || 0) / orderCount30) * 100 : 0;

  // Active collabs
  const { data: collabs } = await supabase.from('influencer_collabs')
    .select('status').not('status', 'in', '("posted","passed","watchlist")');
  const activeCollabs = (collabs || []).length;

  // Needs action = negotiating + approved collabs + inbox returns
  const { count: negotiating } = await supabase.from('influencer_collabs').select('*', { count: 'exact', head: true }).eq('status', 'negotiating');
  const { count: approved } = await supabase.from('influencer_collabs').select('*', { count: 'exact', head: true }).eq('status', 'approved');
  const needsAction = (negotiating || 0) + (approved || 0) + (inboxCount || 0);

  // Recent activity (last 10 events across tabs)
  const [{ data: recentReturns }, { data: recentCollabs }, { data: recentActivity }] = await Promise.all([
    supabase.from('returns').select('id, order_number, customer_name, status, outcome, return_requested').order('return_requested', { ascending: false }).limit(5),
    supabase.from('influencer_collabs').select('id, influencer_id, collab_number, status, status_changed_at, created_at')
      .order('status_changed_at', { ascending: false }).limit(5),
    supabase.from('influencer_activity_log').select('id, action, user_role, created_at, details')
      .order('created_at', { ascending: false }).limit(5),
  ]);

  // Get influencer handles for collab display
  const collabInfluencerIds = [...new Set((recentCollabs || []).map(c => c.influencer_id))];
  let handleMap: Record<string, string> = {};
  if (collabInfluencerIds.length > 0) {
    const { data: infs } = await supabase.from('influencers').select('id, instagram_handle').in('id', collabInfluencerIds);
    handleMap = Object.fromEntries((infs || []).map(i => [i.id, i.instagram_handle]));
  }

  type FeedItem = { type: string; text: string; date: string; link: string };
  const feed: FeedItem[] = [];
  for (const r of recentReturns || []) {
    feed.push({
      type: 'return',
      text: `${r.customer_name} — ${r.order_number} · ${r.outcome || r.status}`,
      date: r.return_requested || '',
      link: '/admin',
    });
  }
  for (const c of recentCollabs || []) {
    const handle = handleMap[c.influencer_id] || '?';
    feed.push({
      type: 'collab',
      text: `${handle} collab #${c.collab_number} → ${c.status}`,
      date: c.status_changed_at || c.created_at || '',
      link: '/admin/influencers',
    });
  }
  for (const a of recentActivity || []) {
    feed.push({
      type: 'activity',
      text: `${a.action.replace(/_/g, ' ')}${a.user_role ? ` (${a.user_role})` : ''}`,
      date: a.created_at || '',
      link: '/admin/influencers',
    });
  }
  feed.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({
    kpis: {
      revenue30: Math.round(revenue30 * 100) / 100,
      orderCount30,
      inboxCount: inboxCount || 0,
      activeCollabs,
      needsAction,
      returnRate: Math.round(returnRate * 10) / 10,
    },
    feed: feed.slice(0, 10),
  });
}
