// AI message classifier and reply drafter using Anthropic Claude API
// Uses Claude Haiku 4.5 — fast, cheap, great for classification + short drafts

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are the customer service assistant for Miss Finch NYC, a modest fashion brand based in New York.
You respond to customer emails on behalf of the brand.

BRAND VOICE: Warm, polished, helpful. Never robotic. Like a friendly boutique owner who genuinely cares.
SIGN OFF: Always end with "Warmly," followed by "The Miss Finch Team" on a new line.

KEY POLICIES:
- Returns: Processed through the return portal at missfinchnyc.com/apps/redo/returns-portal/login
- Return window: 7 days for refunds, 14 days for exchanges/store credit (from delivery date)
- Exchanges: Free, no restocking fee. One exchange per order.
- Store credit: Free, no fees.
- Refunds: 5% restocking fee deducted from refund amount.
- Shipping: Free ground shipping on US orders over $99. Ships from NYC within 1-2 business days.
- No physical store. Online only.
- Items must be unworn, unwashed, with tags attached.
- International returns: Case by case, email us.
- Return address: 224 W 35th St, Suite 1400, New York, NY 10001

SIZING: If a customer asks about sizing, recommend they check the size guide on the product page. General guidance:
- Most styles run true to size
- Shirt dresses and structured styles: consider sizing up if between sizes
- Stretchy/knit pieces: true to size
- If unsure, store credit exchange is free so they can try a different size risk-free

WHEN ASKED ABOUT REJECTED RETURNS: Be empathetic. Common rejection reasons include tags removed, signs of wear, stains, or outside return window. Offer to have someone review the case. Never be defensive.

ESCALATION SCENARIOS:
- Customer exchanged an item but wants to return the exchange: This is tricky — Redo may block it. Acknowledge the frustration, say you'll look into it personally, and flag for manual review.
- Customer says colors don't match photos: Apologize sincerely, offer to help with a return or exchange.
- Order cancellation within a few hours: Say you'll try to catch it before it ships, but can't guarantee.
- Return delivered but never refunded: Apologize for the delay, say you're looking into it right away.

IMPORTANT: Keep replies concise (3-5 sentences max). Customers don't want essays. Answer the question directly, provide the relevant link or info, done.`;

export type MessageCategory = 
  | 'return_instructions'
  | 'sizing'
  | 'order_status'
  | 'shipping'
  | 'store_visit'
  | 'return_rejected'
  | 'exchange_question'
  | 'complaint'
  | 'cancellation'
  | 'missing_refund'
  | 'other';

export type AutoSendCategory = 'return_instructions' | 'sizing' | 'order_status' | 'shipping' | 'store_visit';

const AUTO_SEND_CATEGORIES: AutoSendCategory[] = ['return_instructions', 'sizing', 'order_status', 'shipping', 'store_visit'];

export interface ClassifiedMessage {
  category: MessageCategory;
  autoSend: boolean;
  confidence: number;
  draftReply: string;
  reasoning: string;
}

export async function classifyAndDraft(
  customerEmail: string,
  subject: string,
  body: string,
  orderContext?: string,
): Promise<ClassifiedMessage> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const userMessage = `Classify this customer email and draft a reply.

FROM: ${customerEmail}
SUBJECT: ${subject}
BODY:
${body.slice(0, 2000)}

${orderContext ? `ORDER CONTEXT:\n${orderContext}\n` : ''}

Respond in this exact JSON format (no markdown, no backticks, just raw JSON):
{
  "category": "return_instructions|sizing|order_status|shipping|store_visit|return_rejected|exchange_question|complaint|cancellation|missing_refund|other",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why you classified it this way",
  "draftReply": "The actual reply to send to the customer"
}`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  try {
    const parsed = JSON.parse(text.replace(/```json\n?|```/g, '').trim());
    const category = parsed.category as MessageCategory;
    // Auto-send disabled — all messages go to pending_review for manual approval
    // To re-enable: const autoSend = AUTO_SEND_CATEGORIES.includes(category as AutoSendCategory) && parsed.confidence >= 0.85;
    const autoSend = false;

    return {
      category,
      autoSend,
      confidence: parsed.confidence,
      draftReply: parsed.draftReply,
      reasoning: parsed.reasoning,
    };
  } catch {
    return {
      category: 'other',
      autoSend: false,
      confidence: 0,
      draftReply: text,
      reasoning: 'Failed to parse AI response',
    };
  }
}
