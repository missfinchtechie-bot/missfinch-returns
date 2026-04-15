import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

type CollabRow = {
  influencer_id: string;
  status: string;
  total_gift_value: number | null;
  payment_amount: number | null;
  status_changed_at: string;
  content_posted_date: string | null;
};

export async function GET() {
  const supabase = getServiceClient();

  // All collabs to compute pipeline + totals
  const { data: collabs } = await supabase
    .from('influencer_collabs')
    .select('influencer_id, status, total_gift_value, payment_amount, status_changed_at, content_posted_date')
    .order('collab_number', { ascending: false });

  // Latest collab per person → "active state" for that person
  const latestByPerson = new Map<string, CollabRow>();
  for (const c of (collabs || []) as CollabRow[]) {
    if (!latestByPerson.has(c.influencer_id)) latestByPerson.set(c.influencer_id, c);
  }

  const pipeline: Record<string, number> = {
    prospect: 0, outreach: 0, negotiating: 0, approved: 0,
    shipped: 0, posted: 0, watchlist: 0, passed: 0,
  };
  for (const c of latestByPerson.values()) {
    pipeline[c.status] = (pipeline[c.status] || 0) + 1;
  }

  // This-month + all-time
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  let shippedThisMonth = 0;
  let giftedThisMonth = 0;
  let postsThisMonth = 0;
  let totalGifted = 0;
  let activeCollabsCount = 0;
  for (const c of (collabs || []) as CollabRow[]) {
    if (c.status === 'shipped' && c.status_changed_at >= monthStart) shippedThisMonth++;
    if (['shipped', 'posted'].includes(c.status) && c.status_changed_at >= monthStart) {
      giftedThisMonth += Number(c.total_gift_value) || 0;
    }
    if (c.content_posted_date && c.content_posted_date >= monthStart.slice(0, 10)) postsThisMonth++;
    if (['shipped', 'posted'].includes(c.status)) totalGifted += Number(c.total_gift_value) || 0;
    if (!['posted', 'passed', 'watchlist'].includes(c.status)) activeCollabsCount++;
  }

  const { count: totalInfluencers } = await supabase
    .from('influencers').select('*', { count: 'exact', head: true });

  return NextResponse.json({
    pipeline,
    activeCollabs: activeCollabsCount,
    thisMonth: {
      shipped: shippedThisMonth,
      giftedValue: Math.round(giftedThisMonth * 100) / 100,
      posts: postsThisMonth,
    },
    allTime: {
      totalGifted: Math.round(totalGifted * 100) / 100,
      totalInfluencers: totalInfluencers || 0,
      totalCollabs: (collabs || []).length,
    },
  });
}
