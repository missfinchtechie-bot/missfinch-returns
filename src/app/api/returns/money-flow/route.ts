import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

type Row = {
  status: string;
  type: string;
  outcome: string | null;
  subtotal: number | null;
  final_amount: number | null;
  total_fees: number | null;
  bonus_amount: number | null;
};

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let q = supabase
    .from('returns')
    .select('status, type, outcome, subtotal, final_amount, total_fees, bonus_amount');
  if (from) q = q.gte('return_requested', from);
  if (to) q = q.lte('return_requested', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows: Row[] = data || [];

  const sum = (arr: Row[], pick: (r: Row) => number) => arr.reduce((s, r) => s + (pick(r) || 0), 0);
  const num = (v: number | null | undefined) => Number(v) || 0;

  const refunds = rows.filter(r => r.outcome === 'refund');
  const credits = rows.filter(r => r.outcome === 'credit');
  const rejected = rows.filter(r => r.outcome === 'rejected');
  const lost = rows.filter(r => r.outcome === 'lost');

  // Cash refunded: final_amount when present, else fall back to subtotal (pre-fee engine data)
  const cashRefunded = sum(refunds, r => num(r.final_amount) > 0 ? num(r.final_amount) : num(r.subtotal));
  const creditsIssued = sum(credits, r => num(r.final_amount) > 0 ? num(r.final_amount) : num(r.subtotal));

  const rejectedValue = sum(rejected, r => num(r.subtotal));

  // Fees: total_fees when set; else derived (subtotal - final_amount) when final_amount > 0
  const feesCollected = sum(refunds, r => {
    if (num(r.total_fees) > 0) return num(r.total_fees);
    if (num(r.final_amount) > 0 && num(r.subtotal) > num(r.final_amount)) return num(r.subtotal) - num(r.final_amount);
    return 0;
  });

  const bonusesGiven = sum(credits, r => {
    if (num(r.bonus_amount) > 0) return num(r.bonus_amount);
    if (num(r.final_amount) > num(r.subtotal)) return num(r.final_amount) - num(r.subtotal);
    return 0;
  });

  const pendingRefunds = sum(rows.filter(r => r.status === 'inbox' && r.type === 'refund'), r => num(r.subtotal));
  const pendingCredits = sum(rows.filter(r => r.status === 'inbox' && r.type !== 'refund'), r => num(r.subtotal));
  const backlogOwed = sum(rows.filter(r => r.status === 'old'), r => num(r.subtotal));
  const inTransitValue = sum(rows.filter(r => r.status === 'shipping'), r => num(r.subtotal));
  const lostValue = sum(lost, r => num(r.subtotal));

  const totalReturnValue = sum(rows, r => num(r.subtotal));
  const totalPaidOut = cashRefunded + creditsIssued;
  const totalKept = rejectedValue + feesCollected;
  const totalPending = pendingRefunds + pendingCredits + backlogOwed;

  const legacyRefundsNoAmount = refunds.filter(r => !num(r.final_amount)).length;
  const legacyCreditsNoAmount = credits.filter(r => !num(r.final_amount)).length;

  const round = (n: number) => Math.round(n * 100) / 100;

  return NextResponse.json({
    cashRefunded: round(cashRefunded),
    creditsIssued: round(creditsIssued),
    rejectedValue: round(rejectedValue),
    feesCollected: round(feesCollected),
    bonusesGiven: round(bonusesGiven),
    pendingRefunds: round(pendingRefunds),
    pendingCredits: round(pendingCredits),
    backlogOwed: round(backlogOwed),
    inTransitValue: round(inTransitValue),
    lostValue: round(lostValue),
    totalReturnValue: round(totalReturnValue),
    totalPaidOut: round(totalPaidOut),
    totalKept: round(totalKept),
    totalPending: round(totalPending),
    legacyRefundsNoAmount,
    legacyCreditsNoAmount,
    counts: {
      refund: refunds.length,
      credit: credits.length,
      rejected: rejected.length,
      lost: lost.length,
      inbox: rows.filter(r => r.status === 'inbox').length,
      shipping: rows.filter(r => r.status === 'shipping').length,
      old: rows.filter(r => r.status === 'old').length,
    },
  });
}
