'use client';

import { useState, useEffect, useCallback } from 'react';

type Return = {
  id: string; return_number: string; order_number: string; customer_name: string; customer_email: string;
  status: string; type: string; outcome: string | null; reason: string | null; reject_reason: string | null;
  subtotal: number; item_count: number; final_amount: number; bonus_amount: number; total_fees: number;
  fee_per_item: number; paid_with: string; is_flagged: boolean; flag_reason: string | null;
  return_requested: string | null; delivered_to_us: string | null; processed_at: string | null;
  tracking_status: string | null; imported_from: string | null;
};

type Stats = { inbox: number; shipping: number; old: number; done: number; flagged: number };

const TABS = [
  { key: 'inbox', label: 'Action Needed', desc: 'Returns delivered to you — ready to process' },
  { key: 'shipping', label: 'In Transit', desc: 'Customer shipped — on the way to you' },
  { key: 'old', label: 'Unprocessed', desc: 'Delivered 30+ days ago — never acted on' },
  { key: 'done', label: 'Completed', desc: 'Credited, refunded, or rejected' },
];

const REJECT_REASONS = ['Tags removed','Signs of wear','Item damaged','Stains or odor','Not in original packaging','Wrong item returned','Other'];

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: undefined });
}

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    credit: 'bg-green-100 text-green-700',
    refund: 'bg-amber-100 text-amber-700',
    exchange: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<string, string> = { credit: 'Credit', refund: 'Refund', exchange: 'Exchange' };
  return { color: colors[type] || 'bg-gray-100 text-gray-600', label: labels[type] || type };
}

function statusLabel(r: Return) {
  if (r.status === 'done' && r.outcome === 'credit') return { text: 'Credited', color: 'text-green-600' };
  if (r.status === 'done' && r.outcome === 'refund') return { text: 'Refunded', color: 'text-green-600' };
  if (r.status === 'done' && r.outcome === 'rejected') return { text: 'Rejected', color: 'text-red-500' };
  if (r.status === 'inbox') return { text: 'Ready', color: 'text-amber-600 font-semibold' };
  if (r.status === 'shipping') return { text: 'In transit', color: 'text-gray-400' };
  if (r.status === 'old') return { text: 'Unprocessed', color: 'text-amber-500' };
  return { text: r.status, color: 'text-gray-400' };
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('inbox');
  const [returns, setReturns] = useState<Return[]>([]);
  const [stats, setStats] = useState<Stats>({ inbox: 0, shipping: 0, old: 0, done: 0, flagged: 0 });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Return | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string; extra?: string; label: string; amount?: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { fetch('/api/auth', { method: 'GET' }).then(r => { if (r.ok) setAuthed(true); }).catch(() => {}); }, []);

  const login = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) { setAuthed(true); setAuthError(''); } else { setAuthError('Wrong password'); }
  };

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set('search', search); else p.set('status', tab);
    p.set('limit', '50');
    const res = await fetch(`/api/returns?${p}`);
    const data = await res.json();
    setReturns(data.returns || []);
    setLoading(false);
  }, [tab, search]);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/returns/stats');
    setStats(await res.json());
  }, []);

  useEffect(() => { if (authed) { fetchReturns(); fetchStats(); } }, [authed, tab, search, fetchReturns, fetchStats]);

  const requestProcess = (id: string, action: string, label: string, amount?: number, extra?: string) => {
    setConfirmAction({ id, action, extra, label, amount });
  };

  const confirmProcess = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    const res = await fetch('/api/returns', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: confirmAction.id, action: confirmAction.action, reject_reason: confirmAction.extra, amount: confirmAction.amount }),
    });
    if (res.ok) {
      const data = await res.json();
      const msgs: Record<string, string> = { credit: 'Store credit issued ✓', refund: 'Refund approved ✓', reject: 'Return rejected', received: 'Marked as received' };
      let m = msgs[confirmAction.action] || 'Done';
      if (data.shopify_error) m += ' (Shopify error)';
      setToast(m); setTimeout(() => setToast(''), 3000);
      setSelected(null); setShowReject(false); setRejectReason(''); setConfirmAction(null);
      fetchReturns(); fetchStats();
    } else {
      const err = await res.json();
      setToast(`Error: ${err.error || 'Failed'}`); setTimeout(() => setToast(''), 4000);
    }
    setProcessing(false);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl font-medium text-gray-900 tracking-wide">MISS FINCH</h1>
            <p className="text-sm text-gray-400 mt-1 tracking-widest uppercase">Returns Dashboard</p>
          </div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter password" className="w-full p-4 rounded-xl border border-gray-200 text-lg text-center focus:outline-none focus:border-gray-900 bg-white" />
          {authError && <p className="text-red-500 text-center text-sm mt-3">{authError}</p>}
          <button onClick={login} className="w-full mt-4 p-4 bg-gray-900 text-white rounded-xl text-base font-semibold">Log In</button>
        </div>
      </div>
    );
  }

  const tabData = TABS.find(t => t.key === tab);

  return (
    <div className="min-h-screen bg-[#F5F4F1]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}

      {/* Header */}
      <div className="bg-[#1a1a1a] px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-white text-lg font-medium tracking-wider">MISS FINCH</h1>
          <span className="text-gray-600 text-xs tracking-wider uppercase hidden sm:inline">Returns</span>
        </div>
        <div className="relative w-80 hidden md:block">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order # or name..."
            className="w-full py-2 px-4 pl-9 bg-[#2a2a2a] border border-[#333] rounded-lg text-white text-sm focus:outline-none focus:border-[#555] placeholder-[#666]" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-xs">🔍</span>
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-sm">✕</button>}
        </div>
      </div>

      {/* Mobile search */}
      <div className="md:hidden bg-[#1a1a1a] px-4 pb-3">
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order # or name..."
            className="w-full py-2.5 px-4 pl-9 bg-[#2a2a2a] border border-[#333] rounded-lg text-white text-sm focus:outline-none placeholder-[#666]" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-xs">🔍</span>
        </div>
      </div>

      {/* Tabs + Stats inline */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          <div className="flex">
            {TABS.map(t => {
              const count = stats[t.key as keyof Stats] || 0;
              return (
                <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
                  className={`px-4 py-3.5 text-sm border-b-2 transition-colors flex items-center gap-2 ${
                    tab === t.key ? 'border-[#1a1a1a] text-[#1a1a1a] font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>
                  {t.label}
                  {count > 0 && t.key !== 'done' && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      t.key === 'inbox' ? 'bg-[#1a1a1a] text-white' : t.key === 'old' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <span className="text-gray-400">Total: <span className="font-semibold text-gray-700">{stats.inbox + stats.shipping + stats.old}</span> active</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-4">
        <p className="text-xs text-gray-400 mb-3">{search ? `Search results for "${search}"` : tabData?.desc}</p>

        {loading && <div className="text-center py-20 text-gray-300">Loading...</div>}
        {!loading && returns.length === 0 && (
          <div className="text-center py-20 text-gray-300">
            <div className="text-3xl mb-2">{search ? '🔍' : '✓'}</div>
            <div className="text-base">{search ? 'No results' : tab === 'inbox' ? 'No returns need action right now' : 'Nothing here'}</div>
          </div>
        )}

        {/* Desktop Table */}
        {!loading && returns.length > 0 && (
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  {['Order','Customer','Items','Value','Type','Reason','Date','Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returns.map(r => {
                  const tb = typeBadge(r.type);
                  const sl = statusLabel(r);
                  return (
                    <tr key={r.id} onClick={() => { setSelected(r); setShowReject(false); setRejectReason(''); }}
                      className={`cursor-pointer transition-colors hover:bg-blue-50/40 ${r.is_flagged ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{r.order_number}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{r.customer_name}</div>
                        {r.is_flagged && <div className="text-[11px] text-red-500 font-semibold mt-0.5">⚠ {r.flag_reason || 'Flagged'}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-center">{r.item_count}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.subtotal > 0 ? `$${r.subtotal.toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${tb.color}`}>{tb.label}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-[180px] truncate">{r.reason || (r.imported_from === 'redo' ? 'Redo import' : '—')}</td>
                      <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{fmt(r.return_requested)}</td>
                      <td className="px-4 py-3"><span className={`text-xs ${sl.color}`}>{sl.text}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Cards */}
        {!loading && returns.length > 0 && (
          <div className="md:hidden space-y-2">
            {returns.map(r => {
              const tb = typeBadge(r.type);
              return (
                <div key={r.id} onClick={() => { setSelected(r); setShowReject(false); setRejectReason(''); }}
                  className={`p-4 bg-white rounded-xl cursor-pointer active:bg-gray-50 ${r.is_flagged ? 'border-2 border-red-200' : 'border border-gray-200'}`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-base font-semibold text-gray-900">{r.customer_name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${tb.color}`}>{tb.label}</span>
                  </div>
                  <div className="text-sm text-gray-400">{r.order_number} · {r.item_count} item{r.item_count > 1 ? 's' : ''} · {r.subtotal > 0 ? `$${r.subtotal.toFixed(2)}` : '—'}</div>
                  {r.is_flagged && <div className="text-xs text-red-500 font-semibold mt-1">⚠ {r.flag_reason || 'Flagged'}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelected(null); setShowReject(false); }} />
          <div className="hidden md:block absolute top-0 right-0 h-full w-[480px] bg-white shadow-2xl overflow-y-auto animate-slide-right">
            <Detail r={selected} showReject={showReject} setShowReject={setShowReject} rejectReason={rejectReason} setRejectReason={setRejectReason} requestProcess={requestProcess} onClose={() => { setSelected(null); setShowReject(false); }} />
          </div>
          <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[88vh] overflow-y-auto shadow-2xl animate-slide-up">
            <div className="text-center pt-3"><div className="w-9 h-1 bg-gray-200 rounded mx-auto" /></div>
            <Detail r={selected} showReject={showReject} setShowReject={setShowReject} rejectReason={rejectReason} setRejectReason={setRejectReason} requestProcess={requestProcess} onClose={() => { setSelected(null); setShowReject(false); }} />
          </div>
        </div>
      )}

      {/* Confirm */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="text-4xl mb-4">{confirmAction.action === 'credit' ? '💚' : confirmAction.action === 'refund' ? '💰' : confirmAction.action === 'reject' ? '⚠️' : '📦'}</div>
            <div className="text-lg font-bold text-gray-900 mb-2">Are you sure?</div>
            <div className="text-base text-gray-600 mb-2">{confirmAction.label}</div>
            {confirmAction.action === 'credit' && <p className="text-xs text-gray-400 mb-4">This will issue real store credit to the customer&apos;s Shopify account.</p>}
            {confirmAction.action === 'refund' && <p className="text-xs text-gray-400 mb-4">Order will be tagged. Process the actual refund in Shopify admin.</p>}
            <div className="flex flex-col gap-3 mt-4">
              <button onClick={confirmProcess} disabled={processing}
                className={`w-full py-4 rounded-xl text-base font-semibold text-white ${confirmAction.action === 'reject' ? 'bg-red-600' : confirmAction.action === 'credit' ? 'bg-green-600' : 'bg-gray-900'} ${processing ? 'opacity-50' : ''}`}>
                {processing ? 'Processing...' : 'Yes, Confirm'}
              </button>
              <button onClick={() => setConfirmAction(null)} className="w-full py-3 text-gray-400">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-serif { font-family: 'Cormorant Garamond', serif; }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slide-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-up { animation: slide-up 0.25s ease; }
        .animate-slide-right { animation: slide-right 0.25s ease; }
      `}</style>
    </div>
  );
}

function Detail({ r, showReject, setShowReject, rejectReason, setRejectReason, requestProcess, onClose }: {
  r: Return; showReject: boolean; setShowReject: (v: boolean) => void; rejectReason: string; setRejectReason: (v: string) => void;
  requestProcess: (id: string, action: string, label: string, amount?: number, extra?: string) => void; onClose: () => void;
}) {
  const tb = typeBadge(r.type);
  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="text-xl font-bold text-gray-900">{r.customer_name}</div>
          <div className="text-sm text-gray-400 mt-1">{r.order_number} · {fmt(r.return_requested)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${tb.color}`}>{tb.label}</span>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl ml-1">✕</button>
        </div>
      </div>

      {r.is_flagged && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-5">
          <div className="text-sm font-semibold text-red-600">⚠ Flagged for Review</div>
          <div className="text-sm text-red-700 mt-1">{r.flag_reason}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { l: 'Items', v: r.item_count },
          { l: 'Value', v: r.subtotal > 0 ? `$${r.subtotal.toFixed(2)}` : '—' },
          { l: 'Reason', v: r.reason || '—' },
          { l: 'Source', v: r.imported_from === 'redo' ? 'Redo Import' : 'Shopify' },
        ].map((d, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{d.l}</div>
            <div className="text-sm font-medium text-gray-800">{d.v}</div>
          </div>
        ))}
      </div>

      <div className="mb-5 text-sm space-y-1">
        {r.return_requested && <div className="flex"><span className="text-gray-400 w-28 flex-shrink-0">Requested</span><span className="text-gray-700">{fmt(r.return_requested)}</span></div>}
        {r.delivered_to_us && <div className="flex"><span className="text-gray-400 w-28 flex-shrink-0">Received</span><span className="text-gray-700">{fmt(r.delivered_to_us)}</span></div>}
        {r.processed_at && <div className="flex"><span className="text-gray-400 w-28 flex-shrink-0">Processed</span><span className="text-gray-700">{fmt(r.processed_at)}</span></div>}
        {r.customer_email && <div className="flex"><span className="text-gray-400 w-28 flex-shrink-0">Email</span><span className="text-gray-700">{r.customer_email}</span></div>}
      </div>

      {(r.status === 'inbox' || r.status === 'old') && !showReject && (
        <div className="flex flex-col gap-2.5 mb-5">
          {r.type === 'credit' || r.type === 'exchange' ? (
            <button onClick={() => requestProcess(r.id, 'credit', `Issue $${(r.subtotal || 0).toFixed(2)} store credit to ${r.customer_name}?`, r.subtotal)}
              className="w-full py-4 bg-green-600 text-white rounded-xl text-base font-semibold hover:bg-green-700">
              Issue Store Credit{r.subtotal > 0 ? ` · $${r.subtotal.toFixed(2)}` : ''}
            </button>
          ) : (
            <button onClick={() => requestProcess(r.id, 'refund', `Approve $${(r.subtotal || 0).toFixed(2)} refund for ${r.customer_name}?`, r.subtotal)}
              className="w-full py-4 bg-gray-900 text-white rounded-xl text-base font-semibold hover:bg-gray-800">
              Approve Refund{r.subtotal > 0 ? ` · $${r.subtotal.toFixed(2)}` : ''}
            </button>
          )}
          <button onClick={() => setShowReject(true)} className="w-full py-4 bg-white text-red-600 border-2 border-red-200 rounded-xl text-base font-semibold hover:bg-red-50">
            Reject Return
          </button>
        </div>
      )}

      {showReject && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-gray-900 mb-3">Rejection Reason</div>
          <div className="flex flex-col gap-1.5">
            {REJECT_REASONS.map(reason => (
              <button key={reason} onClick={() => setRejectReason(reason)}
                className={`p-3 rounded-xl text-left text-sm ${rejectReason === reason ? 'bg-red-50 border-2 border-red-300 text-red-700 font-semibold' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                {reason}
              </button>
            ))}
          </div>
          {rejectReason && (
            <button onClick={() => requestProcess(r.id, 'reject', `Reject return from ${r.customer_name}?`, undefined, rejectReason)}
              className="w-full mt-4 py-4 bg-red-600 text-white rounded-xl text-sm font-semibold">Reject — {rejectReason}</button>
          )}
          <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="w-full mt-2 py-3 text-gray-400 text-sm">Cancel</button>
        </div>
      )}

      {r.status === 'shipping' && (
        <div className="bg-gray-50 rounded-xl p-5 text-center mb-5">
          <div className="text-xl mb-2">🚚</div>
          <div className="text-sm font-medium text-gray-500">{r.tracking_status || 'In transit to you'}</div>
          <button onClick={() => requestProcess(r.id, 'received', `Mark as received from ${r.customer_name}?`)}
            className="mt-3 w-full py-3 bg-white border border-gray-200 text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-50">Mark as Received</button>
        </div>
      )}

      {r.status === 'done' && (
        <div className={`rounded-xl p-5 text-center mb-5 ${r.outcome === 'rejected' ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="text-xl mb-2">{r.outcome === 'rejected' ? '✕' : '✓'}</div>
          <div className={`text-sm font-semibold ${r.outcome === 'rejected' ? 'text-red-600' : 'text-green-600'}`}>
            {r.outcome === 'credit' && 'Store Credit Issued'}
            {r.outcome === 'refund' && 'Refunded'}
            {r.outcome === 'rejected' && `Rejected${r.reject_reason ? ` — ${r.reject_reason}` : ''}`}
          </div>
          {r.processed_at && <div className="text-xs text-gray-400 mt-1">{fmt(r.processed_at)}</div>}
        </div>
      )}
    </div>
  );
}
