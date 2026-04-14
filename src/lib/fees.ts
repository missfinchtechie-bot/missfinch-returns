// Miss Finch NYC — Return Fee & Bonus Engine

// Current: 5% restocking on refunds, free for credit/exchange
// Future tiers defined but not active

export function getCurrentFee(type: 'credit' | 'refund' | 'exchange', subtotal: number): number {
  if (type === 'refund') return Math.round(subtotal * 0.05 * 100) / 100;
  return 0;
}

// Store Credit Bonus Config
export const BONUS_CONFIG = {
  percent: 5,
  maxBonusDollars: 25,
  frequencyCapCount: 2,       // max bonuses per customer per window
  frequencyCapDays: 90,
  eligiblePayments: ['card'] as string[],
  excludeExchangeOrders: true,
  excludeImportedReturns: true,
};

export function calculateBonus(params: {
  subtotal: number;
  paidWith: 'card' | 'store_credit' | 'gift_card' | 'mixed';
  isExchangeOrder: boolean;
  isImported: boolean;
  bonusesIn90Days: number;
}): { eligible: boolean; amount: number; reason: string } {
  const { subtotal, paidWith, isExchangeOrder, isImported, bonusesIn90Days } = params;

  if (!BONUS_CONFIG.eligiblePayments.includes(paidWith))
    return { eligible: false, amount: 0, reason: 'Bonus only on card-paid orders' };
  if (BONUS_CONFIG.excludeExchangeOrders && isExchangeOrder)
    return { eligible: false, amount: 0, reason: 'No bonus on exchange orders' };
  if (BONUS_CONFIG.excludeImportedReturns && isImported)
    return { eligible: false, amount: 0, reason: 'Bonus only for portal returns' };
  if (bonusesIn90Days >= BONUS_CONFIG.frequencyCapCount)
    return { eligible: false, amount: 0, reason: `Limit reached (${BONUS_CONFIG.frequencyCapCount} in ${BONUS_CONFIG.frequencyCapDays}d)` };

  let bonus = Math.round(subtotal * (BONUS_CONFIG.percent / 100) * 100) / 100;
  if (bonus > BONUS_CONFIG.maxBonusDollars) bonus = BONUS_CONFIG.maxBonusDollars;

  return { eligible: true, amount: bonus, reason: `${BONUS_CONFIG.percent}% store credit bonus` };
}

export function calculateReturn(params: {
  type: 'credit' | 'refund' | 'exchange';
  subtotal: number;
  itemCount: number;
  paidWith: 'card' | 'store_credit' | 'gift_card' | 'mixed';
  isExchangeOrder?: boolean;
  isImported?: boolean;
  bonusesIn90Days?: number;
}) {
  const { type, subtotal, itemCount, paidWith, isExchangeOrder = false, isImported = false, bonusesIn90Days = 0 } = params;
  const fee = getCurrentFee(type, subtotal);

  let bonus = { eligible: false, amount: 0, reason: '' };
  if (type === 'credit') {
    bonus = calculateBonus({ subtotal: subtotal - fee, paidWith, isExchangeOrder, isImported, bonusesIn90Days });
  }

  return {
    subtotal, itemCount, fee,
    bonusAmount: bonus.amount, bonusEligible: bonus.eligible, bonusReason: bonus.reason,
    finalAmount: Math.round((subtotal - fee + bonus.amount) * 100) / 100,
    type, paidWith,
  };
}

export function shouldFlag(returnsIn90Days: number) {
  if (returnsIn90Days >= 3) return { flagged: true, reason: `${returnsIn90Days} returns in 90 days` };
  return { flagged: false, reason: null };
}

export function canAutoApprove(params: { type: string; itemCount: number; returnsIn90Days: number; withinWindow: boolean }) {
  const { type, itemCount, returnsIn90Days, withinWindow } = params;
  if (!withinWindow) return { approved: false, reason: 'Outside return window' };
  if (type === 'refund') return { approved: false, reason: 'Refunds require manual approval' };
  if (returnsIn90Days >= 3) return { approved: false, reason: `${returnsIn90Days} returns in 90d — review required` };
  if (itemCount > 2) return { approved: false, reason: `${itemCount} items — review required` };
  return { approved: true, reason: 'Auto-approved: ≤2 items, clean history' };
}

export function isWithinWindow(type: string, deliveredDate: Date, now = new Date()) {
  const diff = Math.floor((now.getTime() - deliveredDate.getTime()) / 86400000);
  const total = type === 'refund' ? 7 : 14;
  return { within: diff <= total, daysUsed: diff, daysTotal: total, daysRemaining: Math.max(0, total - diff) };
}
