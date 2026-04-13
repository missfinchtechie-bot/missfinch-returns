'use client';

import { useState, useEffect, useCallback } from 'react';

type Return = {
  id: string; return_number: string; order_number: string; customer_name: string; customer_email: string;
  status: string; type: string; outcome: string | null; reason: string | null; reject_reason: string | null;
  subtotal: number; item_count: number; final_amount: number; bonus_amount: number; total_fees: number;
  fee_per_item: number; paid_with: string; is_flagged: boolean; flag_reason: string | null;
  return_requested: string | null; delivered_to_us: string | null; processed_at: string | null;
  tracking_status: string | null; tracking_number: string | null; imported_from: string | null;
  label_url: string | null; customer_shipped: string | null; label_sent: string | null;
};

type Stats = { inbox: number; shipping: number; old: number; done: number; flagged: number; all: number };

const TABS = [
  { key: 'all', label: 'All', icon: '☰' },
  { key: 'inbox', label: 'Action Needed', icon: '⚡' },
  { key: 'shipping', label: 'In Transit', icon: '🚚' },
  { key: 'old', label: 'Unprocessed', icon: '📦' },
  { key: 'done', label: 'Completed', icon: '✓' },
];

const TAB_DESC: Record<string, string> = {
  all: 'All returns — sorted by most recent',
  inbox: 'Delivered to you — ready to process',
  shipping: 'Customer shipped — on the way to you',
  old: 'Delivered but never processed',
  done: 'Credited, refunded, or rejected',
};

const REJECT_REASONS = ['Tags removed', 'Signs of wear', 'Item damaged', 'Stains or odor', 'Not in original packaging', 'Wrong item returned', 'Other'];

type SortKey = 'order_number' | 'customer_name' | 'subtotal' | 'type' | 'return_requested' | 'status' | 'item_count';

function fmt(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShort(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function displayReason(r: Return): string {
  if (r.reason) return r.reason;
  return '—';
}

function typeBadge(type: string) {
  const map: Record<string, { bg: string; label: string }> = {
    credit: { bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'Credit' },
    refund: { bg: 'bg-amber-50 text-amber-700 border border-amber-200', label: 'Refund' },
    exchange: { bg: 'bg-sky-50 text-sky-700 border border-sky-200', label: 'Exchange' },
  };
  return map[type] || { bg: 'bg-gray-50 text-gray-500 border border-gray-200', label: type };
}

function statusInfo(r: Return) {
  if (r.status === 'done' && r.outcome === 'credit') return { text: 'Credited', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200' };
  if (r.status === 'done' && r.outcome === 'refund') return { text: 'Refunded', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200' };
  if (r.status === 'done' && r.outcome === 'rejected') return { text: 'Rejected', cls: 'bg-red-50 text-red-500 border border-red-200' };
  if (r.status === 'inbox') return { text: 'Ready', cls: 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold' };
  if (r.status === 'shipping') return { text: r.tracking_status || 'In transit', cls: 'bg-sky-50 text-sky-600 border border-sky-200' };
  if (r.status === 'old') return { text: 'Unprocessed', cls: 'bg-orange-50 text-orange-600 border border-orange-200' };
  return { text: r.status, cls: 'bg-gray-50 text-gray-500 border border-gray-200' };
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [tab, setTab] = useState('inbox');
  const [returns, setReturns] = useState<Return[]>([]);
  const [stats, setStats] = useState<Stats>({ inbox: 0, shipping: 0, old: 0, done: 0, flagged: 0, all: 0 });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Return | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; action: string; extra?: string; label: string; amount?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'return_requested', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 50;

  useEffect(() => { fetch('/api/auth', { method: 'GET' }).then(r => { if (r.ok) setAuthed(true); }).catch(() => {}); }, []);

  const login = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (res.ok) { setAuthed(true); setPwErr(''); } else setPwErr('Wrong password');
  };

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    else if (tab !== 'all') p.set('status', tab);
    p.set('limit', String(perPage));
    p.set('page', String(page));
    p.set('sort', sort.key);
    p.set('dir', sort.dir);
    const res = await fetch(`/api/returns?${p}`);
    const data = await res.json();
    setReturns(data.returns || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [tab, search, page, sort]);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/returns/stats');
    setStats(await res.json());
  }, []);

  useEffect(() => { if (authed) { fetchReturns(); fetchStats(); } }, [authed, tab, search, page, sort, fetchReturns, fetchStats]);
  useEffect(() => { setPage(1); }, [tab, search, sort]);

  const doAction = (id: string, action: string, label: string, amount?: number, extra?: string) => {
    setConfirm({ id, action, extra, label, amount });
  };

  const confirmAction = async () => {
    if (!confirm) return;
    setBusy(true);
    const res = await fetch('/api/returns', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: confirm.id, action: confirm.action, reject_reason: confirm.extra, amount: confirm.amount }),
    });
    if (res.ok) {
      const data = await res.json();
      const msgs: Record<string, string> = { credit: 'Store credit issued ✓', refund: 'Refund approved ✓', reject: 'Return rejected', received: 'Marked as received' };
      let m = msgs[confirm.action] || 'Done';
      if (data.shopify_error) m += ' (Shopify error)';
      flash(m);
      setSelected(null); setShowReject(false); setRejectReason(''); setConfirm(null);
      fetchReturns(); fetchStats();
    } else {
      const err = await res.json();
      flash(`Error: ${err.error || 'Failed'}`);
    }
    setBusy(false);
  };

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const toggleSort = (key: SortKey) => setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  const totalPages = Math.ceil(total / perPage);

  // Login screen
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl font-medium text-gray-900 tracking-wide">MISS FINCH</h1>
            <p className="text-sm text-gray-400 mt-1 tracking-widest uppercase">Returns</p>
          </div>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter password" className="w-full p-4 rounded-xl border border-gray-200 text-lg text-center focus:outline-none focus:border-gray-900 bg-white" />
          {pwErr && <p className="text-red-500 text-center text-sm mt-3">{pwErr}</p>}
          <button onClick={login} className="w-full mt-4 p-4 bg-gray-900 text-white rounded-xl text-base font-semibold">Log In</button>
        </div>
      </div>
    );
  }

  const Th = ({ k, children, center }: { k: SortKey; children: React.ReactNode; center?: boolean }) => (
    <th onClick={() => toggleSort(k)}
      className={`px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none whitespace-nowrap ${center ? 'text-center' : 'text-left'}`}>
      {children}
      <span className="ml-0.5">{sort.key === k ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
    </th>
  );

  return (
    <div className="min-h-screen bg-[#F5F4F1]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}

      {/* ─── Header ─── */}
      <div className="bg-[#1a1a1a] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <h1 className="font-serif text-white text-lg font-medium tracking-wider">MISS FINCH</h1>
          <span className="text-gray-600 text-xs tracking-wider uppercase hidden sm:inline">Returns</span>
        </div>
        <div className="relative flex-1 max-w-xs sm:max-w-sm">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order # or name..."
            className="w-full py-2 px-4 pl-9 bg-[#2a2a2a] border border-[#333] rounded-lg text-white text-sm focus:outline-none focus:border-[#555] placeholder-[#555]" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-xs">🔍</span>
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-sm hover:text-white">✕</button>}
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex overflow-x-auto no-scrollbar -mb-px">
            {TABS.map(t => {
              const count = t.key === 'all' ? stats.all : (stats[t.key as keyof Stats] || 0);
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
                  className={`px-3 sm:px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                    active ? 'border-[#1a1a1a] text-[#1a1a1a] font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>
                  {t.label}
                  {count > 0 && (
                    <span className={`text-[11px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-semibold ${
                      t.key === 'inbox' ? 'bg-[#1a1a1a] text-white' : t.key === 'old' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="hidden md:block text-sm text-gray-400 flex-shrink-0 pl-4">
            <span className="font-semibold text-gray-600">{stats.inbox + stats.shipping + stats.old}</span> active
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        <p className="text-xs text-gray-400 mb-3">{search ? `Search: "${search}"` : TAB_DESC[tab]}</p>

        {loading && <div className="text-center py-20 text-gray-300 text-sm">Loading...</div>}

        {!loading && returns.length === 0 && (
          <div className="text-center py-20 text-gray-300">
            <div className="text-3xl mb-2">{search ? '🔍' : '✓'}</div>
            <div className="text-sm">{search ? 'No results' : tab === 'inbox' ? 'No returns need action right now' : 'Nothing here'}</div>
          </div>
        )}

        {/* ─── Desktop Table ─── */}
        {!loading && returns.length > 0 && (
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <Th k="order_number">Order</Th>
                  <Th k="customer_name">Customer</Th>
                  <Th k="subtotal">Value</Th>
                  <Th k="type">Type</Th>
                  <Th k="status">Status</Th>
                  <Th k="return_requested">Date</Th>
                  <Th k="item_count" center>Items</Th>
                  <th className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {returns.map(r => {
                  const tb = typeBadge(r.type);
                  const si = statusInfo(r);
                  return (
                    <tr key={r.id} onClick={() => { setSelected(r); setShowReject(false); setRejectReason(''); }}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${r.is_flagged ? 'bg-red-50/40' : ''}`}>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{r.order_number}</td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-gray-900">{r.customer_name}</div>
                        {r.is_flagged && <div className="text-[10px] text-red-500 font-semibold mt-0.5">⚠ {r.flag_reason || 'Flagged'}</div>}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{r.subtotal > 0 ? `$${r.subtotal.toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tb.bg}`}>{tb.label}</span></td>
                      <td className="px-3 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${si.cls}`}>{si.text}</span></td>
                      <td className="px-3 py-3 text-sm text-gray-400 whitespace-nowrap">{fmtShort(r.return_requested)}</td>
                      <td className="px-3 py-3 text-sm text-gray-400 text-center">{r.item_count}</td>
                      <td className="px-3 py-3 text-sm text-gray-400 max-w-[140px] truncate">{displayReason(r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Mobile Cards ─── */}
        {!loading && returns.length > 0 && (
          <div className="md:hidden flex flex-col gap-2">
            {returns.map(r => {
              const tb = typeBadge(r.type);
              const si = statusInfo(r);
              return (
                <div key={r.id} onClick={() => { setSelected(r); setShowReject(false); setRejectReason(''); }}
                  className={`p-4 bg-white rounded-xl active:bg-gray-50 ${r.is_flagged ? 'border-2 border-red-200' : 'border border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-semibold text-gray-900 truncate">{r.customer_name}</div>
                      <div className="text-sm text-gray-400 mt-0.5">{r.order_number} · {fmtShort(r.return_requested)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tb.bg}`}>{tb.label}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${si.cls}`}>{si.text}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="font-medium text-gray-900">{r.subtotal > 0 ? `$${r.subtotal.toFixed(2)}` : '—'}</span>
                    <span>{r.item_count} item{r.item_count > 1 ? 's' : ''}</span>
                  </div>
                  {r.is_flagged && <div className="text-xs text-red-500 font-semibold mt-1.5">⚠ {r.flag_reason || 'Flagged'}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Pagination ─── */}
        {!loading && total > perPage && (
          <div className="flex items-center justify-between mt-4 mb-8">
            <span className="text-sm text-gray-400">{(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className={`px-2.5 py-1.5 text-sm rounded-lg border ${page <= 1 ? 'border-gray-100 text-gray-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pn: number;
                if (totalPages <= 5) pn = i + 1;
                else if (page <= 3) pn = i + 1;
                else if (page >= totalPages - 2) pn = totalPages - 4 + i;
                else pn = page - 2 + i;
                return (
                  <button key={pn} onClick={() => setPage(pn)}
                    className={`w-8 h-8 text-sm rounded-lg ${page === pn ? 'bg-gray-900 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100'}`}>{pn}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className={`px-2.5 py-1.5 text-sm rounded-lg border ${page >= totalPages ? 'border-gray-100 text-gray-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Detail Panel ─── */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelected(null); setShowReject(false); }} />
          <div className="hidden md:block absolute top-0 right-0 h-full w-[480px] bg-white shadow-2xl overflow-y-auto animate-slide-right">
            <Detail r={selected} showReject={showReject} setShowReject={setShowReject} rejectReason={rejectReason} setRejectReason={setRejectReason} doAction={doAction} onClose={() => { setSelected(null); setShowReject(false); }} />
          </div>
          <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[88vh] overflow-y-auto shadow-2xl animate-slide-up">
            <div className="text-center pt-3 pb-1"><div className="w-9 h-1 bg-gray-200 rounded mx-auto" /></div>
            <Detail r={selected} showReject={showReject} setShowReject={setShowReject} rejectReason={rejectReason} setRejectReason={setRejectReason} doAction={doAction} onClose={() => { setSelected(null); setShowReject(false); }} />
          </div>
        </div>
      )}

      {/* ─── Confirm Modal ─── */}
      {confirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirm(null)} />
          <div className="relative bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="text-4xl mb-4">{confirm.action === 'credit' ? '💚' : confirm.action === 'refund' ? '💰' : confirm.action === 'reject' ? '⚠️' : '📦'}</div>
            <div className="text-lg font-bold text-gray-900 mb-2">Are you sure?</div>
            <div className="text-base text-gray-600 mb-2">{confirm.label}</div>
            {confirm.action === 'credit' && <p className="text-xs text-gray-400 mb-4">This will issue real store credit to the customer&apos;s Shopify account.</p>}
            {confirm.action === 'refund' && <p className="text-xs text-gray-400 mb-4">Order will be tagged. Process the actual refund in Shopify admin.</p>}
            <div className="flex flex-col gap-3 mt-4">
              <button onClick={confirmAction} disabled={busy}
                className={`w-full py-4 rounded-xl text-base font-semibold text-white ${confirm.action === 'reject' ? 'bg-red-600' : confirm.action === 'credit' ? 'bg-emerald-600' : 'bg-gray-900'} ${busy ? 'opacity-50' : ''}`}>
                {busy ? 'Processing...' : 'Yes, Confirm'}
              </button>
              <button onClick={() => setConfirm(null)} className="w-full py-3 text-gray-400 text-sm">Cancel</button>
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

/* ─── Detail Panel Component ─── */
type ReturnItem = { id: string; product_name: string; sku: string; size: string; price: number; image_url: string | null };
type ShopifyOrder = {
  customer: { name: string; email: string; phone: string; orderCount: string; totalSpent: string } | null;
  shippingAddress: { name: string; address1: string; address2: string; city: string; province: string; zip: string } | null;
  lineItems: { id: string; title: string; variant: string; sku: string; quantity: number; price: string; image: string | null }[];
  total: string; refundable: boolean; gateways: string[];
};

function Detail({ r, showReject, setShowReject, rejectReason, setRejectReason, doAction, onClose }: {
  r: Return; showReject: boolean; setShowReject: (v: boolean) => void; rejectReason: string; setRejectReason: (v: string) => void;
  doAction: (id: string, action: string, label: string, amount?: number, extra?: string) => void; onClose: () => void;
}) {
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [shopify, setShopify] = useState<ShopifyOrder | null>(null);

  useEffect(() => {
    fetch(`/api/returns/items?return_id=${r.id}`).then(res => res.json()).then(d => setItems(d.items || [])).catch(() => {});
    if (r.order_number) {
      fetch(`/api/returns/order?order_number=${encodeURIComponent(r.order_number)}`).then(res => res.json()).then(d => {
        if (!d.error) setShopify(d);
      }).catch(() => {});
    }
  }, [r.id, r.order_number]);

  const tb = typeBadge(r.type);
  const si = statusInfo(r);

  // Use Shopify data for customer info if available
  const email = shopify?.customer?.email || r.customer_email;
  const phone = shopify?.customer?.phone;
  const addr = shopify?.shippingAddress;
  const customerOrders = shopify?.customer?.orderCount;
  const customerSpent = shopify?.customer?.totalSpent;
  // Use Shopify line items if we don't have return_items
  const displayItems = items.length > 0 ? items.map(i => ({
    title: i.product_name, variant: i.size, sku: i.sku, price: i.price.toFixed(2), image: i.image_url,
  })) : (shopify?.lineItems || []).map(i => ({
    title: i.title, variant: i.variant, sku: i.sku, price: i.price, image: i.image,
  }));

  const timelineItems: { date: string | null; label: string; color: string; detail?: string }[] = [];
  if (r.return_requested) timelineItems.push({ date: r.return_requested, label: 'Requested', color: 'bg-gray-300' });
  if (r.label_sent) timelineItems.push({ date: r.label_sent, label: 'Label sent', color: 'bg-blue-300' });
  if (r.customer_shipped) timelineItems.push({ date: r.customer_shipped, label: 'Shipped', color: 'bg-blue-400', detail: r.tracking_number || undefined });
  if (r.delivered_to_us) timelineItems.push({ date: r.delivered_to_us, label: 'Delivered to us', color: 'bg-emerald-400' });
  if (r.processed_at) {
    const pLabel = r.outcome === 'credit' ? 'Credit issued' : r.outcome === 'refund' ? 'Refund approved' : r.outcome === 'rejected' ? 'Rejected' : 'Processed';
    const pDetail = r.final_amount > 0 ? `$${r.final_amount.toFixed(2)}` : undefined;
    timelineItems.push({ date: r.processed_at, label: pLabel, color: r.outcome === 'rejected' ? 'bg-red-400' : 'bg-emerald-600', detail: pDetail });
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="text-xl font-bold text-gray-900">{r.customer_name}</div>
          <div className="text-sm text-gray-400 mt-1">{r.order_number}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${tb.bg}`}>{tb.label}</span>
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-lg ${si.cls}`}>{si.text}</span>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-lg ml-1">✕</button>
        </div>
      </div>

      {r.is_flagged && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="text-sm font-semibold text-red-600">⚠ Flagged</div>
          <div className="text-sm text-red-600 mt-0.5">{r.flag_reason}</div>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <InfoBox label="Value" value={r.subtotal > 0 ? `$${r.subtotal.toFixed(2)}` : '—'} />
        <InfoBox label="Items" value={String(r.item_count)} />
        <InfoBox label="Reason" value={displayReason(r)} />
        <InfoBox label="Source" value={r.imported_from === 'redo' ? 'Redo' : 'Shopify'} />
        {r.total_fees > 0 && <InfoBox label="Fees" value={`$${r.total_fees.toFixed(2)}`} />}
        {r.bonus_amount > 0 && <InfoBox label="Bonus" value={`$${r.bonus_amount.toFixed(2)}`} />}
      </div>

      {/* Order Items */}
      {displayItems.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2.5">Order Items</div>
          <div className="space-y-2">
            {displayItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{item.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {item.variant && <span>{item.variant}</span>}
                    {item.variant && item.sku && <span> · </span>}
                    {item.sku && <span>{item.sku}</span>}
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900 flex-shrink-0">${item.price}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Info */}
      {(email || phone || addr) && (
        <div className="mb-5">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2.5">Customer</div>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
            {email && <div className="text-gray-700">{email}</div>}
            {phone && <div className="text-gray-500">{phone}</div>}
            {addr && (
              <div className="text-gray-500 text-xs mt-1">
                {addr.address1}{addr.address2 ? `, ${addr.address2}` : ''}<br />
                {addr.city}, {addr.province} {addr.zip}
              </div>
            )}
            {customerOrders && customerSpent && (
              <div className="text-xs text-gray-400 mt-1 pt-1.5 border-t border-gray-200">
                {customerOrders} orders · ${parseFloat(customerSpent).toFixed(0)} lifetime
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Timeline */}
      {timelineItems.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2.5">Timeline</div>
          <div className="space-y-0">
            {timelineItems.map((t, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                  <div className={`w-2 h-2 rounded-full ${t.color}`} />
                  {i < timelineItems.length - 1 && <div className="w-px h-4 bg-gray-200 mt-0.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-gray-700 font-medium">{t.label}</span>
                    <span className="text-[11px] text-gray-400">{fmt(t.date)}</span>
                  </div>
                  {t.detail && <div className="text-[11px] text-gray-400 mt-0.5 truncate">{t.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tracking badge */}
      {r.tracking_status && r.status === 'shipping' && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 mb-5 text-center">
          <div className="text-sm font-medium text-sky-700">{r.tracking_status}</div>
          {r.tracking_number && <div className="text-xs text-sky-500 mt-0.5">{r.tracking_number}</div>}
        </div>
      )}

      {/* ── Actions ── */}
      {(r.status === 'inbox' || r.status === 'old') && !showReject && (
        <div className="flex flex-col gap-2.5 mb-5">
          {r.type === 'credit' || r.type === 'exchange' ? (
            <button onClick={() => doAction(r.id, 'credit', `Issue $${(r.subtotal || 0).toFixed(2)} store credit to ${r.customer_name}?`, r.subtotal)}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-colors">
              Issue Credit{r.subtotal > 0 ? ` · $${r.subtotal.toFixed(2)}` : ''}
            </button>
          ) : (
            <button onClick={() => doAction(r.id, 'refund', `Approve $${(r.subtotal || 0).toFixed(2)} refund for ${r.customer_name}?`, r.subtotal)}
              className="w-full py-4 bg-gray-900 text-white rounded-xl text-base font-semibold hover:bg-gray-800 active:bg-gray-700 transition-colors">
              Approve Refund{r.subtotal > 0 ? ` · $${r.subtotal.toFixed(2)}` : ''}
            </button>
          )}
          <button onClick={() => setShowReject(true)} className="w-full py-4 bg-white text-red-600 border-2 border-red-200 rounded-xl text-base font-semibold hover:bg-red-50 active:bg-red-100 transition-colors">
            Reject
          </button>
        </div>
      )}

      {showReject && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-gray-900 mb-3">Reason</div>
          <div className="flex flex-col gap-1.5">
            {REJECT_REASONS.map(reason => (
              <button key={reason} onClick={() => setRejectReason(reason)}
                className={`p-3 rounded-xl text-left text-sm transition-colors ${rejectReason === reason ? 'bg-red-50 border-2 border-red-300 text-red-700 font-semibold' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                {reason}
              </button>
            ))}
          </div>
          {rejectReason && (
            <button onClick={() => doAction(r.id, 'reject', `Reject return from ${r.customer_name}?`, undefined, rejectReason)}
              className="w-full mt-4 py-4 bg-red-600 text-white rounded-xl text-sm font-semibold">Reject — {rejectReason}</button>
          )}
          <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="w-full mt-2 py-3 text-gray-400 text-sm">Cancel</button>
        </div>
      )}

      {r.status === 'shipping' && (
        <button onClick={() => doAction(r.id, 'received', `Mark as received from ${r.customer_name}?`)}
          className="w-full py-4 bg-white border-2 border-gray-200 text-gray-900 rounded-xl text-base font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors mb-5">
          Mark as Received
        </button>
      )}

      {r.status === 'done' && (
        <div className={`rounded-xl p-5 text-center mb-5 border ${r.outcome === 'rejected' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className={`text-sm font-semibold ${r.outcome === 'rejected' ? 'text-red-600' : 'text-emerald-600'}`}>
            {r.outcome === 'credit' && `Credit Issued${r.final_amount > 0 ? ` · $${r.final_amount.toFixed(2)}` : ''}`}
            {r.outcome === 'refund' && `Refunded${r.final_amount > 0 ? ` · $${r.final_amount.toFixed(2)}` : ''}`}
            {r.outcome === 'rejected' && `Rejected${r.reject_reason ? ` — ${r.reject_reason}` : ''}`}
          </div>
          {r.processed_at && <div className="text-xs text-gray-400 mt-1">{fmt(r.processed_at)}</div>}
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-medium text-gray-800 truncate">{value}</div>
    </div>
  );
}
