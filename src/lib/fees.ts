// Fee tiers
// Store Credit: 1-2 items = free, 3-5 = $2.95/item, 6+ = $4.95/item
// Refund: 1-2 items = $4.95/item, 3-5 = $6.95/item, 6+ = $9.95/item

export function getFeePerItem(type: 'credit' | 'refund', itemCount: number): number {
  if (type === 'credit') {
    if (itemCount <= 2) return 0;
    if (itemCount <= 5) return 2.95;
    return 4.95;
  }
  // refund
  if (itemCount <= 2) return 4.95;
  if (itemCount <= 5) return 6.95;
  return 9.95;
}

export function calculateReturn(params: {
  type: 'credit' | 'refund';
  items: { price: number }[];
  paidWith: 'card' | 'store_credit' | 'mixed';
  bonusPercent?: number;
}) {
  const { type, items, paidWith, bonusPercent = 5 } = params;
  const itemCount = items.length;
  const subtotal = items.reduce((sum, i) => sum + i.price, 0);
  const feePerItem = getFeePerItem(type, itemCount);
  const totalFees = feePerItem * itemCount;

  // Bonus only on store credit, only on card-paid portion
  let bonus = 0;
  if (type === 'credit' && paidWith === 'card') {
    bonus = Math.round((subtotal - totalFees) * (bonusPercent / 100) * 100) / 100;
  }
  // Mixed payment: bonus only on card portion (would need card amount passed in)
  // For now, no bonus on mixed or store_credit payments

  const finalAmount = Math.round((subtotal - totalFees + bonus) * 100) / 100;

  return {
    subtotal,
    itemCount,
    feePerItem,
    totalFees,
    bonus,
    finalAmount,
    type,
    paidWith,
  };
}

// Check if customer should be flagged
export function shouldFlag(returnsIn90Days: number): {
  flagged: boolean;
  reason: string | null;
} {
  if (returnsIn90Days >= 3) {
    return {
      flagged: true,
      reason: `${returnsIn90Days} returns in 90 days`,
    };
  }
  return { flagged: false, reason: null };
}

// Determine auto-approve eligibility
export function canAutoApprove(params: {
  type: 'credit' | 'refund';
  itemCount: number;
  returnsIn90Days: number;
  withinWindow: boolean;
}): { approved: boolean; reason: string } {
  const { type, itemCount, returnsIn90Days, withinWindow } = params;

  if (!withinWindow) {
    return { approved: false, reason: 'Outside return window' };
  }

  // Refunds ALWAYS require manual approval
  if (type === 'refund') {
    return { approved: false, reason: 'Refunds require manual approval' };
  }

  // Flagged customers need review
  if (returnsIn90Days >= 3) {
    return { approved: false, reason: `${returnsIn90Days} returns in 90 days — review required` };
  }

  // Large returns need review
  if (itemCount > 2) {
    return { approved: false, reason: `${itemCount} items — review required` };
  }

  // Store credit, 1-2 items, clean history = auto-approve
  return { approved: true, reason: 'Auto-approved: store credit, ≤2 items, clean history' };
}

// Check return window
export function isWithinWindow(
  type: 'credit' | 'refund',
  deliveredDate: Date,
  now: Date = new Date()
): boolean {
  const diffDays = Math.floor((now.getTime() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
  if (type === 'credit') return diffDays <= 14;
  if (type === 'refund') return diffDays <= 7;
  return false;
}
