import { NextResponse } from 'next/server';
import { runFullSync } from '@/lib/shopify-financial';

export const maxDuration = 300;

function authorized(req: Request): boolean {
  if (req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true;
  const cookie = req.headers.get('cookie') || '';
  return /mf_auth=(authenticated|admin)(;|$)/.test(cookie);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const daysParam = url.searchParams.get('days');
  // 'all' or 'full' = sync everything since 2009 (Miss Finch founding year). No clamp.
  const allTime = daysParam === 'all' || daysParam === 'full';
  const days = allTime ? 6000 : Math.min(Math.max(parseInt(daysParam || '2', 10), 1), 6000);

  try {
    const result = await runFullSync(days);
    return NextResponse.json({ success: true, ...result, allTime });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
