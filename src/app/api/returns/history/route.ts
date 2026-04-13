import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const name = new URL(req.url).searchParams.get('customer_name');
  if (!name) return NextResponse.json({ error: 'Missing customer_name' }, { status: 400 });
  const supabase = getServiceClient();
  const { data } = await supabase.from('returns').select('id, order_number, status, type, outcome, subtotal, return_requested').ilike('customer_name', name).order('return_requested', { ascending: false });
  const returns = data || [];
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentReturns = returns.filter(r => r.return_requested && new Date(r.return_requested) > ninetyDaysAgo);
  return NextResponse.json({ totalReturns: returns.length, returnsIn90Days: recentReturns.length, totalReturnValue: returns.reduce((s, r) => s + (r.subtotal || 0), 0), returns: returns.slice(0, 10) });
}
