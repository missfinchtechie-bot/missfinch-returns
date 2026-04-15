import { NextResponse } from 'next/server';
import { runFullSync } from '@/lib/shopify-financial';

export const maxDuration = 300;

function authorized(req: Request): boolean {
  if (req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true;
  const cookie = req.headers.get('cookie') || '';
  return cookie.includes('mf_auth=authenticated');
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await runFullSync(3);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
