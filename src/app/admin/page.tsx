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

type Stats = { inbox: number; shipping: number; old: number; done: number; flagged: number; all: number; lost: number; pendingRefund: number; pendingCredit: number; inTransitValue: number; processedThisWeek: number };

const TABS = [
  { key: 'all', label: 'All', icon: '☰' },
  { key: 'inbox', label: 'Action Needed', icon: '⚡' },
  { key: 'shipping', label: 'In Transit', icon: '🚚' },
  { key: 'old', label: 'Backlog', icon: '📦' },
  { key: 'done', label: 'Completed', icon: '✓' },
];

const TAB_DESC: Record<string, string> = {
  all: 'All returns — sorted by most recent',
  inbox: 'Delivered to you — ready to process',
  shipping: 'Customer shipped — on the way to you',
  old: 'Delivered 30+ days ago — no action taken',
  done: 'Credited, refunded, rejected, or lost',
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
    credit: { bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80', label: 'Credit' },
    refund: { bg: 'bg-amber-50 text-amber-700 border border-amber-200/80', label: 'Refund' },
    exchange: { bg: 'bg-sky-50 text-sky-700 border border-sky-200/80', label: 'Exchange' },
  };
  return map[type] || { bg: 'bg-stone-100 text-stone-500 border border-stone-200/80', label: type };
}

function statusInfo(r: Return) {
  if (r.status === 'done' && r.outcome === 'credit') return { text: 'Credited', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80' };
  if (r.status === 'done' && r.outcome === 'refund') return { text: 'Refunded', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80' };
  if (r.status === 'done' && r.outcome === 'rejected') return { text: 'Rejected', cls: 'bg-red-50 text-red-500 border border-red-200/80' };
  if (r.status === 'done' && r.outcome === 'lost') return { text: 'Lost', cls: 'bg-purple-50 text-purple-600 border border-purple-200/80' };
  if (r.status === 'inbox') return { text: 'Ready', cls: 'bg-amber-50 text-amber-700 border border-amber-200/80 font-semibold' };
  if (r.status === 'shipping') return { text: r.tracking_status || 'In transit', cls: 'bg-sky-50 text-sky-600 border border-sky-200/80' };
  if (r.status === 'old') return { text: 'Backlog', cls: 'bg-orange-50 text-orange-600 border border-orange-200/80' };
  return { text: r.status, cls: 'bg-stone-100 text-stone-500 border border-stone-200/80' };
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [tab, setTab] = useState('inbox');
  const [returns, setReturns] = useState<Return[]>([]);
  const [stats, setStats] = useState<Stats>({ inbox: 0, shipping: 0, old: 0, done: 0, flagged: 0, all: 0, lost: 0, pendingRefund: 0, pendingCredit: 0, inTransitValue: 0, processedThisWeek: 0 });
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
  const [typeFilter, setTypeFilter] = useState<string>('all');
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

  // Run maintenance on first load (moves stale inbox→backlog, stale shipping→lost)
  useEffect(() => {
    if (authed) {
      fetch('/api/returns/maintenance', { method: 'POST' })
        .then(r => r.json())
        .then(d => {
          if ((d.movedToBacklog || 0) > 0 || (d.markedLost || 0) > 0) {
            fetchReturns();
            fetchStats();
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

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
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-semibold text-[var(--foreground)] tracking-wide">MISS FINCH</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 tracking-widest uppercase">Returns</p>
          </div>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter password" className="w-full p-4 rounded-xl border border-[var(--border)] text-lg text-center focus:outline-none focus:border-[var(--primary)] bg-[var(--card)]" />
          {pwErr && <p className="text-red-500 text-center text-sm mt-3">{pwErr}</p>}
          <button onClick={login} className="w-full mt-4 p-4 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-base font-semibold hover:opacity-90 transition-opacity">Log In</button>
        </div>
      </div>
    );
  }

  const filteredReturns = typeFilter === 'all' ? returns : returns.filter(r => r.type === typeFilter);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--primary-foreground)] px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}

      {/* ─── Header ─── */}
      <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <h1 className="font-heading text-lg sm:text-xl font-semibold italic text-[var(--foreground)]">Miss Finch</h1>
            <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">NYC</span>
            <span className="mx-1 h-5 w-px bg-[var(--border)]" />
            <div className="flex items-center gap-0.5 bg-[var(--muted)] rounded-lg p-0.5">
              <span className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-2 sm:px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md">Returns</span>
              <a href="/admin/messages" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors">Messages</a>
              <a href="/admin/financials" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors">Financials</a>
            </div>
          </div>
          <div className="relative flex-1 max-w-xs sm:max-w-sm">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order # or name..."
              className="w-full py-2.5 px-4 pl-9 bg-[var(--muted)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] placeholder-[var(--muted-foreground)] transition-all" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-xs">🔍</span>
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-sm hover:text-[var(--foreground)]">✕</button>}
          </div>
        </div>
      </header>

      {/* ─── Stats Cards ─── */}
      <div className="bg-[var(--card)] border-b border-[var(--border)]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl px-4 py-3.5 shadow-sm">
              <div className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold">Pending Refunds</div>
              <div className="text-xl font-bold text-amber-800 font-heading mt-0.5">${stats.pendingRefund.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className="text-[11px] text-amber-600/80 mt-0.5">{stats.inbox} return{stats.inbox !== 1 ? 's' : ''} waiting</div>
            </div>
            <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-xl px-4 py-3.5 shadow-sm">
              <div className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Pending Credits</div>
              <div className="text-xl font-bold text-emerald-800 font-heading mt-0.5">${stats.pendingCredit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className="text-[11px] text-emerald-600/80 mt-0.5">store credit / exchange</div>
            </div>
            <div className="bg-sky-50/80 border border-sky-200/60 rounded-xl px-4 py-3.5 shadow-sm">
              <div className="text-[10px] text-sky-600 uppercase tracking-wider font-semibold">In Transit</div>
              <div className="text-xl font-bold text-sky-800 font-heading mt-0.5">${stats.inTransitValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className="text-[11px] text-sky-600/80 mt-0.5">{stats.shipping} return{stats.shipping !== 1 ? 's' : ''} shipping</div>
            </div>
            <div className="bg-[var(--muted)] border border-[var(--border)] rounded-xl px-4 py-3.5 shadow-sm">
              <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">This Week</div>
              <div className="text-xl font-bold text-[var(--foreground)] font-heading mt-0.5">{stats.processedThisWeek}</div>
              <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">processed in 7 days</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex overflow-x-auto no-scrollbar -mb-px">
            {TABS.map(t => {
              const count = t.key === 'all' ? stats.all : (stats[t.key as keyof Stats] || 0);
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); setTypeFilter('all'); }}
                  className={`px-3 sm:px-4 py-3.5 text-sm whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                    active ? 'border-[var(--primary)] text-[var(--foreground)] font-semibold' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}>
                  {t.label}
                  {typeof count === 'number' && count > 0 && (
                    <span className={`text-[11px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-semibold ${
                      t.key === 'inbox' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : t.key === 'old' ? 'bg-orange-100 text-orange-600' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Type filter */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0 pl-4">
            {['all', 'refund', 'credit', 'exchange'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${typeFilter === t ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}>
                {t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-[var(--muted-foreground)] font-medium">{search ? `Search: "${search}"` : TAB_DESC[tab]}</p>
          <span className="text-sm text-[var(--muted-foreground)]">{total} result{total !== 1 ? 's' : ''}</span>
        </div>

        {loading && <div className="text-center py-20 text-[var(--muted-foreground)] text-sm">Loading...</div>}

        {!loading && filteredReturns.length === 0 && (
          <div className="text-center py-20 text-[var(--muted-foreground)]">
            <div className="text-3xl mb-2">{search ? '🔍' : '✓'}</div>
            <div className="text-sm">{search ? 'No results' : tab === 'inbox' ? 'No returns need action right now' : 'Nothing here'}</div>
          </div>
        )}

        {/* ─── Desktop Table ─── */}
        {!loading && filteredReturns.length > 0 && (
          <div className="hidden md:block bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                  <th onClick={() => toggleSort('order_number')} className="pl-4 pr-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none text-left w-[90px]">Order{sort.key === 'order_number' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('customer_name')} className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none text-left">Customer{sort.key === 'customer_name' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('item_count')} className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none text-center w-[50px]">Qty{sort.key === 'item_count' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('subtotal')} className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none text-right w-[100px]">Return ${sort.key === 'subtotal' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('type')} className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none text-center w-[80px]">Type{sort.key === 'type' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('status')} className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none text-center w-[100px]">{tab === 'shipping' ? 'Last Scan' : 'Status'}{sort.key === 'status' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th onClick={() => toggleSort('return_requested')} className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider cursor-pointer hover:text-[var(--foreground)] select-none text-left w-[110px]">{tab === 'shipping' ? 'Shipped' : 'Requested'}{sort.key === 'return_requested' && <span className="ml-0.5">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</th>
                  <th className="px-2 pr-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left">{tab === 'shipping' ? 'In Transit' : 'Reason'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredReturns.map(r => {
                  const tb = typeBadge(r.type);
                  const si = statusInfo(r);
                  const daysAgo = r.return_requested ? Math.round((new Date().getTime() - new Date(r.return_requested).getTime()) / 86400000) : null;
                  const shippedDate = r.customer_shipped || r.return_requested;
                  const daysInTransit = shippedDate ? Math.round((new Date().getTime() - new Date(shippedDate).getTime()) / 86400000) : null;
                  return (
                    <tr key={r.id} onClick={() => { setSelected(r); setShowReject(false); setRejectReason(''); }}
                      className={`cursor-pointer transition-colors hover:bg-[var(--accent)]/40 ${r.is_flagged ? 'bg-red-50/40' : r.subtotal >= 300 ? 'bg-amber-50/20' : ''}`}>
                      <td className="pl-4 pr-2 py-3">
                        <div className="text-sm font-semibold text-[var(--foreground)]">{r.order_number}</div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-sm text-[var(--foreground)] font-medium">{r.customer_name}</div>
                        {r.is_flagged && <div className="text-[10px] text-red-500 font-semibold">⚠ {r.flag_reason || 'Flagged'}</div>}
                        {r.imported_from === 'redo' && <div className="text-[10px] text-[var(--muted-foreground)] italic">via Redo</div>}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className={`text-sm ${r.item_count >= 3 ? 'font-semibold text-amber-700' : 'text-[var(--foreground)]'}`}>{r.item_count}</span>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className={`text-sm font-semibold ${r.subtotal >= 300 ? 'text-amber-700' : 'text-[var(--foreground)]'}`}>
                          {r.subtotal > 0 ? `$${r.subtotal.toFixed(2)}` : '—'}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${tb.bg}`}>{tb.label}</span></td>
                      <td className="px-2 py-3 text-center"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-lg ${si.cls}`}>{si.text}</span></td>
                      <td className="px-2 py-3">
                        {tab === 'shipping' ? (
                          <>
                            <div className="text-sm text-[var(--foreground)]">{fmtShort(r.customer_shipped || r.return_requested)}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm text-[var(--foreground)]">{fmtShort(r.return_requested)}</div>
                            {daysAgo !== null && daysAgo > 0 && <div className={`text-[10px] ${daysAgo > 14 ? 'text-red-500' : daysAgo > 7 ? 'text-amber-500' : 'text-[var(--muted-foreground)]'}`}>{daysAgo}d ago</div>}
                          </>
                        )}
                      </td>
                      <td className="px-2 pr-4 py-3 text-xs max-w-[160px]">
                        {tab === 'shipping' ? (
                          <span className={`font-medium ${daysInTransit !== null && daysInTransit > 14 ? 'text-red-500' : daysInTransit !== null && daysInTransit > 7 ? 'text-amber-600' : 'text-[var(--muted-foreground)]'}`}>
                            {daysInTransit !== null ? `${daysInTransit}d` : '—'}
                          </span>
                        ) : (
                          <span className="text-[var(--muted-foreground)] truncate">{displayReason(r)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Mobile Cards ─── */}
        {!loading && filteredReturns.length > 0 && (
          <div className="md:hidden flex flex-col gap-2">
            {filteredReturns.map(r => {
              const tb = typeBadge(r.type);
              const si = statusInfo(r);
              const daysAgo = r.return_requested ? Math.round((new Date().getTime() - new Date(r.return_requested).getTime()) / 86400000) : null;
              const shippedDate = r.customer_shipped || r.return_requested;
              const daysInTransit = shippedDate ? Math.round((new Date().getTime() - new Date(shippedDate).getTime()) / 86400000) : null;
              return (
                <div key={r.id} onClick={() => { setSelected(r); setShowReject(false); setRejectReason(''); }}
                  className={`p-4 bg-[var(--card)] rounded-xl active:bg-[var(--accent)] shadow-sm ${r.is_flagged ? 'border-2 border-red-200' : 'border border-[var(--border)]'}`}>
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-semibold text-[var(--foreground)]">{r.customer_name}</div>
                      <div className="text-sm text-[var(--muted-foreground)]">{r.order_number} · {r.item_count} item{r.item_count > 1 ? 's' : ''}</div>
                    </div>
                    <div className={`text-base font-bold ${r.subtotal >= 300 ? 'text-amber-700' : 'text-[var(--foreground)]'}`}>
                      {r.subtotal > 0 ? `$${r.subtotal.toFixed(2)}` : '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${tb.bg}`}>{tb.label}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-lg ${si.cls}`}>{si.text}</span>
                    {tab === 'shipping' && daysInTransit !== null ? (
                      <span className={`text-[10px] font-medium ${daysInTransit > 14 ? 'text-red-500' : daysInTransit > 7 ? 'text-amber-500' : 'text-[var(--muted-foreground)]'}`}>{daysInTransit}d in transit</span>
                    ) : (
                      <>
                        <span className="text-[10px] text-[var(--muted-foreground)]">{fmtShort(r.return_requested)}</span>
                        {daysAgo !== null && daysAgo > 7 && <span className={`text-[10px] ${daysAgo > 14 ? 'text-red-400' : 'text-amber-400'}`}>{daysAgo}d ago</span>}
                      </>
                    )}
                  </div>
                  {r.reason && <div className="text-xs text-[var(--muted-foreground)] mt-1.5 truncate">{r.reason}</div>}
                  {r.is_flagged && <div className="text-[10px] text-red-500 font-semibold mt-1">⚠ {r.flag_reason || 'Flagged'}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Pagination ─── */}
        {!loading && total > perPage && (
          <div className="flex items-center justify-between mt-4 mb-8">
            <span className="text-sm text-[var(--muted-foreground)]">{(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className={`px-2.5 py-1.5 text-sm rounded-lg border ${page <= 1 ? 'border-[var(--border)] text-[var(--border)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}>‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pn: number;
                if (totalPages <= 5) pn = i + 1;
                else if (page <= 3) pn = i + 1;
                else if (page >= totalPages - 2) pn = totalPages - 4 + i;
                else pn = page - 2 + i;
                return (
                  <button key={pn} onClick={() => setPage(pn)}
                    className={`w-8 h-8 text-sm rounded-lg ${page === pn ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}>{pn}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className={`px-2.5 py-1.5 text-sm rounded-lg border ${page >= totalPages ? 'border-[var(--border)] text-[var(--border)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Detail Panel ─── */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setSelected(null); setShowReject(false); }} />
          <div className="hidden md:block absolute top-0 right-0 h-full w-[480px] bg-[var(--card)] shadow-2xl overflow-y-auto animate-slide-right">
            <Detail r={selected} showReject={showReject} setShowReject={setShowReject} rejectReason={rejectReason} setRejectReason={setRejectReason} doAction={doAction} onClose={() => { setSelected(null); setShowReject(false); }} />
          </div>
          <div className="md:hidden absolute bottom-0 left-0 right-0 bg-[var(--card)] rounded-t-2xl max-h-[88vh] overflow-y-auto shadow-2xl animate-slide-up">
            <div className="text-center pt-3 pb-1"><div className="w-9 h-1 bg-[var(--border)] rounded mx-auto" /></div>
            <Detail r={selected} showReject={showReject} setShowReject={setShowReject} rejectReason={rejectReason} setRejectReason={setRejectReason} doAction={doAction} onClose={() => { setSelected(null); setShowReject(false); }} />
          </div>
        </div>
      )}

      {/* ─── Confirm Modal ─── */}
      {confirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="relative bg-[var(--card)] rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="text-4xl mb-4">{confirm.action === 'credit' ? '💚' : confirm.action === 'refund' ? '💰' : confirm.action === 'reject' ? '⚠️' : '📦'}</div>
            <div className="text-lg font-bold text-[var(--foreground)] mb-2 font-heading">Are you sure?</div>
            <div className="text-base text-[var(--muted-foreground)] mb-2">{confirm.label}</div>
            {confirm.action === 'credit' && <p className="text-xs text-[var(--muted-foreground)] mb-4">This will issue real store credit to the customer&apos;s Shopify account.</p>}
            {confirm.action === 'refund' && <p className="text-xs text-[var(--muted-foreground)] mb-4">Order will be refunded to the customer&apos;s original payment method.</p>}
            {confirm.imported && (
              <label className="flex items-center gap-2 justify-center mb-4 cursor-pointer">
                <input type="checkbox" checked={forceShopify} onChange={e => setForceShopify(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-xs text-amber-600 font-medium">Execute in Shopify (Redo import)</span>
              </label>
            )}
            <div className="flex flex-col gap-3 mt-4">
              <button onClick={confirmAction} disabled={busy}
                className={`w-full py-4 rounded-xl text-base font-semibold text-white ${confirm.action === 'reject' ? 'bg-red-600' : confirm.action === 'credit' ? 'bg-emerald-600' : 'bg-[var(--primary)]'} ${busy ? 'opacity-50' : ''}`}>
                {busy ? 'Processing...' : 'Yes, Confirm'}
              </button>
              <button onClick={() => setConfirm(null)} className="w-full py-3 text-[var(--muted-foreground)] text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
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

  // Editable fields
  const [editingValue, setEditingValue] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editingReason, setEditingReason] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [localSubtotal, setLocalSubtotal] = useState(r.subtotal);
  const [localReason, setLocalReason] = useState(r.reason);

  const saveField = async (fields: Record<string, unknown>) => {
    setSaving(true);
    await fetch('/api/returns/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, ...fields }) });
    if (fields.subtotal !== undefined) { setLocalSubtotal(fields.subtotal as number); setEditingValue(false); }
    if (fields.reason !== undefined) { setLocalReason(fields.reason as string); setEditingReason(false); }
    setSaving(false);
  };

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
  const orderItemCount = order?.lineItems?.reduce((s, i) => s + i.quantity, 0) || 0;
  const isPartialReturn = orderItemCount > 0 && r.item_count < orderItemCount;

  // Actual fee: 5% restocking on refunds, $0 on credit/exchange (from fees.ts logic)
  const restockPct = r.type === 'refund' ? 5 : 0;
  const restockFee = r.type === 'refund' ? Math.round((localSubtotal || 0) * 0.05 * 100) / 100 : 0;
  
  // Returned items value vs kept items value (for partial returns)
  const keptItemsValue = orderTotal > 0 && localSubtotal > 0 && isPartialReturn ? orderTotal - localSubtotal : 0;

  // Intelligence calculations
  const now = new Date();
  const deliveredDate = ful?.deliveredAt ? new Date(ful.deliveredAt) : null;
  const requestedDate = r.return_requested ? new Date(r.return_requested) : null;
  const daysInInbox = r.delivered_to_us ? Math.max(0, Math.round((now.getTime() - new Date(r.delivered_to_us).getTime()) / 86400000)) : null;
  const daysToReturn = deliveredDate && requestedDate ? Math.round((requestedDate.getTime() - deliveredDate.getTime()) / 86400000) : null;
  const returnWindowDays = r.type === 'refund' ? 7 : 14;
  const daysInWindow = daysToReturn;
  const withinWindow = daysInWindow !== null && daysInWindow >= 0 ? daysInWindow <= returnWindowDays : null;
  const isNewCustomer = cust?.orderCount === '1';
  const hasDiscount = (order?.discountCodes?.length || 0) > 0;
  const customerSpent = cust ? parseFloat(cust.totalSpent || '0') : 0;
  const returnPctOfLTV = customerSpent > 0 ? ((localSubtotal || 0) / customerSpent * 100) : null;

  // Risk signals
  const risks: { label: string; level: 'info' | 'warn' | 'danger' }[] = [];
  if (isNewCustomer) risks.push({ label: 'New customer — 1st order on file', level: 'info' });
  if (history && history.returnsIn90Days >= 3) risks.push({ label: `${history.returnsIn90Days} returns in 90 days`, level: 'danger' });
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
          <div className="text-lg font-bold text-[var(--foreground)] font-heading">{r.customer_name}</div>
          <div className="text-sm text-[var(--muted-foreground)]">
            {r.order_number} · Ordered {order ? fmtShort(order.createdAt) : '...'}
            {shopifyLink && <a href={shopifyLink} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-blue-500 hover:text-blue-600">↗</a>}
          </div>
          {r.return_requested && <div className="text-xs text-[var(--muted-foreground)]">Return created {fmtShort(r.return_requested)}</div>}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {order?.channel && <span className="text-[10px] bg-[var(--muted)] text-[var(--muted-foreground)] px-1.5 py-0.5 rounded-md">{order.channel}</span>}
            <span className="text-[10px] bg-[var(--muted)] text-[var(--muted-foreground)] px-1.5 py-0.5 rounded-md">via {r.imported_from === 'redo' ? 'Redo' : 'Portal'}</span>
            {daysInInbox !== null && daysInInbox >= 0 && (r.status === 'inbox' || r.status === 'old') && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${daysInInbox > 7 ? 'bg-red-50 text-red-500' : daysInInbox > 3 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {daysInInbox === 0 ? 'Received today' : `Received ${daysInInbox}d ago`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${tb.bg}`}>{tb.label}</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg ${si.cls}`}>{si.text}</span>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] ml-1 transition-colors">✕</button>
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
        <div className="bg-red-50 border border-red-200/80 rounded-xl p-3 mb-3 text-sm">
          <span className="font-semibold text-red-600">⚠ Flagged</span>
          {r.flag_reason && <span className="text-red-600 ml-1">— {r.flag_reason}</span>}
        </div>
      )}

      {/* ── Reason + discount ── */}
      <div className="space-y-1 mb-4">
        <div className="text-xs text-[var(--muted-foreground)]">
          <span className="text-[var(--muted-foreground)]/70">Reason: </span>
          {editingReason ? (
            <span className="inline-flex items-center gap-1">
              <input value={editReason} onChange={e => setEditReason(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveField({ reason: editReason }); if (e.key === 'Escape') setEditingReason(false); }}
                className="text-xs border border-[var(--border)] rounded-md px-1.5 py-0.5 w-48 focus:outline-none focus:border-[var(--ring)] bg-[var(--card)]" autoFocus />
              <button onClick={() => saveField({ reason: editReason })} disabled={saving} className="text-[10px] text-emerald-600">✓</button>
              <button onClick={() => setEditingReason(false)} className="text-[10px] text-[var(--muted-foreground)]">✕</button>
            </span>
          ) : (
            <button onClick={() => { setEditReason(localReason || ''); setEditingReason(true); }} className="hover:underline cursor-pointer">
              {localReason || '—'} <span className="text-[10px] text-[var(--border)] ml-0.5">✎</span>
            </button>
          )}
        </div>
        {order?.discountCodes?.length ? <div className="text-xs text-[var(--muted-foreground)]">Discount: <span className="font-medium text-[var(--foreground)]">{order.discountCodes.join(', ')}</span></div> : null}
        {daysToReturn !== null && daysToReturn >= 0 && <div className="text-xs text-[var(--muted-foreground)]">Returned {daysToReturn} day{daysToReturn !== 1 ? 's' : ''} after delivery {withinWindow !== null && daysInWindow !== null && daysInWindow >= 0 && <span className={withinWindow ? 'text-emerald-500' : 'text-red-500'}>({withinWindow ? `within ${returnWindowDays}d window` : `day ${daysInWindow} — expired`})</span>}</div>}
      </div>

      {/* ── Return Items ── */}
      <div className="mb-4">
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider mb-2 font-semibold">Return Items</div>
        {loadingOrder ? <div className="text-xs text-[var(--muted-foreground)] py-4 text-center">Loading...</div> : (
          <div className="space-y-2">
            {(order?.lineItems || []).map((item, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3">
                <div className="flex gap-3">
                  {item.image && <img src={item.image} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-[var(--muted)]" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--foreground)]">{item.title}</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{item.variant}{item.sku ? ` · ${item.sku}` : ''}</div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-[var(--muted-foreground)]">Retail</span><span className="text-[var(--foreground)]">${parseFloat(item.retailPrice).toFixed(2)}</span></div>
                  {parseFloat(item.discount) > 0 && <div className="flex justify-between text-xs"><span className="text-[var(--muted-foreground)]">Discount</span><span className="text-red-500">-${parseFloat(item.discount).toFixed(2)}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Return Shipping ── */}
      {(r.tracking_number || r.tracking_status || r.delivered_to_us) && (
        <div className="mb-4">
          <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider mb-2 font-semibold">Return Shipping</div>
          <div className="bg-[var(--muted)] rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Status</span><span className={`font-medium ${r.tracking_status === 'Delivered' ? 'text-emerald-600' : 'text-blue-600'}`}>{r.tracking_status || 'Unknown'}</span></div>
            {r.delivered_to_us && <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Received</span><span className="text-[var(--foreground)]">{fmtShort(r.delivered_to_us)}</span></div>}
            {r.tracking_number && <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Tracking</span><span className="text-[var(--muted-foreground)] text-xs truncate max-w-[200px]">{r.tracking_number}</span></div>}
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      {order && (
        <div className="mb-4 bg-[var(--muted)] rounded-xl p-3">
          <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider mb-2 font-semibold">Summary</div>
          <div className="space-y-1.5 text-sm">
            {/* Order info */}
            <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Order total ({orderItemCount} item{orderItemCount !== 1 ? 's' : ''})</span><span className="text-[var(--foreground)]">${orderTotal.toFixed(2)}</span></div>
            {discount > 0 && <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Discount applied</span><span className="text-red-500">-${discount.toFixed(2)}</span></div>}
            
            {/* Partial return breakdown */}
            {isPartialReturn && (
              <>
                <div className="pt-1.5 mt-1.5 border-t border-[var(--border)]" />
                <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Returning {r.item_count} of {orderItemCount} items</span><span className="text-[var(--foreground)]">${(localSubtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Keeping {orderItemCount - r.item_count} item{orderItemCount - r.item_count !== 1 ? 's' : ''}</span><span className="text-[var(--muted-foreground)]">${keptItemsValue.toFixed(2)}</span></div>
              </>
            )}

            {/* Restocking fee */}
            {restockFee > 0 && (
              <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Restocking fee ({restockPct}%)</span><span className="text-red-500">-${restockFee.toFixed(2)}</span></div>
            )}
            {r.type !== 'refund' && (
              <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Restocking fee</span><span className="text-emerald-600">Free (store credit)</span></div>
            )}

            {/* Store credit bonus */}
            {r.bonus_amount > 0 && (
              <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Store credit bonus (5%)</span><span className="text-emerald-600">+${r.bonus_amount.toFixed(2)}</span></div>
            )}

            {/* Return value */}
            <div className="flex justify-between items-center pt-1.5 border-t border-[var(--border)]">
              <span className="text-[var(--foreground)] font-semibold">Return value</span>
              {editingValue ? (
                <div className="flex items-center gap-1">
                  <span className="text-[var(--foreground)] font-bold">$</span>
                  <input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveField({ subtotal: parseFloat(editValue) || 0 }); if (e.key === 'Escape') setEditingValue(false); }}
                    className="w-20 text-right text-sm font-bold text-[var(--foreground)] border border-[var(--border)] rounded-md px-1.5 py-0.5 focus:outline-none focus:border-[var(--ring)] bg-[var(--card)]" autoFocus />
                  <button onClick={() => saveField({ subtotal: parseFloat(editValue) || 0 })} disabled={saving} className="text-[10px] text-emerald-600 font-medium">✓</button>
                  <button onClick={() => setEditingValue(false)} className="text-[10px] text-[var(--muted-foreground)]">✕</button>
                </div>
              ) : (
                <button onClick={() => { setEditValue((localSubtotal || 0).toFixed(2)); setEditingValue(true); }} className="text-[var(--foreground)] font-bold hover:underline cursor-pointer">${(localSubtotal || 0).toFixed(2)} <span className="text-[10px] text-[var(--border)] ml-0.5">✎</span></button>
              )}
            </div>

            {/* Net refund after fee */}
            {restockFee > 0 && (
              <div className="flex justify-between"><span className="text-[var(--foreground)] font-medium">Net refund after fee</span><span className="text-[var(--foreground)] font-semibold">${((localSubtotal || 0) - restockFee).toFixed(2)}</span></div>
            )}

            {/* Return type label */}
            <div className="text-[10px] text-[var(--muted-foreground)] text-center pt-1">
              {r.type === 'refund' ? 'Refund to original payment method' : r.type === 'credit' ? 'Issued as store credit' : 'Exchange'}
            </div>
          </div>
        </div>
      )}

      {/* ── Customer ── */}
      {cust && (
        <div className="mb-4">
          <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider mb-2 font-semibold">Customer</div>
          <div className="bg-[var(--muted)] rounded-xl p-3 text-sm space-y-1">
            <div className="font-medium text-[var(--foreground)]">{cust.name}</div>
            <div className="text-[var(--muted-foreground)]">{cust.email}</div>
            {cust.phone && <div className="text-[var(--muted-foreground)]">{cust.phone}</div>}
            {addr && <div className="text-[var(--muted-foreground)] text-xs pt-1">{addr.address1}{addr.address2 ? `, ${addr.address2}` : ''}<br/>{addr.city}, {addr.provinceCode} {addr.zip}</div>}
            <div className="text-xs text-[var(--muted-foreground)] pt-1.5 border-t border-[var(--border)] flex gap-3 flex-wrap">
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
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider mb-2 font-semibold">Timeline</div>
        <div className="space-y-0">
          {(() => {
            const events: { date: string; label: string; color: string; detail?: string }[] = [];
            if (order?.createdAt) events.push({ date: order.createdAt, label: 'Order placed', color: 'bg-stone-300', detail: `${order.channel || 'Online Store'} · $${parseFloat(order.total || '0').toFixed(2)}` });
            if (ful?.shippedAt) events.push({ date: ful.shippedAt, label: 'Order shipped', color: 'bg-blue-300', detail: ful.tracking ? `${ful.tracking.company} ${ful.tracking.number}` : undefined });
            if (ful?.deliveredAt) events.push({ date: ful.deliveredAt, label: 'Order delivered to customer', color: 'bg-blue-400' });
            if (r.return_requested) events.push({ date: r.return_requested, label: 'Return requested', color: 'bg-amber-400', detail: localReason || undefined });
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
          <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider mb-2 font-semibold">Outbound Shipping</div>
          <div className="bg-[var(--muted)] rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Status</span><span className={`font-medium ${ful.deliveredAt ? 'text-emerald-600' : 'text-blue-600'}`}>{ful.deliveredAt ? 'Delivered' : ful.status}</span></div>
            {ful.deliveredAt && <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Delivered</span><span className="text-[var(--foreground)]">{fmtShort(ful.deliveredAt)}</span></div>}
            {ful.tracking && <div className="flex justify-between"><span className="text-[var(--muted-foreground)]">Tracking</span><a href={ful.tracking.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs truncate max-w-[200px]">{ful.tracking.company} {ful.tracking.number}</a></div>}
          </div>
          {ful.events && ful.events.length > 0 && (
            <TrackingHistory events={ful.events} />
          )}
        </div>
      )}

      {/* ── Notes ── */}
      <div className="mb-5">
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider mb-2 font-semibold">Notes</div>
        {notes.length > 0 && (
          <div className="space-y-2 mb-3">
            {notes.map(n => (
              <div key={n.id} className="bg-amber-50/80 border border-amber-100 rounded-xl p-2.5">
                <div className="text-xs text-[var(--foreground)]">{n.detail}</div>
                <div className="text-[10px] text-[var(--muted-foreground)] mt-1">{fmt(n.event_date)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveNote()}
            placeholder="Add a note..." className="flex-1 text-sm px-3 py-2 border border-[var(--border)] rounded-xl focus:outline-none focus:border-[var(--ring)] bg-[var(--card)]" />
          <button onClick={saveNote} disabled={savingNote || !newNote.trim()}
            className={`px-3 py-2 text-xs font-medium rounded-xl ${newNote.trim() ? 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90' : 'bg-[var(--muted)] text-[var(--border)]'} transition-all`}>
            {savingNote ? '...' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Actions ── */}
      {(r.status === 'inbox' || r.status === 'old') && !showReject && (
        <div className="flex flex-col gap-2.5 mb-5">
          {r.type === 'credit' || r.type === 'exchange' ? (
            <button onClick={() => doAction(r.id, 'credit', `Issue $${(localSubtotal || 0).toFixed(2)} store credit to ${r.customer_name}?`, localSubtotal, undefined, r.imported_from === 'redo')}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl text-base font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm">
              Issue Credit{localSubtotal > 0 ? ` · $${localSubtotal.toFixed(2)}` : ''}
            </button>
          ) : (
            <button onClick={() => doAction(r.id, 'refund', `Refund $${(localSubtotal || 0).toFixed(2)} to ${r.customer_name}?`, localSubtotal, undefined, r.imported_from === 'redo')}
              className="w-full py-4 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-base font-semibold hover:opacity-90 active:opacity-80 transition-all shadow-sm">
              Approve Refund{localSubtotal > 0 ? ` · $${localSubtotal.toFixed(2)}` : ''}
            </button>
          )}
          <button onClick={() => setShowReject(true)} className="w-full py-3 bg-[var(--card)] text-red-500 border border-red-200/80 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">Reject</button>
        </div>
      )}

      {showReject && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-[var(--foreground)] mb-3 font-heading">Rejection Reason</div>
          <div className="flex flex-col gap-1.5">
            {REJECT_REASONS.map(reason => (
              <button key={reason} onClick={() => setRejectReason(reason)}
                className={`p-3 rounded-xl text-left text-sm ${rejectReason === reason ? 'bg-red-50 border-2 border-red-300 text-red-700 font-semibold' : 'bg-[var(--muted)] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}>
                {reason}
              </button>
            ))}
          </div>
          {rejectReason && <button onClick={() => doAction(r.id, 'reject', `Reject return from ${r.customer_name}?`, undefined, rejectReason)} className="w-full mt-4 py-4 bg-red-600 text-white rounded-xl text-sm font-semibold shadow-sm">Reject — {rejectReason}</button>}
          <button onClick={() => { setShowReject(false); setRejectReason(''); }} className="w-full mt-2 py-3 text-[var(--muted-foreground)] text-sm">Cancel</button>
        </div>
      )}

      {r.status === 'shipping' && (
        <button onClick={() => doAction(r.id, 'received', `Mark as received from ${r.customer_name}?`)}
          className="w-full py-4 bg-[var(--card)] border-2 border-[var(--border)] text-[var(--foreground)] rounded-xl text-base font-semibold hover:bg-[var(--muted)] transition-colors mb-5">Mark as Received</button>
      )}

      {r.status === 'done' && (
        <div className={`rounded-xl p-4 text-center mb-5 border ${r.outcome === 'rejected' ? 'bg-red-50 border-red-100' : r.outcome === 'lost' ? 'bg-purple-50 border-purple-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <div className={`text-sm font-semibold ${r.outcome === 'rejected' ? 'text-red-600' : r.outcome === 'lost' ? 'text-purple-600' : 'text-emerald-600'}`}>
            {r.outcome === 'credit' && `Credit Issued${r.final_amount > 0 ? ` · $${r.final_amount.toFixed(2)}` : ''}`}
            {r.outcome === 'refund' && `Refunded${r.final_amount > 0 ? ` · $${r.final_amount.toFixed(2)}` : ''}`}
            {r.outcome === 'rejected' && `Rejected${r.reject_reason ? ` — ${r.reject_reason}` : ''}`}
            {r.outcome === 'lost' && 'Lost in Transit — 45+ days with no delivery'}
          </div>
          {r.processed_at && <div className="text-xs text-[var(--muted-foreground)] mt-1">{fmt(r.processed_at)}</div>}
        </div>
      )}

      {order?.gateway && (
        <div className="text-[11px] text-[var(--muted-foreground)] text-center">
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
        {!last && <div className="w-px h-5 bg-[var(--border)] mt-0.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[var(--foreground)] font-medium">{label}</div>
        <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{fmtTime(date)}</div>
        {detail && <div className="text-[10px] text-[var(--muted-foreground)] truncate">{detail}</div>}
      </div>
    </div>
  );
}

function TrackingHistory({ events }: { events: { date: string; status: string; message: string; location: string | null }[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...events].reverse();
  const shown = expanded ? sorted : sorted.slice(0, 3);

  const statusColor = (s: string) => {
    if (s === 'DELIVERED') return 'bg-emerald-400';
    if (s === 'OUT_FOR_DELIVERY') return 'bg-emerald-300';
    if (s === 'IN_TRANSIT') return 'bg-blue-300';
    return 'bg-stone-300';
  };

  return (
    <div className="mt-2 border border-[var(--border)] rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-3 py-2 bg-[var(--muted)] text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider text-left hover:bg-[var(--accent)] flex justify-between items-center transition-colors">
        <span>Carrier Scans ({events.length})</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      <div className="px-3 py-2 space-y-0">
        {shown.map((e, i) => (
          <div key={i} className="flex items-start gap-2.5 py-1">
            <div className="flex flex-col items-center flex-shrink-0 pt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor(e.status)}`} />
              {i < shown.length - 1 && <div className="w-px h-4 bg-[var(--border)] mt-0.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-[var(--foreground)]">{e.message}</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">{fmtTime(e.date)}{e.location ? ` — ${e.location}` : ''}</div>
            </div>
          </div>
        ))}
      </div>
      {events.length > 3 && !expanded && (
        <button onClick={() => setExpanded(true)} className="w-full px-3 py-1.5 text-[10px] text-blue-500 hover:text-blue-600 text-center border-t border-[var(--border)]">
          Show all {events.length} events
        </button>
      )}
    </div>
  );
}
