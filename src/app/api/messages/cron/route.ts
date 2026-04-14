import { NextResponse } from 'next/server';
import { getUnreadMessages, sendReply, markAsRead, addLabel } from '@/lib/gmail';
import { classifyAndDraft } from '@/lib/ai-reply';
import { getServiceClient } from '@/lib/supabase';

function verifyCron(req: Request): boolean {
  // Accept cron secret header OR admin auth cookie
  if (req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`) return true;
  const cookie = req.headers.get('cookie') || '';
  if (cookie.includes('mf_auth=authenticated')) return true;
  return false;
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getServiceClient();
  const results: { id: string; action: string; category: string }[] = [];

  try {
    const messages = await getUnreadMessages(5);
    for (const msg of messages) {
      const { data: existing } = await supabase.from('message_log').select('id').eq('gmail_id', msg.id).maybeSingle();
      if (existing) continue;

      const fromLower = msg.from.toLowerCase();
      if (fromLower.includes('missfinch') || fromLower.includes('noreply') || fromLower.includes('no-reply')) {
        await markAsRead(msg.id);
        continue;
      }

      const emailMatch = msg.from.match(/<([^>]+)>/) || [null, msg.from];
      const customerEmail = (emailMatch[1] || msg.from).trim();
      const result = await classifyAndDraft(customerEmail, msg.subject, msg.body);

      await supabase.from('message_log').insert({
        gmail_id: msg.id, thread_id: msg.threadId, from_email: customerEmail,
        from_name: msg.from.replace(/<[^>]+>/, '').trim().replace(/"/g, ''),
        subject: msg.subject, body_preview: msg.body.slice(0, 500),
        category: result.category, confidence: result.confidence,
        auto_send: result.autoSend, draft_reply: result.draftReply,
        reasoning: result.reasoning,
        status: result.autoSend ? 'sent' : 'pending_review',
        created_at: new Date().toISOString(),
      });

      if (result.autoSend) {
        await sendReply(msg.threadId, customerEmail, msg.subject, result.draftReply);
        await markAsRead(msg.id);
        await addLabel(msg.id, 'AI-Replied');
        results.push({ id: msg.id, action: 'auto_sent', category: result.category });
      } else {
        await addLabel(msg.id, 'AI-Needs-Review');
        results.push({ id: msg.id, action: 'queued', category: result.category });
      }
    }
    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
