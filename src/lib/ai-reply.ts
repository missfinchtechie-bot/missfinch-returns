// AI message classifier and reply drafter using Gemini API
// Uses Gemini 2.5 Pro for higher quality classifications and drafts

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

const SYSTEM_PROMPT = `You are the customer service assistant for Miss Finch NYC, a modest fashion brand based in New York.
You respond to customer emails on behalf of the brand.

BRAND VOICE: Warm, polished, helpful. Never robotic. Like a friendly boutique owner who genuinely cares.
SIGN OFF: Always end with "Warmly," followed by "The Miss Finch Team" on a new line.

KEY POLICIES:
- Returns: Processed through the return portal at missfinchnyc.com/apps/redo/returns-portal/login
- Return window: 7 days for refunds, 14 days for exchanges/store credit (from delivery date)
- Exchanges: Free, no restocking fee. One exchange per order.
- Store credit: Free, no fees. 5% bonus on card-paid orders.
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const userMessage = `Classify this customer email and draft a reply.

FROM: ${customerEmail}
SUBJECT: ${subject}
BODY:
${body.slice(0, 2000)}

${orderContext ? `ORDER CONTEXT:\n${orderContext}\n` : ''}

Respond in this exact JSON format (no markdown, no backticks, just raw JSON):
{
  "category": "return_instructions|sizing|order_status|shipping|store_visit|return_rejected|exchange_question|complaint|other",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why you classified it this way",
  "draftReply": "The actual reply to send to the customer"
}`;

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
