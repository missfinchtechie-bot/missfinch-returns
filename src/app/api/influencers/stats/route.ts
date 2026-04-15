import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET() {
  const supabase = getServiceClient();

  const statuses = ['pending_review', 'countered', 'approved', 'declined', 'deal', 'shipped', 'content_pending', 'posted', 'complete'];
  const counts: Record<string, number> = {};

  await Promise.all(statuses.map(async s => {
    const { count } = await supabase.from('influencers').select('*', { count: 'exact', head: true }).eq('status', s);
    counts[s] = count || 0;
  }));

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const { count: shippedThisMonth } = await supabase
    .from('influencers').select('*', { count: 'exact', head: true })
    .eq('status', 'shipped').gte('status_changed_at', monthStart);

  const { count: postsThisMonth } = await supabase
    .from('influencers').select('*', { count: 'exact', head: true })
    .gte('content_posted_date', monthStart.slice(0, 10));

  const { data: monthDeals } = await supabase
    .from('influencers').select('products_to_send')
    .in('status', ['shipped', 'posted', 'complete'])
    .gte('status_changed_at', monthStart);

  type Product = { price?: number; quantity?: number };
  const giftedValue = (monthDeals || []).reduce((sum, d) => {
    const products = (d.products_to_send as Product[]) || [];
    return sum + products.reduce((s, p) => s + (Number(p.price || 0) * Number(p.quantity || 1)), 0);
  }, 0);

  const { data: allTimeRows } = await supabase
    .from('influencers').select('products_to_send')
    .in('status', ['shipped', 'posted', 'complete', 'content_pending']);
  const totalGiftedAllTime = (allTimeRows || []).reduce((sum, d) => {
    const products = (d.products_to_send as Product[]) || [];
    return sum + products.reduce((s, p) => s + (Number(p.price || 0) * Number(p.quantity || 1)), 0);
  }, 0);

  const { count: totalInfluencers } = await supabase
    .from('influencers').select('*', { count: 'exact', head: true });

  return NextResponse.json({
    pipeline: counts,
    thisMonth: {
      shipped: shippedThisMonth || 0,
      giftedValue: Math.round(giftedValue * 100) / 100,
      posts: postsThisMonth || 0,
    },
    allTime: {
      totalGifted: Math.round(totalGiftedAllTime * 100) / 100,
      totalInfluencers: totalInfluencers || 0,
    },
  });
}
