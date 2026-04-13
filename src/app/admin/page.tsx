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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
}

function fmtShort(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
}

function fmtTime(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/New_York' });
  return `${dateStr} · ${timeStr} EST`;
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
  const [confirm, setConfirm] = useState<{ id: string; action: string; extra?: string; label: string; amount?: number; imported?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [forceShopify, setForceShopify] = useState(false);
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

  const doAction = (id: string, action: string, label: string, amount?: number, extra?: string, imported?: boolean) => {
    setForceShopify(false);
    setConfirm({ id, action, extra, label, amount, imported });
  };

  const confirmAction = async () => {
    if (!confirm) return;
    setBusy(true);
    const res = await fetch('/api/returns', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: confirm.id, action: confirm.action, reject_reason: confirm.extra, amount: confirm.amount, force_shopify: forceShopify }),
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
                  <th onClick={() => toggleSort('order_number')} className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none text-left">Order{sort.key === 'order_number' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('customer_name')} className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none text-left">Customer{sort.key === 'customer_name' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('subtotal')} className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none text-left">Return ${sort.key === 'subtotal' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('type')} className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none text-left">Type{sort.key === 'type' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('status')} className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none text-left">Status{sort.key === 'status' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('return_requested')} className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none text-left">Date{sort.key === 'return_requested' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('item_count')} className="px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none text-center">Items{sort.key === 'item_count' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
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
            {confirm.action === 'refund' && <p className="text-xs text-gray-400 mb-4">Order will be refunded to the customer&apos;s original payment method.</p>}
            {confirm.imported && (
              <label className="flex items-center gap-2 justify-center mb-4 cursor-pointer">
                <input type="checkbox" checked={forceShopify} onChange={e => setForceShopify(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-xs text-amber-600 font-medium">Execute in Shopify (Redo import)</span>
              </label>
            )}
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
type OrderData = {
  id: string; name: string; createdAt: string; total: string; subtotal: string; totalDiscount: string;
  shipping: string; currentTotal: string; refundable: boolean; discountCodes: string[];
  gateway: string; tags: string[]; channel: string | null;
  customer: { id: string; name: string; email: string; phone: string; orderCount: string; totalSpent: string } | null;
  shippingAddress: { name: string; address1: string; address2: string | null; city: string; provinceCode: string; zip: string; country: string; phone: string } | null;
  lineItems: { id: string; title: string; variant: string; sku: string; quantity: number; retailPrice: string; paidPrice: string; discount: string; image: string | null }[];
  fulfillments: { tracking: { number: string; company: string; url: string } | null; deliveredAt: string; shippedAt: string; status: string; events: { date: string; status: string; message: string; location: string | null }[] }[];
};
type CustomerHistory = { totalReturns: number; returnsIn90Days: number; totalReturnValue: number };
type Note = { id: string; detail: string; event_date: string };

function Detail({ r, showReject, setShowReject, rejectReason, setRejectReason, doAction, onClose }: {
  r: Return; showReject: boolean; setShowReject: (v: boolean) => void; rejectReason: string; setRejectReason: (v: string) => void;
  doAction: (id: string, action: string, label: string, amount?: number, extra?: string, imported?: boolean) => void; onClose: () => void;
}) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [history, setHistory] = useState<CustomerHistory | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setLoadingOrder(true);
    if (r.order_number) {
      fetch(`/api/returns/order?order_number=${encodeURIComponent(r.order_number)}`)
        .then(res => res.json()).then(d => { if (!d.error) setOrder(d); })
        .catch(() => {}).finally(() => setLoadingOrder(false));
    } else { setLoadingOrder(false); }
    fetch(`/api/returns/history?customer_name=${encodeURIComponent(r.customer_name)}`)
      .then(res => res.json()).then(d => { if (!d.error) setHistory(d); }).catch(() => {});
    fetch(`/api/returns/notes?return_id=${r.id}`)
      .then(res => res.json()).then(d => setNotes(d.notes || [])).catch(() => {});
  }, [r.id, r.order_number, r.customer_name]);

  const saveNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    await fetch('/api/returns/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ return_id: r.id, note: newNote }) });
    const res = await fetch(`/api/returns/notes?return_id=${r.id}`);
    const d = await res.json();
    setNotes(d.notes || []);
    setNewNote('');
    setSavingNote(false);
  };

  const tb = typeBadge(r.type);
  const si = statusInfo(r);
  const cust = order?.customer;
  const addr = order?.shippingAddress;
  const ful = order?.fulfillments?.[0];
  const retailTotal = order?.lineItems?.reduce((s, i) => s + parseFloat(i.retailPrice || '0') * i.quantity, 0) || 0;
  const orderTotal = parseFloat(order?.total || '0');
  const discount = parseFloat(order?.totalDiscount || '0');
  const restockFee = orderTotal > 0 && r.subtotal > 0 ? orderTotal - r.subtotal : 0;

  // Intelligence calculations
  const now = new Date();
  const deliveredDate = ful?.deliveredAt ? new Date(ful.deliveredAt) : null;
  const requestedDate = r.return_requested ? new Date(r.return_requested) : null;
  const daysInInbox = r.delivered_to_us ? Math.floor((now.getTime() - new Date(r.delivered_to_us).getTime()) / 86400000) : null;
  const daysToReturn = deliveredDate && requestedDate ? Math.floor((requestedDate.getTime() - deliveredDate.getTime()) / 86400000) : null;
  const returnWindowDays = r.type === 'refund' ? 7 : 14;
  const daysInWindow = deliveredDate && requestedDate ? Math.floor((requestedDate.getTime() - deliveredDate.getTime()) / 86400000) : null;
  const withinWindow = daysInWindow !== null ? daysInWindow <= returnWindowDays : null;
  const isNewCustomer = cust?.orderCount === '1';
  const hasDiscount = (order?.discountCodes?.length || 0) > 0;
  const customerSpent = cust ? parseFloat(cust.totalSpent || '0') : 0;
  const returnPctOfLTV = customerSpent > 0 ? ((r.subtotal || 0) / customerSpent * 100) : null;

  // Risk signals
  const risks: { label: string; level: 'info' | 'warn' | 'danger' }[] = [];
  if (isNewCustomer) risks.push({ label: 'New customer — 1st order on file', level: 'info' });
  if (history && history.returnsIn90Days >= 3) risks.push({ label: `${history.returnsIn90Days} returns in 90 days`, level: 'danger' });
  // Only show return rate for customers with 2+ orders (avoids misleading 100% on new customers)
  if (!isNewCustomer && cust) {
    const rate = (history?.totalReturns || 0) / Math.max(parseInt(cust.orderCount || '1'), 1) * 100;
    if (rate >= 50) risks.push({ label: `${rate.toFixed(0)}% return rate (${history?.totalReturns} of ${cust.orderCount} orders)`, level: 'warn' });
  }
  if (daysToReturn !== null && daysToReturn >= 0 && daysToReturn <= 1) risks.push({ label: 'Returned within 1 day of delivery', level: 'warn' });
  if (withinWindow === false && daysInWindow !== null && daysInWindow >= 0) risks.push({ label: `Outside ${returnWindowDays}-day return window (day ${daysInWindow})`, level: 'danger' });
  if (hasDiscount && r.type === 'refund') risks.push({ label: 'Discount code used on refund return', level: 'info' });

  // Shopify admin link
  const shopifyOrderId = order?.id?.split('/').pop();
  const shopifyLink = shopifyOrderId ? `https://admin.shopify.com/store/missfinchnyc/orders/${shopifyOrderId}` : null;

  return (
    <div className="p-5">
      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-lg font-bold text-gray-900">{r.customer_name}</div>
          <div className="text-sm text-gray-400">
            {r.order_number} · Ordered {order ? fmtShort(order.createdAt) : '...'}
            {shopifyLink && <a href={shopifyLink} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-blue-500 hover:text-blue-600">↗</a>}
          </div>
          {r.return_requested && <div className="text-xs text-gray-400">Return created {fmtShort(r.return_requested)}</div>}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {order?.channel && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{order.channel}</span>}
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">via {r.imported_from === 'redo' ? 'Redo' : 'Portal'}</span>
            {daysInInbox !== null && daysInInbox >= 0 && (r.status === 'inbox' || r.status === 'old') && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${daysInInbox > 7 ? 'bg-red-50 text-red-500' : daysInInbox > 3 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {daysInInbox === 0 ? 'Received today' : `Received ${daysInInbox}d ago`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${tb.bg}`}>{tb.label}</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${si.cls}`}>{si.text}</span>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 ml-1">✕</button>
        </div>
      </div>

      {/* ── Risk / Intelligence ── */}
      {risks.length > 0 && (
        <div className="mb-3 space-y-1">
          {risks.map((risk, i) => (
            <div key={i} className={`text-xs px-3 py-1.5 rounded-lg ${risk.level === 'danger' ? 'bg-red-50 text-red-600' : risk.level === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
              {risk.level === 'danger' ? '🔴' : risk.level === 'warn' ? '🟡' : 'ℹ️'} {risk.label}
            </div>
          ))}
        </div>
      )}

      {r.is_flagged && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm">
          <span className="font-semibold text-red-600">⚠ Flagged</span>
          {r.flag_reason && <span className="text-red-600 ml-1">— {r.flag_reason}</span>}
        </div>
      )}

      {/* ── Reason + discount ── */}
      <div className="space-y-1 mb-4">
        {r.reason && <div className="text-xs text-gray-500"><span className="text-gray-400">Reason:</span> {r.reason}</div>}
        {order?.discountCodes?.length ? <div className="text-xs text-gray-400">Discount: <span className="font-medium text-gray-600">{order.discountCodes.join(', ')}</span></div> : null}
        {daysToReturn !== null && daysToReturn >= 0 && <div className="text-xs text-gray-400">Returned {daysToReturn} day{daysToReturn !== 1 ? 's' : ''} after delivery {withinWindow !== null && daysInWindow !== null && daysInWindow >= 0 && <span className={withinWindow ? 'text-emerald-500' : 'text-red-500'}>({withinWindow ? `within ${returnWindowDays}d window` : `day ${daysInWindow} — expired`})</span>}</div>}
      </div>

      {/* ── Return Items ── */}
      <div className="mb-4">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Return Items</div>
        {loadingOrder ? <div className="text-xs text-gray-300 py-4 text-center">Loading...</div> : (
          <div className="space-y-2">
            {(order?.lineItems || []).map((item, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex gap-3">
                  {item.image && <img src={item.image} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-50" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{item.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{item.variant}{item.sku ? ` · ${item.sku}` : ''}</div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-gray-400">Retail</span><span className="text-gray-700">${parseFloat(item.retailPrice).toFixed(2)}</span></div>
                  {parseFloat(item.discount) > 0 && <div className="flex justify-between text-xs"><span className="text-gray-400">Discount</span><span className="text-red-500">-${parseFloat(item.discount).toFixed(2)}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Return Shipping (TOP — actionable info) ── */}
      {(r.tracking_number || r.tracking_status || r.delivered_to_us) && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Return Shipping</div>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-400">Status</span><span className={`font-medium ${r.tracking_status === 'Delivered' ? 'text-emerald-600' : 'text-blue-600'}`}>{r.tracking_status || 'Unknown'}</span></div>
            {r.delivered_to_us && <div className="flex justify-between"><span className="text-gray-400">Received</span><span className="text-gray-700">{fmtShort(r.delivered_to_us)}</span></div>}
            {r.tracking_number && <div className="flex justify-between"><span className="text-gray-400">Tracking</span><span className="text-gray-600 text-xs truncate max-w-[200px]">{r.tracking_number}</span></div>}
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      {order && (
        <div className="mb-4 bg-gray-50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Summary</div>
          <div className="space-y-1.5 text-sm">
            {retailTotal > 0 && Math.abs(retailTotal - orderTotal) > 0.01 && (
              <div className="flex justify-between"><span className="text-gray-400">Retail</span><span className="text-gray-600">${retailTotal.toFixed(2)}</span></div>
            )}
            {discount > 0 && <div className="flex justify-between"><span className="text-gray-400">Discount</span><span className="text-red-500">-${discount.toFixed(2)}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500 font-medium">Order total</span><span className="text-gray-900 font-medium">${orderTotal.toFixed(2)}</span></div>
            {restockFee > 0.01 && r.type === 'refund' && <div className="flex justify-between"><span className="text-gray-400">Restocking fee</span><span className="text-red-500">-${restockFee.toFixed(2)}</span></div>}
            <div className="flex justify-between pt-1.5 border-t border-gray-200">
              <span className="text-gray-900 font-semibold">Return value</span>
              <span className="text-gray-900 font-bold">${(r.subtotal || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Customer ── */}
      {cust && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Customer</div>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="font-medium text-gray-900">{cust.name}</div>
            <div className="text-gray-600">{cust.email}</div>
            {cust.phone && <div className="text-gray-500">{cust.phone}</div>}
            {addr && <div className="text-gray-400 text-xs pt-1">{addr.address1}{addr.address2 ? `, ${addr.address2}` : ''}<br/>{addr.city}, {addr.provinceCode} {addr.zip}</div>}
            <div className="text-xs text-gray-400 pt-1.5 border-t border-gray-200 flex gap-3 flex-wrap">
              <span>{cust.orderCount} order{cust.orderCount !== '1' ? 's' : ''}</span>
              <span>${customerSpent.toFixed(0)} lifetime</span>
              {history && <span>{history.totalReturns} return{history.totalReturns !== 1 ? 's' : ''} (${history.totalReturnValue.toFixed(0)})</span>}
              {returnPctOfLTV !== null && <span>{returnPctOfLTV.toFixed(0)}% of LTV</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Full Lifecycle Timeline ── */}
      <div className="mb-4">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Timeline</div>
        <div className="space-y-0">
          {(() => {
            const events: { date: string; label: string; color: string; detail?: string }[] = [];
            if (order?.createdAt) events.push({ date: order.createdAt, label: 'Order placed', color: 'bg-gray-300', detail: `${order.channel || 'Online Store'} · $${parseFloat(order.total || '0').toFixed(2)}` });
            if (ful?.shippedAt) events.push({ date: ful.shippedAt, label: 'Order shipped', color: 'bg-blue-300', detail: ful.tracking ? `${ful.tracking.company} ${ful.tracking.number}` : undefined });
            if (ful?.deliveredAt) events.push({ date: ful.deliveredAt, label: 'Order delivered to customer', color: 'bg-blue-400' });
            if (r.return_requested) events.push({ date: r.return_requested, label: 'Return requested', color: 'bg-amber-400', detail: r.reason || undefined });
            if (r.label_sent) events.push({ date: r.label_sent, label: 'Return label sent', color: 'bg-amber-300' });
            if (r.customer_shipped) events.push({ date: r.customer_shipped, label: 'Customer shipped return', color: 'bg-sky-400', detail: r.tracking_number || undefined });
            if (r.delivered_to_us) events.push({ date: r.delivered_to_us, label: 'Return received at warehouse', color: 'bg-emerald-400' });
            if (r.processed_at) {
              const pLabel = r.outcome === 'credit' ? 'Store credit issued' : r.outcome === 'refund' ? 'Refund issued' : r.outcome === 'rejected' ? 'Return rejected' : 'Processed';
              events.push({ date: r.processed_at, label: pLabel, color: r.outcome === 'rejected' ? 'bg-red-400' : 'bg-emerald-600', detail: r.final_amount > 0 ? `$${r.final_amount.toFixed(2)}` : (r.reject_reason || undefined) });
            }
            events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return events.map((e, i) => <TLRow key={i} date={e.date} label={e.label} color={e.color} detail={e.detail} last={i === events.length - 1} />);
          })()}
        </div>
      </div>

      {/* ── Outbound Shipping + Carrier Scans ── */}
      {ful && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Outbound Shipping</div>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-400">Status</span><span className={`font-medium ${ful.deliveredAt ? 'text-emerald-600' : 'text-blue-600'}`}>{ful.deliveredAt ? 'Delivered' : ful.status}</span></div>
            {ful.deliveredAt && <div className="flex justify-between"><span className="text-gray-400">Delivered</span><span className="text-gray-700">{fmtShort(ful.deliveredAt)}</span></div>}
            {ful.tracking && <div className="flex justify-between"><span className="text-gray-400">Tracking</span><a href={ful.tracking.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs truncate max-w-[200px]">{ful.tracking.company} {ful.tracking.number}</a></div>}
          </div>
          {ful.events && ful.events.length > 0 && (
            <TrackingHistory events={ful.events} />
          )}
        </div>
      )}

      {/* ── Notes ── */}
      <div className="mb-5">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Notes</div>
        {notes.length > 0 && (
          <div className="space-y-2 mb-3">
            {notes.map(n => (
              <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                <div className="text-xs text-gray-700">{n.detail}</div>
                <div className="text-[10px] text-gray-400 mt-1">{fmt(n.event_date)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveNote()}
            placeholder="Add a note..." className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white" />
          <button onClick={saveNote} disabled={savingNote || !newNote.trim()}
            className={`px-3 py-2 text-xs font-medium rounded-lg ${newNote.trim() ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-300'}`}>
            {savingNote ? '...' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Actions ── */}
      {(r.status === 'inbox' || r.status === 'old') && !showReject && (
        <div className="flex flex-col gap-2.5 mb-5">
          {r.type === 'credit' || r.type === 'exchange' ? (
            <button onClick={() => doAction(r.id, 'credit', `Issue $${(r.subtotal || 0).toFixed(2)} store credit to ${r.customer_name}?`, r.subtotal, undefined, r.imported_from === 'redo')}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-colors">
              Issue Credit{r.subtotal > 0 ? ` · $${r.subtotal.toFixed(2)}` : ''}
            </button>
          ) : (
            <button onClick={() => doAction(r.id, 'refund', `Refund $${(r.subtotal || 0).toFixed(2)} to ${r.customer_name}?`, r.subtotal, undefined, r.imported_from === 'redo')}
              className="w-full py-4 bg-gray-900 text-white rounded-xl text-base font-semibold hover:bg-gray-800 active:bg-gray-700 transition-colors">
              Approve Refund{r.subtotal > 0 ? ` · $${r.subtotal.toFixed(2)}` : ''}
            </button>
          )}
          <button onClick={() => setShowReject(true)} className="w-full py-3 bg-white text-red-500 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">Reject</button>
        </div>
      )}

      {showReject && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-gray-900 mb-3">Rejection Reason</div>
          <div className="flex flex-col gap-1.5">
            {REJECT_REASONS.map(reason => (
              <button key={reason} onClick={() => setRejectReason(reason)}
                className={`p-3 rounded-xl text-left text-sm ${rejectReason === reason ? 'bg-red-50 border-2 border-red-300 text-red-700 font-semibold' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                {reason}
              </button>
            ))}
          </div>
          {rejectReason && <button onClick={() => doAction(r.id, 'reject', `Reject return from ${r.customer_name}?`, undefined, rejectReason)} className="w-full mt-4 py-4 bg-red-600 text-white rounded-xl text-sm font-semibold">Reject — {rejectReason}</button>}
          <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="w-full mt-2 py-3 text-gray-400 text-sm">Cancel</button>
        </div>
      )}

      {r.status === 'shipping' && (
        <button onClick={() => doAction(r.id, 'received', `Mark as received from ${r.customer_name}?`)}
          className="w-full py-4 bg-white border-2 border-gray-200 text-gray-900 rounded-xl text-base font-semibold hover:bg-gray-50 transition-colors mb-5">Mark as Received</button>
      )}

      {r.status === 'done' && (
        <div className={`rounded-xl p-4 text-center mb-5 border ${r.outcome === 'rejected' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className={`text-sm font-semibold ${r.outcome === 'rejected' ? 'text-red-600' : 'text-emerald-600'}`}>
            {r.outcome === 'credit' && `Credit Issued${r.final_amount > 0 ? ` · $${r.final_amount.toFixed(2)}` : ''}`}
            {r.outcome === 'refund' && `Refunded${r.final_amount > 0 ? ` · $${r.final_amount.toFixed(2)}` : ''}`}
            {r.outcome === 'rejected' && `Rejected${r.reject_reason ? ` — ${r.reject_reason}` : ''}`}
          </div>
          {r.processed_at && <div className="text-xs text-gray-400 mt-1">{fmt(r.processed_at)}</div>}
        </div>
      )}

      {order?.gateway && (
        <div className="text-[11px] text-gray-300 text-center">
          {order.channel || 'Online Store'} · {order.gateway.replace('_', ' ')}
        </div>
      )}
    </div>
  );
}

function TLRow({ date, label, color, detail, last }: { date: string; label: string; color: string; detail?: string; last?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="flex flex-col items-center flex-shrink-0 pt-1.5">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        {!last && <div className="w-px h-5 bg-gray-200 mt-0.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-700 font-medium">{label}</div>
        <div className="text-[10px] text-gray-400 mt-0.5">{fmtTime(date)}</div>
        {detail && <div className="text-[10px] text-gray-400 truncate">{detail}</div>}
      </div>
    </div>
  );
}

function TrackingHistory({ events }: { events: { date: string; status: string; message: string; location: string | null }[] }) {
  const [expanded, setExpanded] = useState(false);
  // Show most recent events first, deduplicate by message+location
  const sorted = [...events].reverse();
  const shown = expanded ? sorted : sorted.slice(0, 3);

  const statusColor = (s: string) => {
    if (s === 'DELIVERED') return 'bg-emerald-400';
    if (s === 'OUT_FOR_DELIVERY') return 'bg-emerald-300';
    if (s === 'IN_TRANSIT') return 'bg-blue-300';
    return 'bg-gray-300';
  };

  return (
    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-3 py-2 bg-gray-50 text-[10px] text-gray-500 font-medium uppercase tracking-wider text-left hover:bg-gray-100 flex justify-between items-center">
        <span>Carrier Scans ({events.length})</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      <div className="px-3 py-2 space-y-0">
        {shown.map((e, i) => (
          <div key={i} className="flex items-start gap-2.5 py-1">
            <div className="flex flex-col items-center flex-shrink-0 pt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor(e.status)}`} />
              {i < shown.length - 1 && <div className="w-px h-4 bg-gray-100 mt-0.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-gray-700">{e.message}</div>
              <div className="text-[10px] text-gray-400">{fmtTime(e.date)}{e.location ? ` — ${e.location}` : ''}</div>
            </div>
          </div>
        ))}
      </div>
      {events.length > 3 && !expanded && (
        <button onClick={() => setExpanded(true)} className="w-full px-3 py-1.5 text-[10px] text-blue-500 hover:text-blue-600 text-center border-t border-gray-100">
          Show all {events.length} events
        </button>
      )}
    </div>
  );
}
