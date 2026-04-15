import { NextRequest, NextResponse } from 'next/server';
import { scrapeInstagramProfile } from '@/lib/instagram';
import { getServiceClient } from '@/lib/supabase';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const handle = new URL(req.url).searchParams.get('handle') || '';
  const clean = handle.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return NextResponse.json({ error: 'handle required' }, { status: 400 });

  if (!process.env.APIFY_API_TOKEN) {
    return NextResponse.json({ error: 'Scraper not configured', manual: true }, { status: 200 });
  }

  const supabase = getServiceClient();

  // Cache check
  const { data: cached } = await supabase
    .from('instagram_cache').select('data, scraped_at').eq('handle', clean).maybeSingle();
  if (cached?.scraped_at && Date.now() - new Date(cached.scraped_at).getTime() < CACHE_TTL_MS) {
    return NextResponse.json({ profile: cached.data, cached: true, scraped_at: cached.scraped_at });
  }

  const profile = await scrapeInstagramProfile(clean);
  if (!profile) return NextResponse.json({ error: 'Scrape failed', manual: true }, { status: 200 });

  await supabase.from('instagram_cache').upsert({
    handle: clean,
    data: profile,
    scraped_at: new Date().toISOString(),
  });

  return NextResponse.json({ profile, cached: false, scraped_at: new Date().toISOString() });
}
