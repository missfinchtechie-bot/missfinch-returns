'use client';

import { useState, useEffect, useCallback } from 'react';

type Return = {
  id: string;
  return_number: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  status: string;
  type: string;
  outcome: string | null;
  reason: string | null;
  reject_reason: string | null;
  subtotal: number;
  item_count: number;
  final_amount: number;
  bonus_amount: number;
  total_fees: number;
  fee_per_item: number;
  paid_with: string;
  is_flagged: boolean;
  flag_reason: string | null;
  return_requested: string | null;
  delivered_to_us: string | null;
  processed_at: string | null;
  tracking_status: string | null;
  imported_from: string | null;
};

type Stats = { inbox: number; shipping: number; old: number; done: number; flagged: number };

const TABS = [
  { key: 'inbox', label: 'Inbox', desc: 'Items received — ready to process' },
  { key: 'shipping', label: 'Shipping', desc: 'Labels sent — waiting for packages' },
  { key: 'old', label: 'Old', desc: 'Received 30+ days ago' },
  { key: 'done', label: 'History', desc: 'Completed returns' },
];

const REJECT_REASONS = ['Tags removed','Signs of wear','Item damaged','Stains or odor','Not in original packaging','Wrong item returned','Other'];

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  useEffect(() => {
    fetch('/api/auth', { method: 'GET' }).then(r => { if (r.ok) setAuthed(true); }).catch(() => {});
  }, []);

  const login = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) { setAuthed(true); setAuthError(''); } else { setAuthError('Wrong password'); }
  };

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    else params.set('status', tab);
    params.set('limit', '50');
    const res = await fetch(`/api/returns?${params}`);
    const data = await res.json();
    setReturns(data.returns || []);
    setLoading(false);
  }, [tab, search]);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/returns/stats');
    const data = await res.json();
    setStats(data);
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
      let toastMsg = msgs[confirmAction.action] || 'Done';
      if (data.shopify_error) toastMsg += ' (Shopify error)';
      setToast(toastMsg);
      setTimeout(() => setToast(''), 3000);
      setSelected(null); setShowReject(false); setRejectReason(''); setConfirmAction(null);
      fetchReturns(); fetchStats();
    } else {
      const err = await res.json();
      setToast(`Error: ${err.error || 'Something went wrong'}`);
      setTimeout(() => setToast(''), 4000);
    }
    setProcessing(false);
  };

  // Login
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

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      {/* Toast */}
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}

      {/* Header */}
      <div className="bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-white text-xl font-medium tracking-wider">MISS FINCH</h1>
          <span className="text-gray-500 text-sm hidden sm:inline">Returns Dashboard</span>
        </div>
        <div className="relative w-72 hidden md:block">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order # or name..."
            className="w-full py-2.5 px-4 pl-9 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500 placeholder-gray-500" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">✕</button>}
        </div>
      </div>

      {/* Mobile search */}
      <div className="md:hidden bg-gray-900 px-4 pb-3">
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order # or name..."
            className="w-full py-3 px-4 pl-10 bg-gray-800 border border-gray-700 rounded-xl text-white text-base focus:outline-none placeholder-gray-500" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">✕</button>}
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-8">
          {[
            { n: stats.inbox, l: 'To Process', c: 'text-gray-900' },
            { n: stats.shipping, l: 'Shipping', c: 'text-gray-500' },
            { n: stats.old, l: 'Old (30d+)', c: 'text-amber-600' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <span className={`font-serif text-2xl font-semibold ${s.c}`}>{s.n}</span>
              <span className="text-xs text-gray-400 ml-1.5">{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
              {t.key !== 'done' && stats[t.key as keyof Stats] > 0 && (
                <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  t.key === 'inbox' ? 'bg-gray-900 text-white' : t.key === 'old' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                }`}>{stats[t.key as keyof Stats]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <p className="text-xs text-gray-400 mb-3">{search ? `Search results for "${search}"` : TABS.find(t => t.key === tab)?.desc}</p>

        {loading && <div className="text-center py-20 text-gray-300"><div className="text-3xl mb-2">⏳</div>Loading...</div>}
        {!loading && returns.length === 0 && <div className="text-center py-20 text-gray-300"><div className="text-3xl mb-2">{search ? '🔍' : '✓'}</div>{search ? 'No results' : 'Nothing here'}</div>}

        {/* Desktop: Table */}
        {!loading && returns.length > 0 && (
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Order</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {returns.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r)}
                    className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${r.is_flagged ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{r.order_number}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{r.customer_name}</div>
                      {r.is_flagged && <span className="text-xs text-red-600 font-semibold">⚠ Flagged</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.item_count}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">${r.subtotal?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${r.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.type === 'credit' ? 'Credit' : 'Refund'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">{r.reason || (r.imported_from === 'redo' ? 'Imported' : '—')}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatDate(r.return_requested)}</td>
                    <td className="px-4 py-3">
                      {r.status === 'done' && r.outcome && (
                        <span className={`text-xs font-medium ${r.outcome === 'rejected' ? 'text-red-600' : 'text-green-600'}`}>
                          {r.outcome === 'credit' ? 'Credited' : r.outcome === 'refund' ? 'Refunded' : 'Rejected'}
                        </span>
                      )}
                      {r.status === 'shipping' && <span className="text-xs text-gray-400">In transit</span>}
                      {r.status === 'inbox' && <span className="text-xs font-semibold text-amber-600">Ready</span>}
                      {r.status === 'old' && <span className="text-xs text-amber-500">Unprocessed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile: Cards */}
        {!loading && returns.length > 0 && (
          <div className="md:hidden space-y-2">
            {returns.map(r => (
              <div key={r.id} onClick={() => setSelected(r)}
                className={`p-4 bg-white rounded-xl cursor-pointer active:bg-gray-50 ${r.is_flagged ? 'border-2 border-red-200' : 'border border-gray-200'}`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-base font-semibold text-gray-900">{r.customer_name}</div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${r.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.type === 'credit' ? 'Credit' : 'Refund'}
                  </span>
                </div>
                <div className="text-sm text-gray-400">{r.order_number} · {r.item_count} item{r.item_count > 1 ? 's' : ''} · ${r.subtotal?.toFixed(2) || '0.00'}</div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-400">{r.reason || (r.imported_from === 'redo' ? 'Imported' : '—')}</span>
                  {r.is_flagged && <span className="text-xs text-red-600 font-semibold">⚠ Flagged</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel — slides from right on desktop, bottom sheet on mobile */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelected(null); setShowReject(false); }} />
          
          {/* Desktop: right panel */}
          <div className="hidden md:block absolute top-0 right-0 h-full w-[480px] bg-white shadow-2xl overflow-y-auto animate-slide-right">
            <DetailContent r={selected} showReject={showReject} setShowReject={setShowReject} rejectReason={rejectReason} setRejectReason={setRejectReason}
              requestProcess={requestProcess} onClose={() => { setSelected(null); setShowReject(false); }} />
          </div>

          {/* Mobile: bottom sheet */}
          <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[88vh] overflow-y-auto shadow-2xl animate-slide-up">
            <div className="text-center pt-3"><div className="w-9 h-1 bg-gray-200 rounded mx-auto" /></div>
            <DetailContent r={selected} showReject={showReject} setShowReject={setShowReject} rejectReason={rejectReason} setRejectReason={setRejectReason}
              requestProcess={requestProcess} onClose={() => { setSelected(null); setShowReject(false); }} />
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="text-4xl mb-4">
              {confirmAction.action === 'credit' ? '💚' : confirmAction.action === 'refund' ? '💰' : confirmAction.action === 'reject' ? '⚠️' : '📦'}
            </div>
            <div className="text-lg font-bold text-gray-900 mb-2">Are you sure?</div>
            <div className="text-base text-gray-600 mb-6">{confirmAction.label}</div>
            {confirmAction.action === 'credit' && <div className="text-xs text-gray-400 mb-4">This will issue real store credit to the customer&apos;s Shopify account.</div>}
            {confirmAction.action === 'refund' && <div className="text-xs text-gray-400 mb-4">Order will be tagged in Shopify. Process the refund in Shopify admin.</div>}
            <div className="flex flex-col gap-3">
              <button onClick={confirmProcess} disabled={processing}
                className={`w-full py-4 rounded-xl text-base font-semibold text-white ${
                  confirmAction.action === 'reject' ? 'bg-red-600' : confirmAction.action === 'credit' ? 'bg-green-600' : 'bg-gray-900'
                } ${processing ? 'opacity-50' : ''}`}>
                {processing ? 'Processing...' : 'Yes, Confirm'}
              </button>
              <button onClick={() => setConfirmAction(null)} className="w-full py-3 text-gray-400 text-base">Cancel</button>
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

// Detail content — shared between desktop right panel and mobile bottom sheet
function DetailContent({ r, showReject, setShowReject, rejectReason, setRejectReason, requestProcess, onClose }: {
  r: Return;
  showReject: boolean;
  setShowReject: (v: boolean) => void;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  requestProcess: (id: string, action: string, label: string, amount?: number, extra?: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="text-xl font-bold text-gray-900">{r.customer_name}</div>
          <div className="text-sm text-gray-400 mt-0.5">{r.order_number} · {formatDate(r.return_requested)}</div>
          {r.customer_email && <div className="text-xs text-gray-400 mt-1">{r.customer_email}</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${r.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {r.type === 'credit' ? 'Store Credit' : 'Refund'}
          </span>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl ml-2">✕</button>
        </div>
      </div>

      {/* Flag */}
      {r.is_flagged && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-5">
          <div className="text-base font-semibold text-red-600">⚠ Flagged for Review</div>
          <div className="text-sm text-red-800 mt-1">{r.flag_reason}</div>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Items</div>
          <div className="text-lg font-semibold text-gray-900">{r.item_count}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Value</div>
          <div className="text-lg font-semibold text-gray-900">${r.subtotal?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Reason</div>
          <div className="text-sm font-medium text-gray-700">{r.reason || '—'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Source</div>
          <div className="text-sm font-medium text-gray-700">{r.imported_from === 'redo' ? 'Redo Import' : 'Shopify'}</div>
        </div>
      </div>

      {/* Timeline summary */}
      <div className="mb-5 text-sm text-gray-500 space-y-1.5">
        {r.return_requested && <div><span className="text-gray-400 w-24 inline-block">Requested:</span> {formatDate(r.return_requested)}</div>}
        {r.delivered_to_us && <div><span className="text-gray-400 w-24 inline-block">Received:</span> {formatDate(r.delivered_to_us)}</div>}
        {r.processed_at && <div><span className="text-gray-400 w-24 inline-block">Processed:</span> {formatDate(r.processed_at)}</div>}
      </div>

      {/* Actions */}
      {(r.status === 'inbox' || r.status === 'old') && !showReject && (
        <div className="flex flex-col gap-2.5 mb-5">
          {r.type === 'credit' ? (
            <button onClick={() => requestProcess(r.id, 'credit', `Issue $${r.subtotal?.toFixed(2)} store credit to ${r.customer_name}?`, r.subtotal)}
              className="w-full py-4 bg-green-600 text-white rounded-xl text-base font-semibold hover:bg-green-700 transition-colors">
              Issue Store Credit · ${r.subtotal?.toFixed(2)}
            </button>
          ) : (
            <button onClick={() => requestProcess(r.id, 'refund', `Approve $${r.subtotal?.toFixed(2)} refund for ${r.customer_name}?`, r.subtotal)}
              className="w-full py-4 bg-gray-900 text-white rounded-xl text-base font-semibold hover:bg-gray-800 transition-colors">
              Approve Refund · ${r.subtotal?.toFixed(2)}
            </button>
          )}
          <button onClick={() => setShowReject(true)}
            className="w-full py-4 bg-white text-red-600 border-2 border-red-200 rounded-xl text-base font-semibold hover:bg-red-50 transition-colors">
            Reject Return
          </button>
        </div>
      )}

      {/* Reject flow */}
      {showReject && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-gray-900 mb-3">Rejection Reason</div>
          <div className="flex flex-col gap-1.5">
            {REJECT_REASONS.map(reason => (
              <button key={reason} onClick={() => setRejectReason(reason)}
                className={`p-3.5 rounded-xl text-left text-base transition-colors ${
                  rejectReason === reason ? 'bg-red-50 border-2 border-red-300 text-red-700 font-semibold' : 'bg-gray-50 border border-gray-200 text-gray-600'
                }`}>{reason}</button>
            ))}
          </div>
          {rejectReason && (
            <button onClick={() => requestProcess(r.id, 'reject', `Reject return from ${r.customer_name}?`, undefined, rejectReason)}
              className="w-full mt-4 py-4 bg-red-600 text-white rounded-xl text-base font-semibold">
              Reject — {rejectReason}
            </button>
          )}
          <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="w-full mt-2 py-3 text-gray-400 text-base">Cancel</button>
        </div>
      )}

      {/* Shipping */}
      {r.status === 'shipping' && (
        <div className="bg-gray-100 rounded-xl p-5 text-center mb-5">
          <div className="text-2xl mb-2">🚚</div>
          <div className="text-base font-medium text-gray-500">{r.tracking_status || 'In transit'}</div>
          <button onClick={() => requestProcess(r.id, 'received', `Mark as received from ${r.customer_name}?`)}
            className="mt-4 w-full py-3 bg-white border border-gray-300 text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-50">
            Mark as Received
          </button>
        </div>
      )}

      {/* Done */}
      {r.status === 'done' && (
        <div className={`rounded-xl p-5 text-center mb-5 ${r.outcome === 'rejected' ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="text-2xl mb-2">{r.outcome === 'rejected' ? '✕' : '✓'}</div>
          <div className={`text-base font-semibold ${r.outcome === 'rejected' ? 'text-red-600' : 'text-green-600'}`}>
            {r.outcome === 'credit' && 'Store Credit Issued'}
            {r.outcome === 'refund' && 'Refunded'}
            {r.outcome === 'rejected' && `Rejected${r.reject_reason ? ` — ${r.reject_reason}` : ''}`}
          </div>
          {r.processed_at && <div className="text-sm text-gray-400 mt-1">Processed {formatDate(r.processed_at)}</div>}
        </div>
      )}
    </div>
  );
}
