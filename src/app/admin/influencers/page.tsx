'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';

/* ─── Types ─── */

type Role = 'admin' | 'intern';

type Product = { title?: string; variantId?: string; price?: number; quantity?: number; sku?: string; image?: string };
type ShippingOverride = {
  firstName?: string; lastName?: string; address1?: string; address2?: string;
  city?: string; province?: string; zip?: string; country?: string; phone?: string;
};
type ScrapedData = {
  username: string; fullName: string; biography: string;
  followersCount: number; followsCount: number; postsCount: number;
  isVerified: boolean; isBusinessAccount: boolean;
  profilePicUrl: string; externalUrl: string; engagementRate: number;
};

type Collab = {
  id: string;
  influencer_id: string;
  collab_number: number;
  status: string;
  status_changed_at: string;
  deal_type: string | null;
  payment_amount: number;
  payment_method: string | null;
  deliverables: string | null;
  discount_code: string | null;
  special_instructions: string | null;
  products: Product[] | null;
  total_gift_value: number | null;
  shipping_override: ShippingOverride | null;
  shopify_draft_order_id: string | null;
  shopify_order_name: string | null;
  shopify_order_status: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  shipped_at: string | null;
  content_urls: string[] | null;
  content_posted_date: string | null;
  content_types_posted: string[] | null;
  post_reach: number | null;
  post_impressions: number | null;
  post_engagement: number | null;
  admin_notes: string | null;
  intern_notes: string | null;
  dm_context: string | null;
  counter_note: string | null;
  declined_reason: string | null;
  expected_post_date: string | null;
  created_at: string;
};

type Influencer = {
  id: string;
  instagram_handle: string;
  full_name: string | null;
  email: string | null;
  profile_url: string | null;
  follower_count: number | null;
  engagement_rate: number | null;
  niche_tags: string[] | null;
  content_types: string[] | null;
  bio: string | null;
  is_verified: boolean;
  preferred_sizes: string[] | null;
  preferred_products: string[] | null;
  shipping_name: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  shipping_phone: string | null;
  scraped_data: ScrapedData | null;
  scraped_at: string | null;
  person_notes: string | null;
  already_contacted: boolean;
  created_by: string | null;
  created_at: string;
  // Rollup
  collab_count: number;
  latest_status: string;
  latest_collab: Collab | null;
  active_collab: Collab | null;
  collabs: Collab[];
};

type Stats = {
  pipeline: Record<string, number>;
  activeCollabs: number;
  thisMonth: { shipped: number; giftedValue: number; posts: number };
  allTime: { totalGifted: number; totalInfluencers: number; totalCollabs: number };
};

type NoteRow = { id: string; user_name: string; user_role: string; note_text: string; created_at: string; collab_id: string | null };

/* ─── Constants ─── */

const NICHES = ['Orthodox/Frum', 'LDS/Mormon', 'Modest Fashion General', 'Hijabi/Muslim Modest', 'Other'];
const CONTENT_TYPES = ['Reels', 'Stories', 'Static Posts', 'TikTok'];

const STATUS_META: Record<string, { label: string; bg: string; text: string; border?: string; accent: string; bar: string }> = {
  prospect: { label: 'Prospect', bg: 'bg-stone-200', text: 'text-stone-700', border: 'border-stone-300', accent: 'stone-500', bar: 'bg-stone-400' },
  outreach: { label: 'Outreach', bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-300', accent: 'sky-600', bar: 'bg-sky-500' },
  negotiating: { label: 'Negotiating', bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-400', accent: 'amber-600', bar: 'bg-amber-500' },
  approved: { label: 'Approved', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', accent: 'emerald-600', bar: 'bg-emerald-500' },
  shipped: { label: 'Shipped', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', accent: 'blue-600', bar: 'bg-blue-500' },
  posted: { label: '✓ Posted', bg: 'bg-emerald-200', text: 'text-emerald-900', border: 'border-emerald-400', accent: 'emerald-700', bar: 'bg-emerald-600' },
  watchlist: { label: 'Watchlist', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', accent: 'purple-600', bar: 'bg-purple-500' },
  passed: { label: 'Passed', bg: 'bg-stone-100', text: 'text-stone-400', border: 'border-stone-200', accent: 'stone-400', bar: 'bg-stone-300' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'prospect', label: 'Prospects' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'negotiating', label: 'Negotiating' },
  { key: 'approved', label: 'Approved' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'posted', label: 'Posted' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'passed', label: 'Passed' },
];

/* ─── Formatters ─── */

const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtDateShort = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const followersTone = (n: number | null): string => {
  if (n === null || n === undefined) return 'text-red-500';
  if (n < 2000) return 'text-amber-600';
  return 'text-[var(--foreground)]';
};
const EMPTY_PER_FILTER: Record<string, string> = {
  prospect: 'No prospects yet. Click + New Influencer to add one.',
  outreach: 'No active outreach. Start reaching out to prospects!',
  negotiating: 'No negotiations in progress.',
  approved: 'No collabs approved yet.',
  shipped: 'Nothing shipped this period.',
  posted: 'No content posted yet.',
  watchlist: 'No one on the watchlist.',
  passed: 'No passed records.',
};
const fmtFollowers = (n: number | null): string => {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
};
const engagementTone = (e: number | null): string => {
  if (e === null || e === undefined) return 'text-[var(--muted-foreground)]';
  if (e >= 3.5) return 'text-emerald-700';
  if (e >= 3) return 'text-amber-700';
  return 'text-red-600';
};
const igUrl = (handle: string) => `https://instagram.com/${handle.replace(/^@/, '')}`;
const DEAL_LABELS: Record<string, string> = {
  gifted_only: 'Gifted', gifted_paid: 'Gifted + Paid', paid_only: 'Paid', affiliate: 'Affiliate',
};
const formatDealType = (t: string | null) => t ? (DEAL_LABELS[t] || t) : null;

function StatusBadge({ status, large }: { status: string; large?: boolean }) {
  const m = STATUS_META[status] || STATUS_META.prospect;
  const size = large ? 'text-[11px] px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return <span className={`${size} font-semibold rounded-lg border ${m.bg} ${m.text} ${m.border || ''}`}>{m.label}</span>;
}

function SortTh({ label, k, sortKey, sortDir, onClick, align, w }: {
  label: string; k: string; sortKey: string; sortDir: 'asc' | 'desc';
  onClick: (k: string) => void; align: 'left' | 'right' | 'center'; w: string;
}) {
  const active = sortKey === k;
  return (
    <th onClick={() => onClick(k)}
      className={`px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-[var(--foreground)] transition-colors ${w} text-${align} ${active ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
      <span className="inline-flex items-center gap-1">{label}{active && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}</span>
    </th>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-1.5">{label}</div>
      {children}
    </div>
  );
}

const STAT_TONES: Record<string, { border: string; value: string }> = {
  sky: { border: 'border-l-sky-500', value: 'text-sky-700' },
  stone: { border: 'border-l-stone-400', value: 'text-stone-700' },
  amber: { border: 'border-l-amber-500', value: 'text-amber-700' },
  blue: { border: 'border-l-blue-600', value: 'text-blue-700' },
  emerald: { border: 'border-l-emerald-500', value: 'text-emerald-700' },
  purple: { border: 'border-l-purple-500', value: 'text-purple-700' },
};

function StatCard({ label, value, sub, tone, formula }: { label: string; value: string; sub?: string; tone: keyof typeof STAT_TONES; formula?: string }) {
  const t = STAT_TONES[tone];
  return (
    <div className={`bg-[var(--card)] border border-[var(--border)] border-l-4 ${t.border} rounded-xl p-4 shadow-sm`} title={formula}>
      <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">{label}</p>
      <p className={`font-heading text-2xl font-semibold mt-1 ${t.value}`}>{value}</p>
      {sub && <p className="text-[11px] mt-1 text-[var(--muted-foreground)]">{sub}</p>}
    </div>
  );
}

/* ─── Main Page ─── */

export default function InfluencersPage() {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');

  const [rows, setRows] = useState<Influencer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState('');
  const [sortKey, setSortKey] = useState<string>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  useEffect(() => {
    fetch('/api/auth', { method: 'GET' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.role) { setRole(d.role); setAuthed(true); } })
      .catch(() => {});
  }, []);

  const login = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (!res.ok) { setPwErr('Wrong password'); return; }
    const d = await res.json();
    setRole(d.role); setAuthed(true); setPwErr('');
  };

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filter !== 'all') p.set('collab_status', filter);
    const [r, s] = await Promise.all([
      fetch(`/api/influencers?${p}`).then(r => r.json()),
      fetch('/api/influencers/stats').then(r => r.json()),
    ]);
    setRows(r.influencers || []);
    setStats(s);
    setLoading(false);
  }, [filter]);

  useEffect(() => { if (authed) fetchAll(); }, [authed, fetchAll]);

  const selected = useMemo(() => rows.find(r => r.id === selectedId) || null, [rows, selectedId]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.instagram_handle, r.full_name, r.email, ...(r.niche_tags || []), r.person_notes, r.bio]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      switch (sortKey) {
        case 'followers': av = a.follower_count || 0; bv = b.follower_count || 0; break;
        case 'engagement': av = a.engagement_rate || 0; bv = b.engagement_rate || 0; break;
        case 'collabs': av = a.collab_count; bv = b.collab_count; break;
        case 'updated':
        default: av = a.active_collab?.status_changed_at || a.created_at; bv = b.active_collab?.status_changed_at || b.created_at;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortKey, sortDir]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-semibold text-[var(--foreground)] tracking-wide">MISS FINCH</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 tracking-widest uppercase">Influencers</p>
          </div>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter password" className="w-full p-4 rounded-xl border border-[var(--border)] text-lg text-center focus:outline-none focus:border-[var(--primary)] bg-[var(--card)]" />
          {pwErr && <p className="text-red-500 text-center text-sm mt-3">{pwErr}</p>}
          <button onClick={login} className="w-full mt-4 p-4 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-base font-semibold hover:opacity-90 transition-opacity">Log In</button>
        </div>
      </div>
    );
  }

  if (!role) return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-sm text-[var(--muted-foreground)]">Loading…</div>;

  const pipeline = stats?.pipeline || {};

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--primary-foreground)] px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}
      <Nav active="influencers" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">Influencer Tracker</h2>

        {/* Stats */}
        {role === 'admin' && (
          <section>
            <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Pipeline</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard tone="amber" label="Needs Action" value={String((pipeline.negotiating || 0) + (pipeline.approved || 0))} sub="negotiating + approved" formula="Collabs Ryan needs to review or move forward." />
              <StatCard tone="sky" label="Active Pipeline" value={String(stats?.activeCollabs || 0)} sub="prospect → approved" formula="All non-posted, non-passed, non-watchlist collabs." />
              <StatCard tone="blue" label="Shipped" value={String(pipeline.shipped || 0)} sub="awaiting content" formula="Shipped, waiting for content to be posted." />
              <StatCard tone="stone" label="Total Collabs" value={String(stats?.allTime.totalCollabs || 0)} sub="all time" formula="Every collab ever created." />
            </div>
          </section>
        )}

        {/* Filter pills */}
        <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-2 overflow-x-auto whitespace-nowrap">
          {FILTERS.map(f => {
            const count = f.key === 'all' ? rows.length : (pipeline[f.key] || 0);
            const sm = STATUS_META[f.key];
            const isActive = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`text-[11px] sm:text-xs tracking-wider uppercase px-3 py-1.5 rounded-md transition-all inline-flex items-center gap-1.5 ${isActive ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-bold shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}>
                {f.label}
                {count > 0 && (
                  <span className={`text-[10px] font-semibold rounded-full min-w-[18px] px-1.5 ${
                    isActive ? 'bg-[var(--primary-foreground)]/20 text-[var(--primary-foreground)]' :
                    sm ? `${sm.bg} ${sm.text}` : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + Add */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-lg">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search handles, names, niches…"
              className="w-full py-2.5 px-4 pl-9 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--ring)]" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-xs">🔍</span>
          </div>
          <button onClick={() => setShowForm(true)}
            className="sm:ml-auto text-[11px] tracking-wider uppercase font-semibold px-3.5 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity inline-flex items-center gap-1.5">
            <span className="text-sm">+</span> New Influencer
          </button>
        </div>

        {/* Table / Cards */}
        {loading ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] text-sm">Loading…</div>
        ) : sortedRows.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">
            <div className="text-3xl mb-2">💌</div>
            <div className="text-sm">
              {search ? `No influencers match "${search}"` :
                filter !== 'all' && EMPTY_PER_FILTER[filter] ? EMPTY_PER_FILTER[filter] :
                'No influencers yet.'}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                    <th className="pl-5 pr-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left">Handle</th>
                    <SortTh label="Followers" k="followers" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" w="w-[90px]" />
                    <SortTh label="Engage" k="engagement" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" w="w-[80px]" />
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[180px]">Niche</th>
                    <SortTh label="Collabs" k="collabs" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="center" w="w-[80px]" />
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-center w-[130px]">Latest</th>
                    <SortTh label="Updated" k="updated" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" w="pr-5 w-[80px]" />
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r, i) => (
                    <tr key={r.id} onClick={() => setSelectedId(r.id)}
                      className={`cursor-pointer hover:bg-[var(--accent)]/40 transition-colors border-t border-[var(--border)] ${i % 2 === 1 ? 'bg-[var(--muted)]/20' : ''}`}>
                      <td className="pl-5 pr-2 py-3">
                        <a href={igUrl(r.instagram_handle)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          title={r.bio || undefined}
                          className="text-sm font-semibold text-[var(--foreground)] hover:text-sky-600 hover:underline">{r.instagram_handle}</a>
                        {r.full_name && <div className="text-[10px] text-[var(--muted-foreground)] truncate max-w-[180px]">{r.full_name}</div>}
                      </td>
                      <td className={`px-2 py-3 text-right text-sm tabular-nums ${followersTone(r.follower_count)}`}>{fmtFollowers(r.follower_count)}</td>
                      <td className={`px-2 py-3 text-right text-sm font-semibold tabular-nums ${engagementTone(r.engagement_rate)}`}>{r.engagement_rate !== null ? `${r.engagement_rate}%` : '—'}</td>
                      <td className="px-2 py-3">
                        {(r.niche_tags || []).length === 0 ? <span className="text-xs text-[var(--muted-foreground)]">—</span> : (
                          <div className="flex flex-wrap gap-1">
                            {(r.niche_tags || []).slice(0, 2).map(n => (
                              <span key={n} className="text-[9px] bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] px-1.5 py-0.5 rounded">{n}</span>
                            ))}
                            {(r.niche_tags || []).length > 2 && <span className="text-[9px] text-[var(--muted-foreground)] self-center">+{(r.niche_tags || []).length - 2}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className="text-xs font-semibold bg-[var(--muted)] text-[var(--foreground)] rounded-full min-w-[22px] inline-block px-2 py-0.5">{r.collab_count}</span>
                      </td>
                      <td className="px-2 py-3 text-center"><StatusBadge status={r.latest_status} /></td>
                      <td className="px-2 pr-5 py-3 text-right text-xs text-[var(--muted-foreground)] tabular-nums">{fmtDateShort(r.active_collab?.status_changed_at || r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden flex flex-col gap-2">
              {sortedRows.map(r => {
                const sm = STATUS_META[r.latest_status] || STATUS_META.prospect;
                return (
                  <div key={r.id} onClick={() => setSelectedId(r.id)}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden active:bg-[var(--accent)] flex">
                    <div className={`w-1 ${sm.bar}`} />
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--foreground)] truncate">{r.instagram_handle}</div>
                          <div className="text-xs">
                            <span className={followersTone(r.follower_count)}>{fmtFollowers(r.follower_count)}</span>
                            <span className="text-[var(--muted-foreground)]"> · </span>
                            <span className={`font-semibold ${engagementTone(r.engagement_rate)}`}>{r.engagement_rate !== null ? `${r.engagement_rate}%` : '—'}</span>
                            <span className="text-[var(--muted-foreground)]"> · {r.collab_count} collab{r.collab_count !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <StatusBadge status={r.latest_status} large />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {showForm && <NewInfluencerForm role={role} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); flash('Created ✓'); fetchAll(); }} />}
      {selected && <InfluencerPanel role={role} influencer={selected} onClose={() => setSelectedId(null)} onRefresh={fetchAll} flash={flash} />}
    </div>
  );
}

/* ─── New Influencer Form ─── */

function NewInfluencerForm({ role, onClose, onCreated }: { role: Role; onClose: () => void; onCreated: () => void }) {
  const [handle, setHandle] = useState('');
  const [followers, setFollowers] = useState('');
  const [engagement, setEngagement] = useState('');
  const [niches, setNiches] = useState<string[]>([]);
  const [content, setContent] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [askedFor, setAskedFor] = useState('');
  const [scraped, setScraped] = useState<ScrapedData | null>(null);
  const [scrapeState, setScrapeState] = useState<'idle' | 'loading' | 'manual' | 'done' | 'fail'>('idle');
  const [saveAsWatchlist, setSaveAsWatchlist] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formProducts, setFormProducts] = useState<Product[]>([]);
  const [duplicateOf, setDuplicateOf] = useState<{ id: string; collab_count: number } | null>(null);

  // Debounced duplicate check
  useEffect(() => {
    const clean = handle.replace(/^@/, '').trim();
    if (!clean) { setDuplicateOf(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/influencers?search=${encodeURIComponent(clean)}`).then(r => r.json());
        const found = (r.influencers || []).find((i: { instagram_handle: string }) => i.instagram_handle.toLowerCase() === `@${clean.toLowerCase()}`);
        setDuplicateOf(found ? { id: found.id, collab_count: found.collab_count } : null);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [handle]);

  const fNum = parseInt(followers) || 0;
  const eNum = parseFloat(engagement) || 0;

  const doScrape = async () => {
    const clean = handle.replace(/^@/, '').trim();
    if (!clean) return;
    setScrapeState('loading');
    try {
      const res = await fetch(`/api/influencers/scrape?handle=${encodeURIComponent(clean)}`);
      const d = await res.json();
      if (d.profile) {
        setScraped(d.profile);
        setFollowers(String(d.profile.followersCount || ''));
        setEngagement(String(d.profile.engagementRate || ''));
        setScrapeState('done');
      } else if (d.manual) setScrapeState('manual');
      else setScrapeState('fail');
    } catch { setScrapeState('fail'); }
  };

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const submit = async () => {
    if (!handle.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/influencers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instagram_handle: handle.trim(),
        profile_url: igUrl(handle),
        follower_count: fNum || null,
        engagement_rate: eNum || null,
        niche_tags: niches,
        content_types: content,
        bio_notes: notes.trim() || null,
        dm_context: askedFor.trim() || null,
        products_to_send: formProducts,
        scraped_data: scraped,
        scraped_at: scraped ? new Date().toISOString() : null,
        full_name: scraped?.fullName,
        created_by: role,
        status: saveAsWatchlist ? 'watchlist' : 'prospect',
      }),
    });
    setSubmitting(false);
    if (res.ok) onCreated();
    else alert('Failed');
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 sm:inset-auto sm:top-[3%] sm:left-1/2 sm:-translate-x-1/2 sm:w-[600px] sm:max-h-[94vh] bg-[var(--card)] sm:rounded-2xl shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-heading text-xl font-semibold text-[var(--foreground)]">New Influencer</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
        </div>

        <div className="p-5 space-y-5">
          <div className="text-[11px] text-[var(--muted-foreground)]">Adding as <b className="text-[var(--foreground)]">{role}</b>. This creates the person + a first collab in <b>prospect</b>.</div>

          <Field label="Instagram Handle *">
            <div className="flex gap-2">
              <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@username"
                className="flex-1 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] focus:outline-none focus:border-[var(--ring)]" />
              {handle.trim() && (
                <a href={igUrl(handle)} target="_blank" rel="noreferrer"
                  className="px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs text-sky-600 hover:bg-[var(--accent)] inline-flex items-center whitespace-nowrap">View ↗</a>
              )}
            </div>
            {handle.trim() && scrapeState === 'idle' && (
              <button onClick={doScrape} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-600 text-white">✨ Fetch Stats</button>
            )}
            {scrapeState === 'loading' && <div className="mt-2 text-xs text-[var(--muted-foreground)]">Scraping…</div>}
            {scrapeState === 'fail' && <div className="mt-2 text-xs text-red-600">Couldn&apos;t fetch. Enter manually.</div>}
            {scrapeState === 'manual' && <div className="mt-2 text-xs text-amber-700">Scraper not configured.</div>}
          </Field>

          {scraped && (
            <div className="bg-sky-50/50 border border-sky-200/70 rounded-xl p-3 flex gap-3">
              {scraped.profilePicUrl && <img src={scraped.profilePicUrl} alt="" className="w-12 h-12 rounded-full object-cover" />}
              <div className="text-xs flex-1 min-w-0">
                <div className="font-semibold">{scraped.fullName || scraped.username}</div>
                <div className="text-[var(--muted-foreground)] line-clamp-2">{scraped.biography}</div>
                <div className="text-[10px] mt-1 text-[var(--muted-foreground)]">{fmtFollowers(scraped.followersCount)} · {scraped.engagementRate}%</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Followers"><input type="number" value={followers} onChange={e => setFollowers(e.target.value)} className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]" /></Field>
            <Field label="Engagement %"><input type="number" step="0.1" value={engagement} onChange={e => setEngagement(e.target.value)} className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)]" /></Field>
          </div>

          <Field label="Niche">
            <div className="flex flex-wrap gap-2">
              {NICHES.map(n => (
                <button key={n} type="button" onClick={() => toggle(niches, setNiches, n)}
                  className={`text-xs px-3 py-2 rounded-lg border ${niches.includes(n) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)]'}`}>
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Content Types">
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map(c => (
                <button key={c} type="button" onClick={() => toggle(content, setContent, c)}
                  className={`text-xs px-3 py-2 rounded-lg border ${content.includes(c) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)]'}`}>
                  {c}
                </button>
              ))}
            </div>
          </Field>

          {duplicateOf && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-800">
              ⚠ <b>{handle.startsWith('@') ? handle : `@${handle}`}</b> already exists with {duplicateOf.collab_count} collab{duplicateOf.collab_count !== 1 ? 's' : ''}. Open their profile and click <b>+ Start New Collab</b> instead — that&apos;s how repeat collabs work.
            </div>
          )}

          <Field label="Products (optional)">
            <ProductPicker products={formProducts} setProducts={setFormProducts} />
          </Field>

          <Field label="Why this influencer?">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] resize-y" />
          </Field>

          <Field label="DM context (optional)">
            <textarea value={askedFor} onChange={e => setAskedFor(e.target.value)} rows={2} className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] resize-y" />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saveAsWatchlist} onChange={e => setSaveAsWatchlist(e.target.checked)} />
            Save to watchlist instead of prospects
          </label>

          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={!handle.trim() || submitting}
              className="flex-1 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Influencer'}
            </button>
            <button onClick={onClose} className="px-5 py-3 text-sm text-[var(--muted-foreground)]">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Influencer Detail Panel ─── */

function InfluencerPanel({ role, influencer, onClose, onRefresh, flash }: {
  role: Role; influencer: Influencer; onClose: () => void; onRefresh: () => void; flash: (m: string) => void;
}) {
  const isAdmin = role === 'admin';
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteName, setNoteName] = useState(role === 'admin' ? 'Ryan' : '');
  const [editAddress, setEditAddress] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadNotes = useCallback(async () => {
    const r = await fetch(`/api/influencers/notes?influencer_id=${influencer.id}`).then(r => r.json());
    setNotes(r.notes || []);
  }, [influencer.id]);
  useEffect(() => { loadNotes(); }, [loadNotes]);

  const addNote = async () => {
    if (!newNote.trim() || !noteName.trim()) return;
    setBusy(true);
    await fetch('/api/influencers/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencer_id: influencer.id, user_name: noteName, user_role: role, note_text: newNote.trim() }),
    });
    setNewNote(''); setBusy(false); loadNotes();
  };

  const startNewCollab = async () => {
    setBusy(true);
    const res = await fetch('/api/influencers/collabs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencer_id: influencer.id, status: 'negotiating', user_role: role }),
    });
    setBusy(false);
    if (res.ok) { flash('Collab #' + (influencer.collab_count + 1) + ' created'); onRefresh(); }
  };

  const deleteRecord = async () => {
    setBusy(true);
    const res = await fetch(`/api/influencers?id=${influencer.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) { flash('Deleted'); onRefresh(); onClose(); }
  };

  const rescrape = async () => {
    setBusy(true);
    const res = await fetch(`/api/influencers/scrape?handle=${encodeURIComponent(influencer.instagram_handle)}`);
    const d = await res.json();
    if (d.profile) {
      await fetch('/api/influencers', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: influencer.id, action: 'rescrape',
          scraped_data: d.profile, scraped_at: new Date().toISOString(),
          follower_count: d.profile.followersCount, engagement_rate: d.profile.engagementRate,
        }),
      });
      flash('Refreshed ✓'); onRefresh();
    } else flash('Scrape failed');
    setBusy(false);
  };

  const hasAddress = !!influencer.shipping_address1;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Panel>
        <div className="p-5 space-y-5">
          {/* Profile Header */}
          <div className="flex items-start gap-3">
            {influencer.scraped_data?.profilePicUrl && <img src={influencer.scraped_data.profilePicUrl} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <a href={igUrl(influencer.instagram_handle)} target="_blank" rel="noreferrer"
                  className="font-heading text-xl font-semibold text-[var(--foreground)] hover:text-sky-600 hover:underline truncate">{influencer.instagram_handle} ↗</a>
                {influencer.is_verified && <span className="text-[10px] text-sky-600">✓ Verified</span>}
              </div>
              {influencer.full_name && <div className="text-sm text-[var(--foreground)]">{influencer.full_name}</div>}
              <div className="text-xs mt-0.5">
                <span className="text-[var(--muted-foreground)]">{fmtFollowers(influencer.follower_count)} followers · </span>
                <span className={`font-semibold ${engagementTone(influencer.engagement_rate)}`}>{influencer.engagement_rate !== null ? `${influencer.engagement_rate}%` : '—'}</span>
                {(influencer.niche_tags || []).length > 0 && <span className="text-[var(--muted-foreground)]"> · {(influencer.niche_tags || []).join(', ')}</span>}
              </div>
              {influencer.email && <a href={`mailto:${influencer.email}`} className="text-xs text-sky-600 hover:underline mt-0.5 inline-block">{influencer.email}</a>}
              {isAdmin && (
                <div className="flex gap-3 mt-1">
                  <button onClick={rescrape} disabled={busy} className="text-[10px] text-sky-600 hover:underline">↻ Refresh stats</button>
                  <button onClick={() => setEditProfile(v => !v)} className="text-[10px] text-sky-600 hover:underline">{editProfile ? 'Done editing' : '✎ Edit profile'}</button>
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
          </div>

          {/* Profile editor */}
          {editProfile && (
            <ProfileEditor influencer={influencer} onSaved={() => { setEditProfile(false); flash('Profile saved'); onRefresh(); }} />
          )}

          {/* Bio */}
          {!editProfile && influencer.bio && (
            <div className="bg-[var(--muted)]/40 rounded-xl p-3 text-xs text-[var(--muted-foreground)] whitespace-pre-wrap italic">{influencer.bio}</div>
          )}

          {/* Person notes */}
          {influencer.person_notes && (
            <div className="text-xs text-[var(--foreground)] whitespace-pre-wrap">{influencer.person_notes}</div>
          )}

          {/* Shipping address — permanent */}
          <section className="border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">📍 Shipping Address (permanent)</div>
              <button onClick={() => setEditAddress(v => !v)} className="text-xs text-sky-600 hover:underline">{editAddress ? 'Done' : hasAddress ? 'Edit' : 'Add'}</button>
            </div>
            {!editAddress ? (
              hasAddress ? (
                <div className="text-sm space-y-0.5">
                  {influencer.shipping_name && <div className="font-medium">{influencer.shipping_name}</div>}
                  <div>{influencer.shipping_address1}</div>
                  {influencer.shipping_address2 && <div>{influencer.shipping_address2}</div>}
                  <div>{influencer.shipping_city}, {influencer.shipping_state} {influencer.shipping_zip}</div>
                  {influencer.shipping_phone && <div className="text-[var(--muted-foreground)]">{influencer.shipping_phone}</div>}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200/70 rounded-lg px-3 py-2 text-xs text-amber-700">
                  No address on file. Add one so you can create Shopify orders for any collab with this influencer.
                </div>
              )
            ) : (
              <AddressEditor influencer={influencer} onSaved={() => { setEditAddress(false); flash('Saved'); onRefresh(); }} />
            )}
          </section>

          {/* Collabs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Collabs ({influencer.collab_count})</div>
              {isAdmin && (
                <button onClick={startNewCollab} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold">
                  + Start New Collab
                </button>
              )}
            </div>
            <div className="space-y-3">
              {influencer.collabs.map(c => (
                <CollabCard key={c.id} collab={c} influencer={influencer} role={role} onRefresh={onRefresh} flash={flash} />
              ))}
              {influencer.collabs.length === 0 && <div className="text-xs text-[var(--muted-foreground)] italic">No collabs yet</div>}
            </div>
          </section>

          {/* Notes thread (person-level) */}
          <section className="border border-[var(--border)] rounded-xl p-4">
            <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Notes Thread</div>
            <div className="space-y-3 mb-3 max-h-64 overflow-y-auto">
              {notes.length === 0 ? (
                <div className="text-xs text-[var(--muted-foreground)] italic">No notes yet — add one below</div>
              ) : notes.map(n => (
                <div key={n.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-[var(--foreground)]">{n.user_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${n.user_role === 'admin' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{n.user_role}</span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">{new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{n.note_text}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-[var(--border)] pt-3">
              <div className="flex gap-2 items-center">
                <input value={noteName} onChange={e => setNoteName(e.target.value)} placeholder="Your name" className="flex-1 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs" />
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded ${role === 'admin' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{role}</span>
              </div>
              <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} placeholder="Add a note…"
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm resize-y" />
              <button onClick={addNote} disabled={!newNote.trim() || !noteName.trim() || busy}
                className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-xs font-semibold disabled:opacity-50">Add Note</button>
            </div>
          </section>

          {/* Delete person */}
          {isAdmin && (
            <section className="pt-4 border-t border-[var(--border)]">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-600 hover:underline">Delete this influencer (and all their collabs)</button>
              ) : (
                <div className="bg-red-50 border border-red-200/70 rounded-xl p-3 space-y-2">
                  <div className="text-xs text-red-700">Delete <b>{influencer.instagram_handle}</b> + all {influencer.collab_count} collab(s)? Cannot be undone.</div>
                  <div className="flex gap-2">
                    <button onClick={deleteRecord} disabled={busy} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold">Delete</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs text-[var(--muted-foreground)]">Cancel</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 max-h-[92vh] rounded-t-2xl overflow-y-auto bg-[var(--card)] shadow-2xl animate-slide-up md:bottom-auto md:right-0 md:top-0 md:left-auto md:w-[560px] md:h-full md:max-h-none md:rounded-none md:animate-slide-right">
      <div className="md:hidden text-center pt-3 pb-1"><div className="w-9 h-1 bg-[var(--border)] rounded mx-auto" /></div>
      {children}
    </div>
  );
}

/* ─── Address Editor ─── */

function ProfileEditor({ influencer, onSaved }: { influencer: Influencer; onSaved: () => void }) {
  const [fullName, setFullName] = useState(influencer.full_name || '');
  const [email, setEmail] = useState(influencer.email || '');
  const [niches, setNiches] = useState<string[]>(influencer.niche_tags || []);
  const [content, setContent] = useState<string[]>(influencer.content_types || []);
  const [bio, setBio] = useState(influencer.bio || '');
  const [personNotes, setPersonNotes] = useState(influencer.person_notes || '');
  const [followers, setFollowers] = useState(influencer.follower_count?.toString() || '');
  const [engagement, setEngagement] = useState(influencer.engagement_rate?.toString() || '');
  const [saving, setSaving] = useState(false);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const save = async () => {
    setSaving(true);
    await fetch('/api/influencers', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: influencer.id, action: 'update_profile',
        full_name: fullName || null, email: email || null,
        niche_tags: niches, content_types: content,
        bio: bio || null, person_notes: personNotes || null,
        follower_count: followers ? parseInt(followers) : null,
        engagement_rate: engagement ? parseFloat(engagement) : null,
      }),
    });
    setSaving(false); onSaved();
  };

  return (
    <section className="border-2 border-sky-200 bg-sky-50/30 rounded-xl p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-sky-700">Edit Profile</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Full Name"><input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
        <Field label="Email"><input value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Followers"><input type="number" value={followers} onChange={e => setFollowers(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
        <Field label="Engagement %"><input type="number" step="0.1" value={engagement} onChange={e => setEngagement(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
      </div>
      <Field label="Niches">
        <div className="flex flex-wrap gap-2">
          {NICHES.map(n => (
            <button key={n} type="button" onClick={() => toggle(niches, setNiches, n)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${niches.includes(n) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)]'}`}>{n}</button>
          ))}
        </div>
      </Field>
      <Field label="Content Types">
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map(c => (
            <button key={c} type="button" onClick={() => toggle(content, setContent, c)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${content.includes(c) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)]'}`}>{c}</button>
          ))}
        </div>
      </Field>
      <Field label="Bio (auto from scrape)">
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm resize-y" />
      </Field>
      <Field label="Person notes (your private notes)">
        <textarea value={personNotes} onChange={e => setPersonNotes(e.target.value)} rows={3} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm resize-y" />
      </Field>
      <button onClick={save} disabled={saving} className="w-full py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </section>
  );
}

function AddressEditor({ influencer, onSaved }: { influencer: Influencer; onSaved: () => void }) {
  const [name, setName] = useState(influencer.shipping_name || '');
  const [a1, setA1] = useState(influencer.shipping_address1 || '');
  const [a2, setA2] = useState(influencer.shipping_address2 || '');
  const [city, setCity] = useState(influencer.shipping_city || '');
  const [state, setState] = useState(influencer.shipping_state || '');
  const [zip, setZip] = useState(influencer.shipping_zip || '');
  const [phone, setPhone] = useState(influencer.shipping_phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch('/api/influencers', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: influencer.id, action: 'update_address',
        shipping_name: name, shipping_address1: a1, shipping_address2: a2,
        shipping_city: city, shipping_state: state, shipping_zip: zip,
        shipping_country: 'US', shipping_phone: phone,
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="space-y-2">
      <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
      <input placeholder="Address" value={a1} onChange={e => setA1(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
      <input placeholder="Apt / Suite" value={a2} onChange={e => setA2(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
      <div className="grid grid-cols-3 gap-2">
        <input placeholder="City" value={city} onChange={e => setCity(e.target.value)} className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
        <input placeholder="State" value={state} onChange={e => setState(e.target.value)} className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
        <input placeholder="Zip" value={zip} onChange={e => setZip(e.target.value)} className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
      </div>
      <input placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
      <button onClick={save} disabled={saving} className="w-full py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Address'}
      </button>
    </div>
  );
}

/* ─── Collab Card ─── */

function CollabCard({ collab, influencer, role, onRefresh, flash }: {
  collab: Collab; influencer: Influencer; role: Role; onRefresh: () => void; flash: (m: string) => void;
}) {
  const isAdmin = role === 'admin';
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterNote, setCounterNote] = useState('');
  const [showLogContent, setShowLogContent] = useState(false);
  const [contentUrl, setContentUrl] = useState('');
  const [contentDate, setContentDate] = useState(new Date().toISOString().slice(0, 10));
  const [editProducts, setEditProducts] = useState(false);
  const [draftProducts, setDraftProducts] = useState<Product[]>(collab.products || []);
  const [editDeal, setEditDeal] = useState(false);
  const [dealDraft, setDealDraft] = useState({
    deal_type: collab.deal_type || '',
    payment_amount: String(collab.payment_amount || 0),
    payment_method: collab.payment_method || '',
    deliverables: collab.deliverables || '',
    discount_code: collab.discount_code || '',
    expected_post_date: collab.expected_post_date || '',
    special_instructions: collab.special_instructions || '',
  });

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(true);
    const res = await fetch('/api/influencers/collabs', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: collab.id, action, user_role: role, ...body }),
    });
    setBusy(false);
    if (!res.ok) { flash('Action failed'); return; }
    onRefresh();
  };

  const createDraft = async () => {
    if ((collab.products || []).length === 0) {
      flash('Add products to this collab first');
      return;
    }
    if (!influencer.shipping_address1 && !collab.shipping_override?.address1) {
      flash('Add shipping address to this influencer first');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/influencers/shopify-draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collab_id: collab.id }),
    });
    const d = await res.json();
    setBusy(false);
    if (res.ok) { flash(`Draft created: ${d.draft?.name}`); onRefresh(); }
    else flash(`Error: ${d.error || 'Failed'}`);
  };

  const products = collab.products || [];
  const giftValue = products.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1), 0);
  const s = collab.status;
  const sm = STATUS_META[s] || STATUS_META.prospect;

  return (
    <div className={`border rounded-xl overflow-hidden flex ${s === 'negotiating' && collab.counter_note ? 'border-amber-300 bg-amber-50/20' : 'border-[var(--border)] bg-[var(--card)]'}`}>
      <div className={`w-1 flex-shrink-0 ${sm.bar}`} />
      <div className="flex-1 min-w-0">
      <button onClick={() => setExpanded(v => !v)} className="w-full text-left p-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--foreground)]">Collab #{collab.collab_number}</span>
            <StatusBadge status={s} />
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
            {[
              formatDealType(collab.deal_type),
              collab.payment_amount > 0 ? `$${collab.payment_amount}` : null,
              products.length > 0 ? `${products.length} item${products.length !== 1 ? 's' : ''} · ${fmtMoney(giftValue)}` : null,
              collab.discount_code,
              fmtDateShort(collab.status_changed_at),
            ].filter(Boolean).join(' · ')}
          </div>
          {collab.shopify_order_name && <div className="text-[11px] text-emerald-600 mt-0.5">✓ {collab.shopify_order_name}</div>}
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] p-4 space-y-4">
          {/* Counter banner */}
          {s === 'negotiating' && collab.counter_note && (
            <div className="bg-amber-100 border-l-4 border-amber-500 rounded-xl p-3 text-sm text-amber-900">
              <div className="uppercase tracking-wider font-bold text-[10px] mb-1">⚠ Ryan&apos;s feedback</div>
              <div className="whitespace-pre-wrap text-xs">{collab.counter_note}</div>
            </div>
          )}

          {/* Status actions */}
          <div className="flex flex-wrap gap-2">
            {s === 'prospect' && <ActionBtn onClick={() => act('start_outreach')} color="bg-sky-600" busy={busy}>Start Outreach →</ActionBtn>}
            {s === 'outreach' && <ActionBtn onClick={() => act('move_to_negotiating')} color="bg-amber-500" busy={busy}>Move to Negotiating →</ActionBtn>}
            {s === 'negotiating' && isAdmin && <>
              <ActionBtn onClick={() => act('approve')} color="bg-emerald-600" busy={busy}>Approve ✓</ActionBtn>
              <ActionBtn onClick={() => setShowCounter(true)} color="bg-amber-500" busy={busy}>Send Notes ↩</ActionBtn>
            </>}
            {s === 'approved' && isAdmin && <ActionBtn onClick={createDraft} color="bg-emerald-600" busy={busy}>Create Draft Order →</ActionBtn>}
            {s === 'shipped' && <ActionBtn onClick={() => setShowLogContent(true)} color="bg-emerald-600" busy={busy}>Mark Posted ✓</ActionBtn>}
            {(s === 'prospect' || s === 'outreach' || s === 'negotiating') && isAdmin && (
              <ActionBtn onClick={() => act('move_to_watchlist')} color="bg-purple-600" busy={busy}>Watchlist</ActionBtn>
            )}
            {(['prospect', 'outreach', 'negotiating'].includes(s)) && isAdmin && (
              <ActionBtn onClick={() => act('pass', { declined_reason: 'Manual pass' })} color="bg-stone-500" busy={busy}>Pass</ActionBtn>
            )}
            {s === 'passed' && isAdmin && <ActionBtn onClick={() => act('reopen')} color="bg-[var(--primary)] text-[var(--primary-foreground)]" busy={busy}>Reopen</ActionBtn>}
          </div>

          {/* Counter inline */}
          {showCounter && (
            <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-3 space-y-2">
              <textarea value={counterNote} onChange={e => setCounterNote(e.target.value)} rows={3} placeholder="What should the intern change?"
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
              <div className="flex gap-2">
                <button onClick={async () => { if (!counterNote.trim()) return; await act('send_notes', { counter_note: counterNote }); flash('Notes sent'); setCounterNote(''); setShowCounter(false); }}
                  disabled={!counterNote.trim() || busy} className="flex-1 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">Send</button>
                <button onClick={() => setShowCounter(false)} className="px-3 py-2 text-sm text-[var(--muted-foreground)]">Cancel</button>
              </div>
            </div>
          )}

          {/* Log content inline */}
          {showLogContent && (
            <div className="bg-emerald-50/30 border border-emerald-200/70 rounded-xl p-3 space-y-2">
              <input type="url" value={contentUrl} onChange={e => setContentUrl(e.target.value)} placeholder="Post URL"
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
              <input type="date" value={contentDate} onChange={e => setContentDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
              <div className="flex gap-2">
                <button onClick={async () => { await act('mark_posted', { content_urls: [contentUrl].filter(Boolean), content_posted_date: contentDate }); flash('Posted ✓'); setContentUrl(''); setShowLogContent(false); }}
                  disabled={busy} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold">Mark Posted</button>
                <button onClick={() => setShowLogContent(false)} className="px-3 py-2 text-sm text-[var(--muted-foreground)]">Cancel</button>
              </div>
            </div>
          )}

          {/* DM context */}
          {collab.dm_context && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">💬 DM Context</div>
              <div className="text-xs text-[var(--foreground)] whitespace-pre-wrap">{collab.dm_context}</div>
            </div>
          )}

          {/* Intern notes — only show if distinct from DM context */}
          {collab.intern_notes && collab.intern_notes !== collab.dm_context && !(collab.dm_context || '').includes(collab.intern_notes || '') && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Intern Notes</div>
              <div className="text-xs whitespace-pre-wrap">{collab.intern_notes}</div>
            </div>
          )}

          {/* Deal terms — editable */}
          <div className="text-xs space-y-1">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Deal</div>
              {isAdmin && (
                <button onClick={() => setEditDeal(v => !v)} className="text-[10px] text-sky-600 hover:underline">{editDeal ? 'Cancel' : '✎ Edit'}</button>
              )}
            </div>
            {!editDeal ? (
              !collab.deal_type && !collab.deliverables && !collab.discount_code ? (
                <div className="text-[var(--muted-foreground)] italic">Deal terms not set yet</div>
              ) : (
                <div className="space-y-0.5">
                  {collab.deal_type && <div><span className="text-[var(--muted-foreground)]">Type:</span> {formatDealType(collab.deal_type)}</div>}
                  {collab.payment_amount > 0 && <div><span className="text-[var(--muted-foreground)]">Payment:</span> ${collab.payment_amount}{collab.payment_method ? ` via ${collab.payment_method}` : ''}</div>}
                  {collab.deliverables && <div><span className="text-[var(--muted-foreground)]">Deliverables:</span> {collab.deliverables}</div>}
                  {collab.expected_post_date && <div><span className="text-[var(--muted-foreground)]">Expected post:</span> {fmtDate(collab.expected_post_date)}</div>}
                  {collab.discount_code && <div><span className="text-[var(--muted-foreground)]">Code:</span> {collab.discount_code}</div>}
                  {collab.special_instructions && <div><span className="text-[var(--muted-foreground)]">Notes:</span> {collab.special_instructions}</div>}
                </div>
              )
            ) : (
              <div className="space-y-2 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={dealDraft.deal_type} onChange={e => setDealDraft({ ...dealDraft, deal_type: e.target.value })}
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs">
                    <option value="">Type…</option>
                    <option value="gifted_only">Gifted</option>
                    <option value="gifted_paid">Gifted + Paid</option>
                    <option value="paid_only">Paid</option>
                    <option value="affiliate">Affiliate</option>
                  </select>
                  <input type="number" value={dealDraft.payment_amount} onChange={e => setDealDraft({ ...dealDraft, payment_amount: e.target.value })}
                    placeholder="Payment $" className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs" />
                </div>
                <select value={dealDraft.payment_method} onChange={e => setDealDraft({ ...dealDraft, payment_method: e.target.value })}
                  className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs">
                  <option value="">Payment method…</option>
                  <option>PayPal</option><option>Zelle</option><option>Venmo</option><option>Store Credit</option><option>N/A</option>
                </select>
                <textarea value={dealDraft.deliverables} onChange={e => setDealDraft({ ...dealDraft, deliverables: e.target.value })}
                  rows={2} placeholder="Deliverables" className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={dealDraft.expected_post_date} onChange={e => setDealDraft({ ...dealDraft, expected_post_date: e.target.value })}
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs" />
                  <input value={dealDraft.discount_code} onChange={e => setDealDraft({ ...dealDraft, discount_code: e.target.value })}
                    placeholder="Discount code" className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs" />
                </div>
                <textarea value={dealDraft.special_instructions} onChange={e => setDealDraft({ ...dealDraft, special_instructions: e.target.value })}
                  rows={2} placeholder="Special instructions" className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs" />
                <button onClick={async () => {
                  await act('update_fields', {
                    deal_type: dealDraft.deal_type || null,
                    payment_amount: parseFloat(dealDraft.payment_amount) || 0,
                    payment_method: dealDraft.payment_method || null,
                    deliverables: dealDraft.deliverables || null,
                    expected_post_date: dealDraft.expected_post_date || null,
                    discount_code: dealDraft.discount_code || null,
                    special_instructions: dealDraft.special_instructions || null,
                  });
                  flash('Deal saved'); setEditDeal(false);
                }} disabled={busy} className="w-full py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-xs font-semibold">Save Deal</button>
              </div>
            )}
          </div>

          {/* Products — always shown, editable */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Products ({products.length})</div>
              {isAdmin && !editProducts && <button onClick={() => { setDraftProducts(products); setEditProducts(true); }} className="text-[10px] text-sky-600 hover:underline">{products.length > 0 ? '✎ Edit' : '+ Add'}</button>}
            </div>
            {!editProducts ? (
              products.length === 0 ? (
                <div className="text-xs text-[var(--muted-foreground)] italic">No products yet — add some before creating a Shopify order</div>
              ) : (
                <div className="space-y-1.5">
                  {products.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-2 bg-[var(--muted)]/40 rounded-lg">
                      {p.image && <img src={p.image} alt="" className="w-8 h-8 rounded object-cover" />}
                      <div className="flex-1 min-w-0 truncate">{p.title}</div>
                      <div className="text-[var(--muted-foreground)]">×{p.quantity || 1}</div>
                      <div>${(p.price || 0).toFixed(0)}</div>
                    </div>
                  ))}
                  <div className="text-[11px] text-right text-[var(--muted-foreground)]">Total: <b className="text-[var(--foreground)]">{fmtMoney(giftValue)}</b></div>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <ProductPicker products={draftProducts} setProducts={setDraftProducts} />
                <div className="flex gap-2">
                  <button onClick={async () => {
                    const total = draftProducts.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1), 0);
                    await act('update_fields', { products: draftProducts, total_gift_value: total });
                    flash('Products saved'); setEditProducts(false);
                  }} disabled={busy} className="flex-1 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-xs font-semibold">Save Products</button>
                  <button onClick={() => { setEditProducts(false); setDraftProducts(products); }} className="px-3 py-2 text-xs text-[var(--muted-foreground)]">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Shopify */}
          {collab.shopify_order_name && (
            <div className="text-xs">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Shopify Order</div>
              <div className="text-emerald-600 font-medium">✓ {collab.shopify_order_name}</div>
              {collab.shopify_order_status && <div className="text-[var(--muted-foreground)]">Status: {collab.shopify_order_status}</div>}
              {collab.tracking_number && <div className="text-[var(--muted-foreground)]">Tracking: {collab.tracking_number}{collab.tracking_carrier ? ` (${collab.tracking_carrier})` : ''}</div>}
            </div>
          )}

          {/* Content */}
          {(collab.content_urls || []).length > 0 && (
            <div className="text-xs">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Content</div>
              {(collab.content_urls || []).map(u => <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-sky-600 hover:underline truncate">{u}</a>)}
              {collab.content_posted_date && <div className="text-[var(--muted-foreground)] mt-1">Posted {fmtDate(collab.content_posted_date)}</div>}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function ActionBtn({ onClick, color, busy, children }: { onClick: () => void; color: string; busy: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={busy}
      className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-white disabled:opacity-50 ${color}`}>
      {children}
    </button>
  );
}

/* ─── Product Picker (reusable) ─── */

type ShopifyVariant = { id: string; title: string; sku: string | null; price: number; size: string; inStock: boolean; inventory: number | null };
type ShopifyProduct = { id: string; title: string; handle: string; image: string | null; variants: ShopifyVariant[] };

export function ProductPicker({ products, setProducts }: { products: Product[]; setProducts: (p: Product[]) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ShopifyProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/influencers/products?search=${encodeURIComponent(q)}`).then(r => r.json());
        setResults(r.products || []);
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const addVariant = (p: ShopifyProduct, v: ShopifyVariant) => {
    setProducts([...products, {
      title: `${p.title} — ${v.size}`,
      variantId: v.id,
      price: v.price,
      quantity: 1,
      sku: v.sku || undefined,
      image: p.image || undefined,
    }]);
    setQ(''); setResults([]); setExpanded(null);
  };

  const total = products.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1), 0);

  return (
    <div className="space-y-2">
      {products.length > 0 && (
        <div className="space-y-1.5">
          {products.map((p, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[var(--muted)]/50 rounded-lg">
              {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--foreground)] truncate">{p.title}</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">${(p.price || 0).toFixed(2)}{p.sku ? ` · SKU ${p.sku}` : ''}</div>
              </div>
              <input type="number" min="1" value={p.quantity || 1}
                onChange={e => { const c = [...products]; c[i] = { ...c[i], quantity: parseInt(e.target.value) || 1 }; setProducts(c); }}
                className="w-14 p-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-sm text-center" />
              <button onClick={() => setProducts(products.filter((_, j) => j !== i))} className="text-red-500 text-lg px-1">×</button>
            </div>
          ))}
          <div className="text-[11px] text-right text-[var(--muted-foreground)]">Total: <b className="text-[var(--foreground)]">${total.toFixed(0)}</b></div>
        </div>
      )}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search active Shopify products by title…"
        className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--ring)]" />
      {searching && <div className="text-xs text-[var(--muted-foreground)] italic">Searching…</div>}
      {results.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
          {results.map(p => (
            <div key={p.id}>
              <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--accent)]/40 text-left">
                {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--foreground)] truncate">{p.title}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{p.variants.length} in-stock size{p.variants.length !== 1 ? 's' : ''}</div>
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">{expanded === p.id ? '▾' : '▸'}</span>
              </button>
              {expanded === p.id && (
                <div className="pl-14 pr-3 pb-3 flex flex-wrap gap-1.5">
                  {p.variants.map(v => (
                    <button key={v.id} onClick={() => addVariant(p, v)} className="text-[11px] px-2.5 py-1.5 rounded-lg border bg-[var(--card)] border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--accent)]">
                      {v.size} · ${v.price.toFixed(0)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
