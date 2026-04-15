'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { MetricCard } from '@/components/MetricCard';

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

const STATUS_META: Record<string, { label: string; bg: string; text: string; border?: string }> = {
  prospect: { label: 'Prospect', bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-200' },
  outreach: { label: 'Outreach', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200/80' },
  negotiating: { label: 'Negotiating', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80' },
  shipped: { label: 'Shipped', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200/80' },
  posted: { label: '✓ Posted', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  watchlist: { label: 'Watchlist', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200/80' },
  passed: { label: 'Passed', bg: 'bg-stone-50', text: 'text-stone-400', border: 'border-stone-200' },
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

function StatusBadge({ status, large }: { status: string; large?: boolean }) {
  const m = STATUS_META[status] || STATUS_META.prospect;
  const size = large ? 'text-[11px] px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return <span className={`${size} font-semibold rounded-lg border ${m.bg} ${m.text} ${m.border || ''}`}>{m.label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-1.5">{label}</div>
      {children}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard label="Active Collabs" value={String(stats?.activeCollabs || 0)} sub="not posted/passed/watchlist" accent="sky" formula="Collabs across people whose status is not posted/passed/watchlist." />
              <MetricCard label="Prospects" value={String(pipeline.prospect || 0)} sub="ready to reach out" accent={(pipeline.prospect || 0) > 0 ? 'amber' : undefined} formula="Latest collab status = prospect." />
              <MetricCard label="Negotiating" value={String(pipeline.negotiating || 0)} sub="back & forth on terms" formula="Latest collab status = negotiating." />
              <MetricCard label="Shipped" value={String(pipeline.shipped || 0)} sub="awaiting post" formula="Latest collab status = shipped." />
              <MetricCard label="Total Gifted" value={fmtMoney(stats?.allTime.totalGifted || 0)} sub={`${stats?.allTime.totalCollabs || 0} total collabs`} formula="SUM of total_gift_value across shipped+posted collabs." />
              <div className="hidden sm:block"><MetricCard label="Posts (Month)" value={String(stats?.thisMonth.posts || 0)} sub="content posted this month" formula="COUNT collabs with content_posted_date in current month." /></div>
            </div>
          </section>
        )}

        {/* Filter pills */}
        <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-2 overflow-x-auto whitespace-nowrap">
          {FILTERS.map(f => {
            const count = f.key === 'all' ? rows.length : (pipeline[f.key] || 0);
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`text-[11px] sm:text-xs tracking-wider uppercase px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1.5 ${filter === f.key ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}>
                {f.label}
                {count > 0 && f.key !== 'all' && <span className={`text-[10px] rounded-full min-w-[16px] px-1 ${filter === f.key ? 'bg-[var(--primary-foreground)]/20' : 'bg-[var(--muted)]'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Search + Add */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search handles, niches, notes…"
              className="w-full py-2.5 px-4 pl-9 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--ring)]" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-xs">🔍</span>
          </div>
          <button onClick={() => setShowForm(true)}
            className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
            + New Influencer
          </button>
        </div>

        {/* Table / Cards */}
        {loading ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] text-sm">Loading…</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">
            <div className="text-3xl mb-2">💌</div>
            <div className="text-sm">{search ? `No influencers match "${search}"` : 'No influencers yet.'}</div>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                    <th className="pl-4 pr-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left">Handle</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-right w-[80px]">Followers</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-right w-[70px]">Engage</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[160px]">Niche</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-center w-[80px]">Collabs</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-center w-[120px]">Latest</th>
                    <th className="px-2 pr-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[100px]">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredRows.map(r => (
                    <tr key={r.id} onClick={() => setSelectedId(r.id)} className="cursor-pointer hover:bg-[var(--accent)]/40 transition-colors">
                      <td className="pl-4 pr-2 py-3">
                        <a href={igUrl(r.instagram_handle)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          title={r.bio || undefined}
                          className="text-sm font-semibold text-[var(--foreground)] hover:text-sky-600 hover:underline">{r.instagram_handle}</a>
                        {r.full_name && <div className="text-[10px] text-[var(--muted-foreground)]">{r.full_name}</div>}
                      </td>
                      <td className="px-2 py-3 text-right text-sm text-[var(--foreground)] tabular-nums">{fmtFollowers(r.follower_count)}</td>
                      <td className={`px-2 py-3 text-right text-sm font-semibold tabular-nums ${engagementTone(r.engagement_rate)}`}>{r.engagement_rate !== null ? `${r.engagement_rate}%` : '—'}</td>
                      <td className="px-2 py-3 text-xs text-[var(--muted-foreground)]">
                        {(r.niche_tags || []).length === 0 ? '—' : <span className="truncate inline-block max-w-[140px]">{r.niche_tags![0]}{r.niche_tags!.length > 1 && ` +${r.niche_tags!.length - 1}`}</span>}
                      </td>
                      <td className="px-2 py-3 text-center text-xs text-[var(--muted-foreground)]">{r.collab_count}</td>
                      <td className="px-2 py-3 text-center"><StatusBadge status={r.latest_status} /></td>
                      <td className="px-2 pr-4 py-3 text-xs text-[var(--muted-foreground)]">{fmtDate(r.active_collab?.status_changed_at || r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden flex flex-col gap-2">
              {filteredRows.map(r => (
                <div key={r.id} onClick={() => setSelectedId(r.id)} className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm active:bg-[var(--accent)]">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[var(--foreground)] truncate">{r.instagram_handle}</div>
                      <div className="text-xs">
                        <span className="text-[var(--muted-foreground)]">{fmtFollowers(r.follower_count)} · </span>
                        <span className={`font-semibold ${engagementTone(r.engagement_rate)}`}>{r.engagement_rate !== null ? `${r.engagement_rate}%` : '—'}</span>
                        <span className="text-[var(--muted-foreground)]"> · {r.collab_count} collab{r.collab_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <StatusBadge status={r.latest_status} large />
                  </div>
                </div>
              ))}
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
              {influencer.email && <div className="text-xs text-sky-600 mt-0.5">{influencer.email}</div>}
              {isAdmin && (
                <button onClick={rescrape} disabled={busy} className="text-[10px] text-sky-600 hover:underline mt-1">↻ Refresh stats</button>
              )}
            </div>
            <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
          </div>

          {/* Bio */}
          {influencer.bio && (
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
                <div className="text-xs text-[var(--muted-foreground)] italic">No address on file</div>
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
    <>
      <div className="hidden md:block absolute top-0 right-0 h-full w-[560px] bg-[var(--card)] shadow-2xl overflow-y-auto animate-slide-right">{children}</div>
      <div className="md:hidden absolute bottom-0 left-0 right-0 bg-[var(--card)] rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl animate-slide-up">
        <div className="text-center pt-3 pb-1"><div className="w-9 h-1 bg-[var(--border)] rounded mx-auto" /></div>
        {children}
      </div>
    </>
  );
}

/* ─── Address Editor ─── */

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
    if (!influencer.shipping_address1 && !collab.shipping_override?.address1) {
      flash('Add shipping address first');
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

  return (
    <div className={`border rounded-xl ${s === 'negotiating' && collab.counter_note ? 'border-amber-300 bg-amber-50/20' : 'border-[var(--border)] bg-[var(--card)]'}`}>
      <button onClick={() => setExpanded(v => !v)} className="w-full text-left p-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--foreground)]">Collab #{collab.collab_number}</span>
            <StatusBadge status={s} />
          </div>
          <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
            {collab.deal_type ? `${collab.deal_type.replace('_', ' ')} · ` : ''}
            {products.length > 0 ? `${products.length} item${products.length !== 1 ? 's' : ''} · ${fmtMoney(giftValue)} ` : ''}
            {collab.payment_amount > 0 ? `+ $${collab.payment_amount} payment ` : ''}
            · {fmtDate(collab.status_changed_at)}
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
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">DM Context</div>
              <div className="text-xs text-[var(--foreground)] whitespace-pre-wrap">{collab.dm_context}</div>
            </div>
          )}

          {/* Intern notes */}
          {collab.intern_notes && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Intern Notes</div>
              <div className="text-xs whitespace-pre-wrap">{collab.intern_notes}</div>
            </div>
          )}

          {/* Deal terms */}
          {(collab.deal_type || collab.deliverables || collab.discount_code) && (
            <div className="text-xs space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">Deal</div>
              {collab.deal_type && <div><span className="text-[var(--muted-foreground)]">Type:</span> {collab.deal_type}</div>}
              {collab.payment_amount > 0 && <div><span className="text-[var(--muted-foreground)]">Payment:</span> ${collab.payment_amount}</div>}
              {collab.deliverables && <div><span className="text-[var(--muted-foreground)]">Deliverables:</span> {collab.deliverables}</div>}
              {collab.expected_post_date && <div><span className="text-[var(--muted-foreground)]">Expected post:</span> {fmtDate(collab.expected_post_date)}</div>}
              {collab.discount_code && <div><span className="text-[var(--muted-foreground)]">Code:</span> {collab.discount_code}</div>}
            </div>
          )}

          {/* Products */}
          {products.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Products ({products.length})</div>
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
            </div>
          )}

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
