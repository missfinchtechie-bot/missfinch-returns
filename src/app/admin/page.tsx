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

type Stats = {
  inbox: number;
  shipping: number;
  old: number;
  done: number;
  flagged: number;
};

const TABS = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'old', label: 'Old' },
  { key: 'done', label: 'History' },
];

const REJECT_REASONS = [
  'Tags removed',
  'Signs of wear',
  'Item damaged',
  'Stains or odor',
  'Not in original packaging',
  'Wrong item returned',
  'Other',
];

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

  // Check auth on load
  useEffect(() => {
    fetch('/api/auth', { method: 'GET' }).then(r => {
      if (r.ok) setAuthed(true);
      else setAuthed(false);
    }).catch(() => setAuthed(false));
  }, []);

  const login = async () => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      setAuthError('');
    } else {
      setAuthError('Wrong password');
    }
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

  useEffect(() => {
    if (authed) {
      fetchReturns();
      fetchStats();
    }
  }, [authed, tab, search, fetchReturns, fetchStats]);

  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string; extra?: string; label: string; amount?: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const requestProcess = (id: string, action: string, label: string, amount?: number, extra?: string) => {
    setConfirmAction({ id, action, extra, label, amount });
  };

  const confirmProcess = async () => {
    if (!confirmAction) return;
    setProcessing(true);
    const res = await fetch('/api/returns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: confirmAction.id,
        action: confirmAction.action,
        reject_reason: confirmAction.extra,
        amount: confirmAction.amount,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const msgs: Record<string, string> = {
        credit: 'Store credit issued ✓',
        refund: 'Refund approved ✓',
        reject: 'Return rejected',
        received: 'Marked as received',
      };
      let toastMsg = msgs[confirmAction.action] || 'Done';
      if (data.shopify_error) {
        toastMsg += ' (Shopify error — check logs)';
      }
      setToast(toastMsg);
      setTimeout(() => setToast(''), 3000);
      setSelected(null);
      setShowReject(false);
      setRejectReason('');
      setConfirmAction(null);
      fetchReturns();
      fetchStats();
    } else {
      const err = await res.json();
      setToast(`Error: ${err.error || 'Something went wrong'}`);
      setTimeout(() => setToast(''), 4000);
    }
    setProcessing(false);
  };

  const cancelConfirm = () => {
    setConfirmAction(null);
  };

  // Login screen
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl font-medium text-gray-900 tracking-wide">MISS FINCH</h1>
            <p className="text-sm text-gray-400 mt-1 tracking-widest uppercase">Returns Dashboard</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter password"
            className="w-full p-4 rounded-xl border border-gray-200 text-lg text-center focus:outline-none focus:border-gray-900 bg-white"
          />
          {authError && <p className="text-red-500 text-center text-sm mt-3">{authError}</p>}
          <button
            onClick={login}
            className="w-full mt-4 p-4 bg-gray-900 text-white rounded-xl text-base font-semibold"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] w-full relative" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-7 py-3 rounded-full text-base font-medium z-50 shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 px-5 md:px-8 pt-4 pb-3">
        <div className="flex justify-between items-center mb-3">
          <div>
            <span className="font-serif text-white text-lg md:text-xl font-medium tracking-wider">MISS FINCH</span>
            <span className="text-gray-500 text-xs ml-2.5">Returns Dashboard</span>
          </div>
        </div>
        <div className="relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order # or name..."
            className="w-full py-3 px-4 pl-10 bg-gray-800 border border-gray-700 rounded-xl text-white text-base focus:outline-none placeholder-gray-500"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px bg-gray-200">
        {[
          { n: stats.inbox, l: 'To Process' },
          { n: stats.shipping, l: 'Shipping' },
          { n: stats.old, l: 'Old (30d+)' },
        ].map((s, i) => (
          <div key={i} className="bg-white py-4 text-center">
            <div className="text-2xl font-semibold font-serif text-gray-900">{s.n}</div>
            <div className="text-xs text-gray-400 mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200 sticky top-0 z-10">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(''); }}
            className={`flex-1 py-3.5 text-center text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-gray-900 text-gray-900 font-bold'
                : 'border-transparent text-gray-400'
            }`}
          >
            {t.label}
            {t.key !== 'done' && stats[t.key as keyof Stats] > 0 && (
              <span className={`ml-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                t.key === 'inbox' ? 'bg-gray-900 text-white' :
                t.key === 'old' ? 'bg-amber-600 text-white' :
                'bg-gray-200 text-gray-600'
              }`}>
                {stats[t.key as keyof Stats]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Description */}
      <div className="px-5 pt-3.5 pb-1.5 text-xs text-gray-400 tracking-wide">
        {!search && tab === 'inbox' && 'Items received — tap to process'}
        {!search && tab === 'shipping' && 'Labels sent — waiting for packages'}
        {!search && tab === 'old' && 'Received 30+ days ago — unprocessed'}
        {!search && tab === 'done' && 'Completed returns'}
        {search && `Search results for "${search}"`}
      </div>

      {/* Returns List */}
      <div className="px-3 pb-24 grid grid-cols-1 md:grid-cols-2 gap-2">
        {loading && (
          <div className="text-center py-16 text-gray-300 col-span-full">
            <div className="text-3xl mb-2">⏳</div>
            <div>Loading...</div>
          </div>
        )}
        {!loading && returns.length === 0 && (
          <div className="text-center py-16 text-gray-300 col-span-full">
            <div className="text-3xl mb-2">{search ? '🔍' : '✓'}</div>
            <div>{search ? 'No results' : 'Nothing here'}</div>
          </div>
        )}
        {!loading && returns.map(r => (
          <div
            key={r.id}
            onClick={() => setSelected(r)}
            className={`p-4 bg-white rounded-xl cursor-pointer active:bg-gray-50 transition-colors ${
              r.is_flagged ? 'border-2 border-red-200' : 'border border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="text-base font-semibold text-gray-900">{r.customer_name}</div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                r.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {r.type === 'credit' ? 'Credit' : 'Refund'}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              {r.order_number} · {r.item_count} item{r.item_count > 1 ? 's' : ''} · ${r.subtotal?.toFixed(2) || '0.00'}
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-400">{r.reason || 'Imported from Redo'}</span>
              {r.is_flagged && <span className="text-xs text-red-600 font-semibold">⚠ Flagged</span>}
              {r.status === 'done' && r.outcome && (
                <span className={`text-xs font-medium ${
                  r.outcome === 'rejected' ? 'text-red-600' : 'text-green-600'
                }`}>
                  {r.outcome === 'credit' && `$${r.final_amount?.toFixed(2)} credit`}
                  {r.outcome === 'refund' && `$${r.final_amount?.toFixed(2)} refund`}
                  {r.outcome === 'rejected' && 'Rejected'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail Sheet */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelected(null); setShowReject(false); }} />
          <div className="absolute bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white rounded-t-2xl max-h-[88vh] overflow-y-auto shadow-2xl animate-slide-up">
            <div className="text-center pt-3">
              <div className="w-9 h-1 bg-gray-200 rounded mx-auto" />
            </div>
            <div className="px-6 pt-4 pb-8">
              {/* Header */}
              <div className="flex justify-between items-start mb-5">
                <div>
                  <div className="text-xl font-bold text-gray-900">{selected.customer_name}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{selected.order_number} · {selected.return_requested?.split('T')[0]}</div>
                </div>
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                  selected.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {selected.type === 'credit' ? 'Store Credit' : 'Refund'}
                </span>
              </div>

              {/* Flag */}
              {selected.is_flagged && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-5">
                  <div className="text-base font-semibold text-red-600">⚠ Flagged for Review</div>
                  <div className="text-sm text-red-800 mt-1">{selected.flag_reason}</div>
                </div>
              )}

              {/* Quick Info */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Items</div>
                  <div className="text-base font-semibold text-gray-900 mt-0.5">{selected.item_count}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Value</div>
                  <div className="text-base font-semibold text-gray-900 mt-0.5">${selected.subtotal?.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Source</div>
                  <div className="text-base font-semibold text-gray-900 mt-0.5">{selected.imported_from || 'New'}</div>
                </div>
              </div>

              {/* Actions */}
              {(selected.status === 'inbox' || selected.status === 'old') && !showReject && (
                <div className="flex flex-col gap-2.5 mb-5">
                  {selected.type === 'credit' ? (
                    <button
                      onClick={() => requestProcess(selected.id, 'credit', `Issue $${selected.subtotal?.toFixed(2)} store credit to ${selected.customer_name}?`, selected.subtotal)}
                      className="w-full py-4 bg-green-600 text-white rounded-xl text-base font-semibold"
                    >
                      Issue Store Credit · ${selected.subtotal?.toFixed(2)}
                    </button>
                  ) : (
                    <button
                      onClick={() => requestProcess(selected.id, 'refund', `Approve $${selected.subtotal?.toFixed(2)} refund for ${selected.customer_name}?`, selected.subtotal)}
                      className="w-full py-4 bg-gray-900 text-white rounded-xl text-base font-semibold"
                    >
                      Approve Refund · ${selected.subtotal?.toFixed(2)}
                    </button>
                  )}
                  <button
                    onClick={() => setShowReject(true)}
                    className="w-full py-4 bg-white text-red-600 border-2 border-red-200 rounded-xl text-base font-semibold"
                  >
                    Reject Return
                  </button>
                </div>
              )}

              {/* Reject Flow */}
              {showReject && (
                <div className="mb-5">
                  <div className="text-sm font-semibold text-gray-900 mb-3">Rejection Reason</div>
                  <div className="flex flex-col gap-1.5">
                    {REJECT_REASONS.map(reason => (
                      <button
                        key={reason}
                        onClick={() => setRejectReason(reason)}
                        className={`p-3.5 rounded-xl text-left text-base transition-colors ${
                          rejectReason === reason
                            ? 'bg-red-50 border-2 border-red-300 text-red-700 font-semibold'
                            : 'bg-gray-50 border border-gray-200 text-gray-600'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  {rejectReason && (
                    <button
                      onClick={() => requestProcess(selected.id, 'reject', `Reject return from ${selected.customer_name}?`, undefined, rejectReason)}
                      className="w-full mt-4 py-4 bg-red-600 text-white rounded-xl text-base font-semibold"
                    >
                      Reject — {rejectReason}
                    </button>
                  )}
                  <button
                    onClick={() => { setShowReject(false); setRejectReason(''); }}
                    className="w-full mt-2 py-3 text-gray-400 text-base"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Shipping status */}
              {selected.status === 'shipping' && (
                <div className="bg-gray-100 rounded-xl p-5 text-center mb-5">
                  <div className="text-2xl mb-2">🚚</div>
                  <div className="text-base font-medium text-gray-500">{selected.tracking_status || 'In transit'}</div>
                  <button
                    onClick={() => requestProcess(selected.id, 'received', `Mark as received from ${selected.customer_name}?`)}
                    className="mt-4 w-full py-3 bg-white border border-gray-300 text-gray-900 rounded-xl text-sm font-medium"
                  >
                    Mark as Received
                  </button>
                </div>
              )}

              {/* Done status */}
              {selected.status === 'done' && (
                <div className={`rounded-xl p-5 text-center mb-5 ${
                  selected.outcome === 'rejected' ? 'bg-red-50' : 'bg-green-50'
                }`}>
                  <div className="text-2xl mb-2">{selected.outcome === 'rejected' ? '✕' : '✓'}</div>
                  <div className={`text-base font-semibold ${
                    selected.outcome === 'rejected' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {selected.outcome === 'credit' && `Store Credit Issued`}
                    {selected.outcome === 'refund' && `Refunded`}
                    {selected.outcome === 'rejected' && `Rejected${selected.reject_reason ? ` — ${selected.reject_reason}` : ''}`}
                  </div>
                  {selected.processed_at && (
                    <div className="text-sm text-gray-400 mt-1">Processed {selected.processed_at.split('T')[0]}</div>
                  )}
                </div>
              )}

              {/* Close */}
              <button
                onClick={() => { setSelected(null); setShowReject(false); }}
                className="w-full py-3.5 border border-gray-200 rounded-xl text-gray-400 text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60" onClick={cancelConfirm} />
          <div className="relative bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="text-4xl mb-4">
              {confirmAction.action === 'credit' ? '💚' : confirmAction.action === 'refund' ? '💰' : confirmAction.action === 'reject' ? '⚠️' : '📦'}
            </div>
            <div className="text-lg font-bold text-gray-900 mb-2">Are you sure?</div>
            <div className="text-base text-gray-600 mb-6">{confirmAction.label}</div>
            {confirmAction.action === 'credit' && (
              <div className="text-xs text-gray-400 mb-4">This will issue real store credit to the customer&apos;s Shopify account.</div>
            )}
            {confirmAction.action === 'refund' && (
              <div className="text-xs text-gray-400 mb-4">Order will be tagged in Shopify. Process the refund in Shopify admin.</div>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmProcess}
                disabled={processing}
                className={`w-full py-4 rounded-xl text-base font-semibold text-white ${
                  confirmAction.action === 'reject' ? 'bg-red-600' :
                  confirmAction.action === 'credit' ? 'bg-green-600' : 'bg-gray-900'
                } ${processing ? 'opacity-50' : ''}`}
              >
                {processing ? 'Processing...' : 'Yes, Confirm'}
              </button>
              <button
                onClick={cancelConfirm}
                className="w-full py-3 text-gray-400 text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .font-serif { font-family: 'Cormorant Garamond', serif; }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .animate-slide-up { animation: slide-up 0.25s ease; }
        .animate-fade-in { animation: fade-in 0.25s ease; }
      `}</style>
    </div>
  );
}
