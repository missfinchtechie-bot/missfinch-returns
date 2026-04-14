'use client';

import { useState, useEffect, useCallback } from 'react';

type Message = {
  id: string;
  gmail_id: string;
  thread_id: string;
  from_email: string;
  from_name: string;
  subject: string;
  body_preview: string;
  category: string;
  confidence: number;
  auto_send: boolean;
  draft_reply: string;
  reasoning: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  return_instructions: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  sizing: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  order_status: { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700' },
  shipping: { bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700' },
  store_visit: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
  return_rejected: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  exchange_question: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
  complaint: { bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  cancellation: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
  missing_refund: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  other: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
};

const CATEGORY_LABELS: Record<string, string> = {
  return_instructions: 'Return Help',
  sizing: 'Sizing',
  order_status: 'Order Status',
  shipping: 'Shipping',
  store_visit: 'Store Visit',
  return_rejected: 'Rejected Return',
  exchange_question: 'Exchange',
  complaint: 'Complaint',
  cancellation: 'Cancellation',
  missing_refund: 'Missing Refund',
  other: 'Other',
};

function timeAgo(d: string) {
  const now = new Date();
  const then = new Date(d);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmtTime(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);
  const [editReply, setEditReply] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending_review' | 'sent'>('all');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/messages/list?status=${filter}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const selectMessage = (m: Message) => {
    setSelected(m);
    setEditReply(m.draft_reply || '');
  };

  const sendReply = async (msg: Message, replyText: string) => {
    setSending(true);
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: msg.id, reply: replyText }),
    });
    if (res.ok) {
      flash('Reply sent ✓');
      setSelected(null);
      fetchMessages();
    } else {
      const err = await res.json();
      flash(`Error: ${err.error || 'Failed to send'}`);
    }
    setSending(false);
  };

  const runCron = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/messages/cron');
      const data = await res.json();
      if (data.processed > 0) {
        flash(`Processed ${data.processed} new message${data.processed > 1 ? 's' : ''}`);
        fetchMessages();
      } else if (data.error) {
        flash(`Error: ${data.error.slice(0, 80)}`);
      } else {
        flash('No new messages');
      }
    } catch {
      flash('Failed to check');
    }
    setRefreshing(false);
  };

  const pending = messages.filter(m => m.status === 'pending_review');
  const sent = messages.filter(m => m.status === 'sent');

  return (
    <div className="min-h-screen bg-[#F5F4F1]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}

      {/* Header */}
      <div className="bg-[#1a1a1a] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <img src="/logo-white.png" alt="Miss Finch NYC" className="h-8 sm:h-9" />
          <span className="text-gray-600 text-xs tracking-wider uppercase hidden sm:inline">Messages</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-[#666] hover:text-white text-sm transition-colors">← Returns</a>
          <button onClick={runCron} disabled={refreshing}
            className="bg-[#2a2a2a] border border-[#333] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors">
            {refreshing ? 'Checking...' : '↻ Check Inbox'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${pending.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-gray-300'}`} />
                <span className="text-sm font-medium text-gray-700">{pending.length} pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-gray-500">{sent.length} sent</span>
              </div>
            </div>
            <div className="flex gap-1">
              {(['all', 'pending_review', 'sent'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {f === 'all' ? 'All' : f === 'pending_review' ? 'Pending' : 'Sent'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 160px)' }}>
          {/* Message list */}
          <div className="w-full sm:w-[380px] flex-shrink-0 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No messages</div>
            ) : messages.map(m => {
              const cat = CATEGORY_COLORS[m.category] || CATEGORY_COLORS.other;
              const isSelected = selected?.id === m.id;
              return (
                <button key={m.id} onClick={() => selectMessage(m)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${isSelected ? 'bg-white border-gray-300 shadow-md ring-1 ring-gray-200' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-medium text-sm text-gray-900 truncate">{m.from_name || m.from_email}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(m.created_at)}</span>
                  </div>
                  <div className="text-xs text-gray-600 truncate mb-2">{m.subject}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cat.bg} ${cat.text}`}>
                      {CATEGORY_LABELS[m.category] || m.category}
                    </span>
                    <span className="text-[10px] text-gray-400">{Math.round(m.confidence * 100)}%</span>
                    {m.status === 'sent' && <span className="text-[10px] text-emerald-500 font-medium ml-auto">✓ Sent</span>}
                    {m.status === 'pending_review' && <span className="text-[10px] text-amber-500 font-medium ml-auto">⏳ Pending</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="hidden sm:block flex-1 min-w-0">
            {!selected ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Select a message to review
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
                {/* Customer message */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900">{selected.from_name || selected.from_email}</div>
                      <div className="text-xs text-gray-400">{selected.from_email} · {fmtTime(selected.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => { const cat = CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.other; return (
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cat.bg} ${cat.text}`}>
                          {CATEGORY_LABELS[selected.category] || selected.category}
                        </span>
                      ); })()}
                      <span className="text-xs text-gray-400">{Math.round(selected.confidence * 100)}% confidence</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-800 mb-2">{selected.subject}</div>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-lg">
                    {selected.body_preview}
                  </div>
                </div>

                {/* AI reasoning */}
                <div className="px-5 py-3 bg-[#FAFAF8] border-b border-gray-100">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1">AI Reasoning</div>
                  <div className="text-xs text-gray-500">{selected.reasoning}</div>
                </div>

                {/* Draft reply */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Draft Reply</div>
                    {selected.status === 'sent' && (
                      <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full">
                        ✓ Sent {selected.sent_at ? fmtTime(selected.sent_at) : ''}
                      </span>
                    )}
                  </div>

                  {selected.status === 'pending_review' ? (
                    <>
                      <textarea
                        value={editReply}
                        onChange={e => setEditReply(e.target.value)}
                        rows={8}
                        className="w-full p-4 border border-gray-200 rounded-lg text-sm text-gray-700 leading-relaxed focus:outline-none focus:border-gray-400 resize-y"
                      />
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={() => sendReply(selected, editReply)}
                          disabled={sending || !editReply.trim()}
                          className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                          {sending ? 'Sending...' : 'Send Reply'}
                        </button>
                        <button
                          onClick={() => setEditReply(selected.draft_reply)}
                          className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                          Reset to AI draft
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                      {selected.draft_reply}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
