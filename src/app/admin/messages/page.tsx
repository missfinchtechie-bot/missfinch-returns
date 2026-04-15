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
  return_instructions: { bg: 'bg-blue-50 border-blue-200/80', text: 'text-blue-700' },
  sizing: { bg: 'bg-purple-50 border-purple-200/80', text: 'text-purple-700' },
  order_status: { bg: 'bg-sky-50 border-sky-200/80', text: 'text-sky-700' },
  shipping: { bg: 'bg-cyan-50 border-cyan-200/80', text: 'text-cyan-700' },
  store_visit: { bg: 'bg-indigo-50 border-indigo-200/80', text: 'text-indigo-700' },
  return_rejected: { bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-700' },
  exchange_question: { bg: 'bg-orange-50 border-orange-200/80', text: 'text-orange-700' },
  complaint: { bg: 'bg-red-50 border-red-200/80', text: 'text-red-700' },
  cancellation: { bg: 'bg-rose-50 border-rose-200/80', text: 'text-rose-700' },
  missing_refund: { bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-700' },
  other: { bg: 'bg-stone-100 border-stone-200/80', text: 'text-stone-600' },
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
    <div className="min-h-screen bg-[var(--background)]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--primary-foreground)] px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}

      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <h1 className="font-heading text-lg sm:text-xl font-semibold italic text-[var(--foreground)]">Miss Finch</h1>
            <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">NYC</span>
            <span className="mx-1 h-5 w-px bg-[var(--border)]" />
            <div className="flex items-center gap-0.5 bg-[var(--muted)] rounded-lg p-0.5">
              <a href="/admin" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors">Returns</a>
              <span className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-2 sm:px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md">Messages</span>
              <a href="/admin/financials" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors">Financials</a>
            </div>
          </div>
          <button onClick={runCron} disabled={refreshing}
            className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-3 sm:px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity">
            {refreshing ? 'Checking...' : '↻ Check Inbox'}
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-[var(--card)] border-b border-[var(--border)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${pending.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-[var(--border)]'}`} />
                <span className="text-sm font-medium text-[var(--foreground)]">{pending.length} pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-[var(--muted-foreground)]">{sent.length} sent</span>
              </div>
            </div>
            <div className="flex gap-1 bg-[var(--muted)] rounded-lg p-0.5">
              {(['all', 'pending_review', 'sent'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${filter === f ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}>
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
              <div className="text-center py-12 text-[var(--muted-foreground)]">Loading...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-[var(--muted-foreground)]">
                <div className="text-3xl mb-2">📭</div>
                <div className="text-sm">No messages</div>
              </div>
            ) : messages.map(m => {
              const cat = CATEGORY_COLORS[m.category] || CATEGORY_COLORS.other;
              const isSelected = selected?.id === m.id;
              return (
                <button key={m.id} onClick={() => selectMessage(m)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${isSelected ? 'bg-[var(--card)] border-[var(--ring)] shadow-md ring-1 ring-[var(--ring)]/20' : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--ring)]/40 hover:shadow-sm'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-medium text-sm text-[var(--foreground)] truncate">{m.from_name || m.from_email}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)] flex-shrink-0">{timeAgo(m.created_at)}</span>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] truncate mb-2">{m.subject}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold ${cat.bg} ${cat.text}`}>
                      {CATEGORY_LABELS[m.category] || m.category}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">{Math.round(m.confidence * 100)}%</span>
                    {m.status === 'sent' && <span className="text-[10px] text-emerald-600 font-medium ml-auto">✓ Sent</span>}
                    {m.status === 'pending_review' && <span className="text-[10px] text-amber-600 font-medium ml-auto">⏳ Pending</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="hidden sm:block flex-1 min-w-0">
            {!selected ? (
              <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-sm">
                <div className="text-center">
                  <div className="text-4xl mb-3">✉️</div>
                  <div>Select a message to review</div>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden" style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
                {/* Customer message */}
                <div className="p-5 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold text-[var(--foreground)] font-heading">{selected.from_name || selected.from_email}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{selected.from_email} · {fmtTime(selected.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => { const cat = CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.other; return (
                        <span className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${cat.bg} ${cat.text}`}>
                          {CATEGORY_LABELS[selected.category] || selected.category}
                        </span>
                      ); })()}
                      <span className="text-xs text-[var(--muted-foreground)]">{Math.round(selected.confidence * 100)}%</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-[var(--foreground)] mb-2">{selected.subject}</div>
                  <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed bg-[var(--muted)] p-4 rounded-xl">
                    {selected.body_preview}
                  </div>
                </div>

                {/* AI reasoning */}
                <div className="px-5 py-3 bg-[var(--muted)] border-b border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-1">AI Reasoning</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{selected.reasoning}</div>
                </div>

                {/* Draft reply */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Draft Reply</div>
                    {selected.status === 'sent' && (
                      <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg">
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
                        className="w-full p-4 border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] leading-relaxed focus:outline-none focus:border-[var(--ring)] resize-y bg-[var(--card)]"
                      />
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={() => sendReply(selected, editReply)}
                          disabled={sending || !editReply.trim()}
                          className="bg-[var(--primary)] text-[var(--primary-foreground)] px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                          {sending ? 'Sending...' : 'Send Reply'}
                        </button>
                        <button
                          onClick={() => setEditReply(selected.draft_reply)}
                          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                          Reset to AI draft
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      {selected.draft_reply}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile detail — bottom sheet */}
          {selected && (
            <div className="sm:hidden fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
              <div className="absolute bottom-0 left-0 right-0 bg-[var(--card)] rounded-t-2xl max-h-[88vh] overflow-y-auto shadow-2xl animate-slide-up">
                <div className="text-center pt-3 pb-1"><div className="w-9 h-1 bg-[var(--border)] rounded mx-auto" /></div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold text-[var(--foreground)]">{selected.from_name || selected.from_email}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{fmtTime(selected.created_at)}</div>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">✕</button>
                  </div>
                  <div className="text-sm font-medium text-[var(--foreground)] mb-2">{selected.subject}</div>
                  <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed bg-[var(--muted)] p-3 rounded-xl mb-3">
                    {selected.body_preview}
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2">Draft Reply</div>
                  {selected.status === 'pending_review' ? (
                    <>
                      <textarea value={editReply} onChange={e => setEditReply(e.target.value)} rows={6}
                        className="w-full p-3 border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] leading-relaxed focus:outline-none focus:border-[var(--ring)] resize-y bg-[var(--card)]" />
                      <button onClick={() => sendReply(selected, editReply)} disabled={sending || !editReply.trim()}
                        className="w-full mt-3 py-4 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-base font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                        {sending ? 'Sending...' : 'Send Reply'}
                      </button>
                    </>
                  ) : (
                    <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                      {selected.draft_reply}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
