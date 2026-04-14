import { NextRequest, NextResponse } from 'next/server';
import { sendReply, markAsRead, addLabel } from '@/lib/gmail';
import { getServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { id, reply } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = getServiceClient();
  const { data: msg } = await supabase.from('message_log').select('*').eq('id', id).single();
  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

  const replyText = reply || msg.draft_reply;
  
  try {
    await sendReply(msg.thread_id, msg.from_email, msg.subject, replyText);
    await markAsRead(msg.gmail_id);
    await addLabel(msg.gmail_id, 'AI-Replied');
    
    await supabase.from('message_log').update({
      status: 'sent',
      draft_reply: replyText,
      sent_at: new Date().toISOString(),
    }).eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
