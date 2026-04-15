'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Nav from '@/components/Nav';
import { MetricCard } from '@/components/MetricCard';

/* ─── Types ─── */

type Role = 'admin' | 'intern';

type Product = { title?: string; variantId?: string; price?: number; quantity?: number; sku?: string; image?: string };
type ShippingAddr = { firstName?: string; lastName?: string; address1?: string; address2?: string; city?: string; province?: string; zip?: string; country?: string; phone?: string };

type ScrapedData = {
  username: string; fullName: string; biography: string;
  followersCount: number; followsCount: number; postsCount: number;
  isVerified: boolean; isBusinessAccount: boolean;
  profilePicUrl: string; externalUrl: string;
  engagementRate: number;
  recentPosts: { url: string; likesCount: number; commentsCount: number; type: string }[];
};

type Influencer = {
  id: string;
  created_at: string;
  created_by: string | null;
  instagram_handle: string;
  profile_url: string | null;
  follower_count: number | null;
  engagement_rate: number | null;
  niche_tags: string[] | null;
  content_types: string[] | null;
  bio_notes: string | null;
  dm_context: string | null;
  already_contacted: boolean;
  status: string;
  declined_reason: string | null;
  counter_note: string | null;
  deal_type: string | null;
  payment_amount: number;
  products_to_send: Product[] | null;
  deliverables: string | null;
  expected_post_date: string | null;
  special_instructions: string | null;
  discount_code: string | null;
  shipping_address: ShippingAddr | null;
  shopify_draft_order_id: string | null;
  shopify_order_name: string | null;
  content_urls: string[] | null;
  content_posted_date: string | null;
  content_type_posted: string[] | null;
  scraped_data: ScrapedData | null;
  scraped_at: string | null;
  post_reach: number | null;
  post_impressions: number | null;
  post_engagement: number | null;
};

type Stats = {
  pipeline: Record<string, number>;
  thisMonth: { shipped: number; giftedValue: number; posts: number };
  allTime: { totalGifted: number; totalInfluencers: number };
};

type NoteRow = { id: string; user_name: string; user_role: string; note_text: string; created_at: string };
type ActivityRow = { id: string; action: string; user_role: string | null; details: Record<string, unknown> | null; created_at: string };

/* ─── Constants ─── */

const NICHES = ['Orthodox/Frum', 'LDS/Mormon', 'Modest Fashion General', 'Hijabi/Muslim Modest', 'Other'];
const CONTENT_TYPES = ['Reels', 'Stories', 'Static Posts', 'TikTok'];

const STATUS_META: Record<string, { label: string; bg: string; text: string; border?: string }> = {
  pending_review: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/80' },
  countered: { label: 'Countered', bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-400' },
  watchlist: { label: 'Watchlist', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200/80' },
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80' },
  declined: { label: 'Declined', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200/80' },
  deal: { label: 'Deal', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200/80' },
  shipped: { label: 'Shipped', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200/80' },
  content_pending: { label: 'Content Pending', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200/80' },
  posted: { label: 'Posted', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80' },
  complete: { label: '✓ Complete', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending_review', label: 'Pending' },
  { key: 'countered', label: 'Countered' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'approved', label: 'Approved' },
  { key: 'active', label: 'Active' },
  { key: 'complete', label: 'Complete' },
  { key: 'declined', label: 'Declined' },
];

const COUNTER_QUICK_FILLS = [
  'Too many items — limit to 2',
  'Payment too high',
  'Need more deliverables (add reels)',
  'Not enough posts',
  'Wrong audience fit',
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

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || STATUS_META.pending_review;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${m.bg} ${m.text} ${m.border || ''}`}>{m.label}</span>;
}

/* ─── Main page ─── */

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
  const [showGuidelines, setShowGuidelines] = useState(false);
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
    if (filter !== 'all') p.set('status', filter);
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
    return q ? rows.filter(r => r.instagram_handle.toLowerCase().includes(q)) : rows;
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
  const pendingCount = pipeline.pending_review || 0;
  const activeCount = (pipeline.deal || 0) + (pipeline.shipped || 0) + (pipeline.content_pending || 0);
  const contentPending = (pipeline.shipped || 0) + (pipeline.content_pending || 0);
  const watchlistCount = pipeline.watchlist || 0;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--primary-foreground)] px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}
      <Nav active="influencers" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">Influencer Tracker</h2>
          <button onClick={() => setShowGuidelines(v => !v)} className="text-[11px] tracking-wider uppercase text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-semibold">
            {showGuidelines ? '▼' : '▶'} Vetting Guidelines
          </button>
        </div>

        {showGuidelines && <GuidelinesPanel />}

        {/* Stats */}
        {role === 'admin' && (
          <section>
            <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Pipeline</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard label="Pending Review" value={String(pendingCount)} sub="awaiting approval" accent={pendingCount > 0 ? 'amber' : undefined} formula="COUNT status='pending_review'" />
              <MetricCard label="Active Deals" value={String(activeCount)} sub="deal + shipped + content pending" accent="sky" formula="deal + shipped + content_pending" />
              <MetricCard label="Content Pending" value={String(contentPending)} sub="product shipped, awaiting post" formula="shipped + content_pending" />
              <MetricCard label="Watchlist" value={String(watchlistCount)} sub="tracking, not outreached" accent="purple" formula="COUNT status='watchlist'" />
              <MetricCard label="Total Gifted" value={fmtMoney(stats?.allTime.totalGifted || 0)} sub={`${stats?.allTime.totalInfluencers || 0} total records`} formula="SUM(products_to_send price × qty) all time where shipped+" />
              <MetricCard label="Posts Received" value={String(stats?.thisMonth.posts || 0)} sub="this month" formula="COUNT content_posted_date in current month" />
            </div>
          </section>
        )}

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-2">
          {FILTERS.map(f => {
            const count = f.key === 'active' ? activeCount : f.key === 'all' ? rows.length : (pipeline[f.key] || 0);
            const showCount = f.key === 'pending_review' && pendingCount > 0;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`text-[11px] sm:text-xs tracking-wider uppercase px-3 py-1.5 rounded-md transition-colors inline-flex items-center gap-1.5 ${filter === f.key ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}>
                {f.label}
                {showCount && <span className={`text-[10px] rounded-full min-w-[16px] px-1 ${filter === f.key ? 'bg-[var(--primary-foreground)]/20' : 'bg-amber-500 text-white'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Search + Add */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by @handle…"
              className="w-full py-2.5 px-4 pl-9 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--ring)]" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] text-xs">🔍</span>
          </div>
          <button onClick={() => setShowForm(true)}
            className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-4 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
            + Add Influencer
          </button>
        </div>

        {/* Table / Cards */}
        {loading ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] text-sm">Loading…</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">
            <div className="text-3xl mb-2">💌</div>
            <div className="text-sm">{search ? `No influencers match "${search}"` : 'No influencers yet. Click "+ Add Influencer" to start.'}</div>
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
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[140px]">Niche</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[150px]">Content</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-center w-[110px]">Status</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[80px]">Products</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[90px]">Deal</th>
                    <th className="px-2 pr-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[90px]">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredRows.map(r => {
                    const niches = r.niche_tags || [];
                    const cts = r.content_types || [];
                    const productCount = (r.products_to_send || []).length;
                    return (
                      <tr key={r.id} onClick={() => setSelectedId(r.id)} className="cursor-pointer hover:bg-[var(--accent)]/40 transition-colors">
                        <td className="pl-4 pr-2 py-3">
                          <a href={igUrl(r.instagram_handle)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            className="text-sm font-semibold text-[var(--foreground)] hover:text-sky-600 hover:underline">{r.instagram_handle}</a>
                          <div className="text-[10px] text-[var(--muted-foreground)]">via {r.created_by || 'admin'}</div>
                        </td>
                        <td className="px-2 py-3 text-right text-sm text-[var(--foreground)] tabular-nums">{fmtFollowers(r.follower_count)}</td>
                        <td className={`px-2 py-3 text-right text-sm font-semibold tabular-nums ${engagementTone(r.engagement_rate)}`}>{r.engagement_rate !== null ? `${r.engagement_rate}%` : '—'}</td>
                        <td className="px-2 py-3 text-xs text-[var(--muted-foreground)]">
                          {niches.length === 0 ? '—' : <span className="truncate inline-block max-w-[120px] align-middle">{niches[0]}{niches.length > 1 && <span className="text-[10px]"> +{niches.length - 1}</span>}</span>}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex flex-wrap gap-1">
                            {cts.slice(0, 2).map(c => <span key={c} className="text-[9px] bg-sky-50 border border-sky-200/70 px-1.5 py-0.5 rounded text-sky-700">{c}</span>)}
                            {cts.length > 2 && <span className="text-[9px] text-[var(--muted-foreground)]">+{cts.length - 2}</span>}
                            {cts.length === 0 && <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center"><StatusBadge status={r.status} /></td>
                        <td className="px-2 py-3 text-xs text-[var(--muted-foreground)]">{productCount > 0 ? `${productCount} item${productCount !== 1 ? 's' : ''}` : '—'}</td>
                        <td className="px-2 py-3 text-xs text-[var(--muted-foreground)]">{r.deal_type || '—'}</td>
                        <td className="px-2 pr-4 py-3 text-xs text-[var(--muted-foreground)]">{fmtDate(r.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden flex flex-col gap-2">
              {filteredRows.map(r => (
                <div key={r.id} onClick={() => setSelectedId(r.id)} className="p-4 bg-[var(--card)] rounded-xl border border-[var(--border)] active:bg-[var(--accent)] shadow-sm">
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-semibold text-[var(--foreground)]">{r.instagram_handle}</div>
                      <div className="text-xs">
                        <span className="text-[var(--muted-foreground)]">{fmtFollowers(r.follower_count)} followers · </span>
                        <span className={`font-semibold ${engagementTone(r.engagement_rate)}`}>{r.engagement_rate ? `${r.engagement_rate}%` : '—'}</span>
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{fmtDate(r.created_at)} · via {r.created_by}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {showForm && <SubmitForm role={role} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); flash('Submitted ✓'); fetchAll(); }} />}
      {selected && <DetailPanel role={role} influencer={selected} onClose={() => setSelectedId(null)} onRefresh={fetchAll} flash={flash} />}
    </div>
  );
}

/* ─── Guidelines Panel ─── */

function GuidelinesPanel() {
  return (
    <section className="bg-[var(--muted)]/50 border border-[var(--border)] rounded-xl p-5 space-y-4 text-sm">
      <div>
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2">Ideal Profile</div>
        <ul className="text-sm text-[var(--foreground)] space-y-1 list-disc list-inside">
          <li>5,000–50,000 followers</li>
          <li>3.5%+ engagement rate (minimum 3%)</li>
          <li>Audience: Orthodox Jewish, LDS/Mormon, or modest fashion enthusiasts</li>
          <li>US-based (especially NY/NJ, Utah, Florida, California) or Israel</li>
          <li>Clean, lifestyle-oriented content showing outfits in real settings</li>
          <li>Has done brand collabs before</li>
        </ul>
      </div>
      <div>
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2">Example of a Great Past Fit</div>
        <p className="text-sm text-[var(--foreground)]"><b>@sophiathejew</b> — Orthodox lifestyle creator who organically shared Miss Finch products. Strong community engagement, authentic content, perfect audience overlap. She&apos;s no longer active but represents exactly what we look for.</p>
      </div>
      <div>
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2">Red Flags</div>
        <ul className="text-sm text-[var(--foreground)] space-y-1 list-disc list-inside">
          <li>Engagement under 3% = likely fake/dead audience</li>
          <li>Niche mismatch = their audience won&apos;t buy modest midi dresses</li>
          <li>Asking &gt;$200 for &lt;20K followers = not worth it</li>
          <li>No modest fashion content in feed</li>
        </ul>
      </div>
      <div>
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2">Deal Tiers</div>
        <ul className="text-sm text-[var(--foreground)] space-y-1 list-disc list-inside">
          <li><b>Under 10K:</b> gifted only (1–2 items, no payment)</li>
          <li><b>10K–25K:</b> gifted (2–3 items), maybe $50–100 for exceptional content</li>
          <li><b>25K–50K:</b> gifted (2–3 items) + up to $200–300 for a reel</li>
          <li><b>50K+:</b> discuss with Ryan — case by case</li>
          <li>Always start gifted-only. Only add payment if they push back AND justify it.</li>
        </ul>
      </div>
    </section>
  );
}

/* ─── Submit Form ─── */

function SubmitForm({ role, onClose, onCreated }: { role: Role; onClose: () => void; onCreated: () => void }) {
  const [handle, setHandle] = useState('');
  const [followers, setFollowers] = useState('');
  const [engagement, setEngagement] = useState('');
  const [niches, setNiches] = useState<string[]>([]);
  const [content, setContent] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [askedFor, setAskedFor] = useState('');
  const [alreadyContacted, setAlreadyContacted] = useState(false);
  const [formProducts, setFormProducts] = useState<Product[]>([]);
  const [scraped, setScraped] = useState<ScrapedData | null>(null);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  const [scrapeState, setScrapeState] = useState<'idle' | 'loading' | 'manual' | 'done' | 'fail'>('idle');
  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalProductValue = formProducts.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.quantity) || 1), 0);
  const fNum = parseInt(followers) || 0;
  const eNum = parseFloat(engagement) || 0;

  const warnings: string[] = [];
  if (fNum > 50000) warnings.push('Above micro range (5K–50K). Larger accounts typically want paid deals.');
  if (fNum > 0 && fNum < 2000) warnings.push('Very small. May not generate meaningful reach.');
  if (eNum > 0 && eNum < 3) warnings.push('Below 3% minimum engagement.');
  if (niches.length === 1 && niches[0] === 'Other') warnings.push('Not in core modest fashion niches. Explain fit.');
  if (alreadyContacted) warnings.push('Ryan may have already been in touch.');
  if (formProducts.length > 3) warnings.push('More than 3 items — Ryan may counter.');
  if (totalProductValue > 500) warnings.push('High total retail value. Make sure the account size justifies it.');

  const doScrape = async () => {
    const clean = handle.replace(/^@/, '').trim();
    if (!clean) return;
    setScrapeState('loading');
    try {
      const res = await fetch(`/api/influencers/scrape?handle=${encodeURIComponent(clean)}`);
      const d = await res.json();
      if (d.profile) {
        setScraped(d.profile);
        setScrapedAt(d.scraped_at || new Date().toISOString());
        setFollowers(String(d.profile.followersCount || ''));
        setEngagement(String(d.profile.engagementRate || ''));
        setScrapeState('done');
      } else if (d.manual) {
        setScrapeState('manual');
      } else {
        setScrapeState('fail');
      }
    } catch {
      setScrapeState('fail');
    }
  };

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const submit = async (status?: 'watchlist') => {
    if (!handle.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/influencers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instagram_handle: handle.trim(),
        profile_url: igUrl(handle),
        follower_count: fNum || null,
        engagement_rate: eNum || null,
        niche_tags: niches,
        content_types: content,
        bio_notes: notes.trim() || null,
        dm_context: askedFor.trim() || null,
        already_contacted: alreadyContacted,
        products_to_send: formProducts,
        scraped_data: scraped,
        scraped_at: scrapedAt,
        created_by: role,
        status: status || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) onCreated();
    else alert('Submission failed');
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 sm:inset-auto sm:top-[3%] sm:left-1/2 sm:-translate-x-1/2 sm:w-[600px] sm:max-h-[94vh] bg-[var(--card)] sm:rounded-2xl shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-heading text-xl font-semibold text-[var(--foreground)]">{showReview ? 'Review & Submit' : 'New Influencer'}</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
        </div>

        {!showReview ? (
          <div className="p-5 space-y-5">
            <div className="text-[11px] text-[var(--muted-foreground)]">Submitting as <b className="text-[var(--foreground)]">{role}</b></div>

            {/* Handle + scrape */}
            <Field label="Instagram Handle *">
              <div className="flex gap-2">
                <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@username"
                  className="flex-1 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] focus:outline-none focus:border-[var(--ring)]" />
                {handle.trim() && (
                  <a href={igUrl(handle)} target="_blank" rel="noreferrer"
                    className="px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs text-sky-600 hover:bg-[var(--accent)] inline-flex items-center whitespace-nowrap">View Profile ↗</a>
                )}
              </div>
              {handle.trim() && scrapeState === 'idle' && (
                <button onClick={doScrape} className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:opacity-90">
                  ✨ Fetch Stats from Instagram
                </button>
              )}
              {scrapeState === 'loading' && (
                <div className="mt-2 text-xs text-[var(--muted-foreground)] flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-[var(--ring)]/30 border-t-[var(--ring)] rounded-full animate-spin" />
                  Scraping profile… (this can take 30–60 seconds)
                </div>
              )}
              {scrapeState === 'fail' && <div className="mt-2 text-xs text-red-600">Couldn&apos;t fetch stats. Enter manually below.</div>}
              {scrapeState === 'manual' && <div className="mt-2 text-xs text-amber-700">Scraper not configured. Enter stats manually.</div>}
            </Field>

            {/* Scrape preview */}
            {scraped && (
              <div className="bg-sky-50/50 border border-sky-200/70 rounded-xl p-4 flex gap-3">
                {scraped.profilePicUrl && <img src={scraped.profilePicUrl} alt="" className="w-14 h-14 rounded-full object-cover" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--foreground)]">{scraped.fullName || `@${scraped.username}`}</span>
                    {scraped.isVerified && <span className="text-[10px] text-sky-600">✓</span>}
                    {scraped.isBusinessAccount && <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200/70 rounded px-1.5 py-0.5">Business</span>}
                  </div>
                  <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 line-clamp-3">{scraped.biography}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)] mt-1">
                    {fmtFollowers(scraped.followersCount)} followers · {scraped.postsCount} posts · {scraped.engagementRate}% engagement
                  </div>
                </div>
              </div>
            )}

            {/* Manual stats */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Follower Count">
                <input type="number" value={followers} onChange={e => setFollowers(e.target.value)} placeholder="15000"
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] focus:outline-none focus:border-[var(--ring)]" />
              </Field>
              <Field label="Engagement (%)">
                <input type="number" step="0.1" value={engagement} onChange={e => setEngagement(e.target.value)} placeholder="3.5"
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] focus:outline-none focus:border-[var(--ring)]" />
              </Field>
            </div>

            <Field label="Niche">
              <div className="flex flex-wrap gap-2">
                {NICHES.map(n => (
                  <button key={n} type="button" onClick={() => toggle(niches, setNiches, n)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${niches.includes(n) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Content Types">
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map(c => (
                  <button key={c} type="button" onClick={() => toggle(content, setContent, c)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${content.includes(c) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Products Requested">
              <ProductPicker products={formProducts} setProducts={setFormProducts} />
              {formProducts.length > 0 && (
                <div className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                  Total retail value: <span className="font-semibold text-[var(--foreground)]">${totalProductValue.toFixed(0)}</span> ({formProducts.length} item{formProducts.length !== 1 ? 's' : ''})
                </div>
              )}
            </Field>

            <Field label="Why this influencer?">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Audience, aesthetic, engagement quality, fit with Miss Finch…"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] focus:outline-none focus:border-[var(--ring)] resize-y" />
            </Field>

            <Field label="DM context — what did they ask for?">
              <textarea value={askedFor} onChange={e => setAskedFor(e.target.value)} rows={3} placeholder="Paste DM summary: which products, sizes, payment discussion…"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] focus:outline-none focus:border-[var(--ring)] resize-y" />
            </Field>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={alreadyContacted} onChange={e => setAlreadyContacted(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-[var(--foreground)]">Ryan may have already contacted</span>
            </label>

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-4 space-y-2">
                <div className="text-[11px] text-amber-700 uppercase tracking-wider font-semibold">Heads Up</div>
                {warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 leading-relaxed">• {w}</div>)}
                <div className="text-[10px] text-amber-600/80 italic">Guidance, not blockers.</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={() => setShowReview(true)} disabled={!handle.trim() || !notes.trim()}
                className="flex-1 min-w-[140px] py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                Review →
              </button>
              {role === 'admin' && (
                <button onClick={() => submit('watchlist')} disabled={!handle.trim() || submitting}
                  className="py-3 px-4 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  Save to Watchlist
                </button>
              )}
              <button onClick={onClose} className="px-4 py-3 text-sm text-[var(--muted-foreground)]">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-[var(--muted)]/40 border border-[var(--border)] rounded-xl p-4 space-y-3">
              <div>
                <div className="font-heading text-lg font-semibold text-[var(--foreground)]">{handle.startsWith('@') ? handle : `@${handle}`}</div>
                <div className="text-xs">
                  <span className="text-[var(--muted-foreground)]">{fNum ? `${fmtFollowers(fNum)} followers` : '—'} · </span>
                  <span className={engagementTone(eNum)}>{eNum ? `${eNum}% engagement` : '—'}</span>
                </div>
              </div>
              {niches.length > 0 && <div><div className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-[var(--muted-foreground)]">Niches</div><div className="flex flex-wrap gap-1.5">{niches.map(n => <span key={n} className="text-[11px] bg-[var(--card)] border border-[var(--border)] px-2 py-0.5 rounded-lg">{n}</span>)}</div></div>}
              {content.length > 0 && <div><div className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-[var(--muted-foreground)]">Content</div><div className="flex flex-wrap gap-1.5">{content.map(c => <span key={c} className="text-[11px] bg-sky-50 border border-sky-200/70 text-sky-700 px-2 py-0.5 rounded-lg">{c}</span>)}</div></div>}
              {formProducts.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-[var(--muted-foreground)]">Products — ${totalProductValue.toFixed(0)} total</div>
                  <div className="space-y-1">
                    {formProducts.map((p, i) => <div key={i} className="text-xs text-[var(--foreground)]">• {p.title} × {p.quantity || 1} — ${(p.price || 0).toFixed(0)}</div>)}
                  </div>
                </div>
              )}
              {notes && <div><div className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-[var(--muted-foreground)]">Why</div><div className="text-sm whitespace-pre-wrap">{notes}</div></div>}
              {askedFor && <div><div className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-[var(--muted-foreground)]">DM Context</div><div className="text-sm whitespace-pre-wrap">{askedFor}</div></div>}
              {alreadyContacted && <div className="text-xs text-amber-700">⚠ Ryan may have already contacted</div>}
            </div>
            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-4 space-y-1">
                <div className="text-[11px] text-amber-700 uppercase tracking-wider font-semibold">Heads Up</div>
                {warnings.map((w, i) => <div key={i} className="text-xs text-amber-700">• {w}</div>)}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => submit()} disabled={submitting} className="flex-1 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit for Review'}
              </button>
              <button onClick={() => setShowReview(false)} className="px-5 py-3 text-sm text-[var(--muted-foreground)]">← Edit</button>
            </div>
          </div>
        )}
      </div>
    </div>
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

/* ─── Detail Panel ─── */

function DetailPanel({ role, influencer, onClose, onRefresh, flash }: {
  role: Role; influencer: Influencer; onClose: () => void; onRefresh: () => void; flash: (m: string) => void;
}) {
  const isAdmin = role === 'admin';
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteName, setNoteName] = useState(role === 'admin' ? 'Ryan' : '');
  const [busy, setBusy] = useState(false);

  // Counter UI
  const [showCounter, setShowCounter] = useState(false);
  const [counterNote, setCounterNote] = useState('');

  // Decline UI
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Delete UI
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Deal editor
  const [dealOpen, setDealOpen] = useState(false);
  const [dealType, setDealType] = useState(influencer.deal_type || 'gifted_only');
  const [payment, setPayment] = useState(String(influencer.payment_amount || 0));
  const [products, setProducts] = useState<Product[]>(influencer.products_to_send || []);
  const [deliverables, setDeliverables] = useState(influencer.deliverables || '');
  const [expectedDate, setExpectedDate] = useState(influencer.expected_post_date || '');
  const [specialInstructions, setSpecialInstructions] = useState(influencer.special_instructions || '');
  const [discountCode, setDiscountCode] = useState(influencer.discount_code || '');
  const [ship, setShip] = useState<ShippingAddr>(influencer.shipping_address || {});

  // Resubmit editor (intern)
  const [editMode, setEditMode] = useState(false);
  const [resubNotes, setResubNotes] = useState(influencer.bio_notes || '');
  const [resubDm, setResubDm] = useState(influencer.dm_context || '');
  const [resubProducts, setResubProducts] = useState<Product[]>(influencer.products_to_send || []);

  // Content editor
  const [contentOpen, setContentOpen] = useState(false);
  const [contentUrls, setContentUrls] = useState<string[]>(influencer.content_urls || []);
  const [newContentUrl, setNewContentUrl] = useState('');
  const [postedDate, setPostedDate] = useState(influencer.content_posted_date || new Date().toISOString().slice(0, 10));
  const [contentTypes, setContentTypes] = useState<string[]>(influencer.content_type_posted || []);
  const [mReach, setMReach] = useState('');
  const [mImpressions, setMImpressions] = useState('');
  const [mEngagement, setMEngagement] = useState('');

  const loadThread = useCallback(async () => {
    const r = await fetch(`/api/influencers/notes?influencer_id=${influencer.id}`).then(r => r.json());
    setNotes(r.notes || []);
    setActivity(r.activity || []);
  }, [influencer.id]);

  useEffect(() => { loadThread(); }, [loadThread]);

  const addNote = async () => {
    if (!newNote.trim() || !noteName.trim()) return;
    setBusy(true);
    await fetch('/api/influencers/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencer_id: influencer.id, user_name: noteName, user_role: role, note_text: newNote.trim() }),
    });
    setNewNote('');
    setBusy(false);
    loadThread();
  };

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(true);
    const res = await fetch('/api/influencers', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: influencer.id, action, user_role: role, ...body }),
    });
    setBusy(false);
    if (!res.ok) { flash('Action failed'); return false; }
    onRefresh();
    loadThread();
    return true;
  };

  const createShopifyDraft = async () => {
    setBusy(true);
    const res = await fetch('/api/influencers/shopify-draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencer_id: influencer.id }),
    });
    const d = await res.json();
    if (res.ok) {
      flash(`Draft created: ${d.draft?.name}`);
      // Auto-advance to shipped per spec
      await fetch('/api/influencers', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: influencer.id, action: 'mark_shipped', user_role: role }),
      });
      onRefresh();
    } else {
      flash(`Error: ${d.error || 'Failed'}`);
    }
    setBusy(false);
  };

  const saveDeal = async () => {
    await act('set_deal', {
      deal_type: dealType, payment_amount: parseFloat(payment) || 0,
      products_to_send: products, deliverables,
      expected_post_date: expectedDate || null, special_instructions: specialInstructions,
      discount_code: discountCode, shipping_address: ship,
    });
    flash('Deal saved');
    setDealOpen(false);
  };

  const logContent = async (markComplete: boolean) => {
    await act('log_content', {
      content_urls: contentUrls, content_posted_date: postedDate,
      content_type_posted: contentTypes, mark_complete: markComplete,
    });
    if (mReach || mImpressions || mEngagement) {
      await act('update_fields', {
        post_reach: mReach ? parseInt(mReach) : undefined,
        post_impressions: mImpressions ? parseInt(mImpressions) : undefined,
        post_engagement: mEngagement ? parseInt(mEngagement) : undefined,
      });
    }
    flash(markComplete ? 'Complete ✓' : 'Content logged');
    setContentOpen(false);
  };

  const rescrape = async () => {
    setBusy(true);
    const res = await fetch(`/api/influencers/scrape?handle=${encodeURIComponent(influencer.instagram_handle)}`);
    const d = await res.json();
    if (d.profile) {
      await act('update_fields', {
        scraped_data: d.profile,
        scraped_at: d.scraped_at,
        follower_count: d.profile.followersCount,
        engagement_rate: d.profile.engagementRate,
      });
      flash('Refreshed ✓');
    } else {
      flash('Scrape failed');
    }
    setBusy(false);
  };

  const deleteRecord = async () => {
    setBusy(true);
    const res = await fetch(`/api/influencers?id=${influencer.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) { flash('Deleted'); onRefresh(); onClose(); }
    else flash('Delete failed');
  };

  const resubmit = async () => {
    await act('resubmit', {
      bio_notes: resubNotes, dm_context: resubDm, products_to_send: resubProducts,
    });
    flash('Resubmitted for review');
    setEditMode(false);
  };

  const s = influencer.status;
  const showDeal = ['approved', 'deal', 'shipped', 'content_pending', 'posted', 'complete'].includes(s);
  const showContentSection = ['shipped', 'content_pending', 'posted', 'complete'].includes(s);
  const scraped = influencer.scraped_data;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Panel>
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            {scraped?.profilePicUrl && <img src={scraped.profilePicUrl} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <a href={igUrl(influencer.instagram_handle)} target="_blank" rel="noreferrer"
                  className="font-heading text-xl font-semibold text-[var(--foreground)] hover:text-sky-600 hover:underline truncate">{influencer.instagram_handle} ↗</a>
                <StatusBadge status={s} />
                {scraped?.isVerified && <span className="text-[10px] text-sky-600">✓ Verified</span>}
              </div>
              {scraped?.fullName && <div className="text-xs text-[var(--foreground)] mt-0.5">{scraped.fullName}</div>}
              <div className="text-xs mt-1">
                <span className="text-[var(--muted-foreground)]">{fmtFollowers(influencer.follower_count)} followers · </span>
                <span className={`font-semibold ${engagementTone(influencer.engagement_rate)}`}>{influencer.engagement_rate !== null ? `${influencer.engagement_rate}%` : '—'}</span>
                {scraped && <span className="text-[var(--muted-foreground)]"> · {scraped.postsCount} posts</span>}
              </div>
              {influencer.scraped_at && (
                <div className="text-[10px] text-[var(--muted-foreground)] mt-1 flex items-center gap-2">
                  Scraped {fmtDate(influencer.scraped_at)}
                  {isAdmin && <button onClick={rescrape} disabled={busy} className="text-sky-600 hover:underline">Refresh</button>}
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
          </div>

          {/* Declined banner */}
          {s === 'declined' && influencer.declined_reason && (
            <div className="bg-red-50 border border-red-200/70 rounded-xl p-3 text-sm text-red-700">
              <div className="uppercase tracking-wider font-semibold text-[11px] mb-1">Declined</div>
              <div className="whitespace-pre-wrap text-xs">{influencer.declined_reason}</div>
            </div>
          )}

          {/* Counter banner */}
          {s === 'countered' && (influencer.counter_note || influencer.declined_reason) && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-sm text-amber-900">
              <div className="uppercase tracking-wider font-bold text-[11px] mb-1">⚠ Ryan&apos;s feedback</div>
              <div className="whitespace-pre-wrap">{influencer.counter_note || influencer.declined_reason}</div>
              {!isAdmin && !editMode && (
                <button onClick={() => setEditMode(true)} className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold">
                  Edit & Resubmit
                </button>
              )}
            </div>
          )}

          {/* Quick Actions Bar */}
          <QuickActions
            status={s} isAdmin={isAdmin} busy={busy}
            onApprove={() => act('approve').then(ok => ok && flash('Approved ✓'))}
            onShowCounter={() => setShowCounter(true)}
            onShowDecline={() => setShowDecline(true)}
            onWatchlist={() => act('add_to_watchlist').then(ok => ok && flash('On watchlist'))}
            onMoveToPending={() => act('move_to_pending').then(ok => ok && flash('Moved to pending'))}
            onSetUpDeal={() => setDealOpen(true)}
            onCreateOrder={createShopifyDraft}
            onMarkShipped={() => act('mark_shipped').then(ok => ok && flash('Marked shipped'))}
            onContentPending={() => act('mark_content_pending').then(ok => ok && flash('Content pending'))}
            onLogContent={() => setContentOpen(true)}
            onMarkComplete={() => act('mark_complete').then(ok => ok && flash('Complete ✓'))}
          />

          {/* Counter inline */}
          {showCounter && (
            <div className="space-y-2 bg-amber-50/30 border border-amber-200/70 rounded-xl p-3">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-700">Counter note</div>
              <div className="flex flex-wrap gap-1.5">
                {COUNTER_QUICK_FILLS.map(t => (
                  <button key={t} onClick={() => setCounterNote(counterNote ? `${counterNote}\n${t}` : t)}
                    className="text-[10px] bg-[var(--card)] border border-[var(--border)] px-2 py-1 rounded hover:bg-[var(--accent)]">+ {t}</button>
                ))}
              </div>
              <textarea value={counterNote} onChange={e => setCounterNote(e.target.value)} rows={3} placeholder="What should the intern change?"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--ring)]" />
              <div className="flex gap-2">
                <button onClick={async () => { if (!counterNote.trim()) return; const ok = await act('counter', { counter_note: counterNote }); if (ok) { flash('Counter sent'); setShowCounter(false); setCounterNote(''); } }}
                  disabled={!counterNote.trim() || busy} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">Send Counter</button>
                <button onClick={() => setShowCounter(false)} className="px-4 py-2.5 text-sm text-[var(--muted-foreground)]">Cancel</button>
              </div>
            </div>
          )}

          {/* Decline inline */}
          {showDecline && (
            <div className="space-y-2">
              <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} placeholder="Reason (required)…"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--ring)]" />
              <div className="flex gap-2">
                <button onClick={async () => { if (!declineReason.trim()) return; const ok = await act('decline', { declined_reason: declineReason }); if (ok) { flash('Declined'); setShowDecline(false); } }}
                  disabled={!declineReason.trim() || busy} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">Confirm Decline</button>
                <button onClick={() => { setShowDecline(false); setDeclineReason(''); }} className="px-4 py-2.5 text-sm text-[var(--muted-foreground)]">Cancel</button>
              </div>
            </div>
          )}

          {/* Intern edit mode (resubmit) */}
          {editMode && !isAdmin && (
            <section className="border-2 border-amber-300 rounded-xl p-4 space-y-3 bg-amber-50/20">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-700">Edit for Resubmission</div>
              <Field label="Why this influencer?">
                <textarea value={resubNotes} onChange={e => setResubNotes(e.target.value)} rows={3}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--ring)]" />
              </Field>
              <Field label="DM context">
                <textarea value={resubDm} onChange={e => setResubDm(e.target.value)} rows={2}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--ring)]" />
              </Field>
              <Field label="Products">
                <ProductPicker products={resubProducts} setProducts={setResubProducts} />
              </Field>
              <div className="flex gap-2">
                <button onClick={resubmit} disabled={busy} className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold">Resubmit for Review</button>
                <button onClick={() => setEditMode(false)} className="px-4 py-2.5 text-sm text-[var(--muted-foreground)]">Cancel</button>
              </div>
            </section>
          )}

          {/* Profile & Vetting */}
          <section className="bg-[var(--muted)]/50 rounded-xl p-4 space-y-2">
            <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Vetting Info</div>
            <div className="flex flex-wrap gap-1.5">
              {(influencer.niche_tags || []).map(n => <span key={n} className="text-[10px] bg-[var(--card)] border border-[var(--border)] px-2 py-0.5 rounded-lg text-[var(--muted-foreground)]">{n}</span>)}
              {(influencer.content_types || []).map(c => <span key={c} className="text-[10px] bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-lg text-sky-700">{c}</span>)}
            </div>
            {scraped?.biography && <div className="text-xs text-[var(--muted-foreground)] italic whitespace-pre-wrap">{scraped.biography}</div>}
            {influencer.bio_notes && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">Why</div>
                <div className="text-sm whitespace-pre-wrap">{influencer.bio_notes}</div>
              </div>
            )}
            {influencer.dm_context && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-1">DM Context</div>
                <div className="text-sm whitespace-pre-wrap">{influencer.dm_context}</div>
              </div>
            )}
            {influencer.already_contacted && <div className="text-[11px] text-amber-700">⚠ Ryan may have already contacted</div>}
            {scraped?.externalUrl && <a href={scraped.externalUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">{scraped.externalUrl}</a>}
          </section>

          {/* Products Requested */}
          <section className="border border-[var(--border)] rounded-xl p-4 space-y-3">
            <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Products Requested</div>
            {(influencer.products_to_send || []).length === 0 ? (
              <div className="text-xs text-[var(--muted-foreground)] italic">No products selected</div>
            ) : (
              <div className="space-y-2">
                {(influencer.products_to_send || []).map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-[var(--muted)]/40 rounded-lg">
                    {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-[var(--muted)]" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.title}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">qty {p.quantity || 1} · ${(p.price || 0).toFixed(0)}</div>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-[var(--muted-foreground)]">
                  Total retail value: <b className="text-[var(--foreground)]">${(influencer.products_to_send || []).reduce((s, p) => s + (p.price || 0) * (p.quantity || 1), 0).toFixed(0)}</b>
                </div>
              </div>
            )}
          </section>

          {/* Deal Terms */}
          {showDeal && (
            <section className="border border-[var(--border)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Deal Terms</div>
                {isAdmin && <button onClick={() => setDealOpen(v => !v)} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">{dealOpen ? 'Close' : 'Edit'}</button>}
              </div>
              {!dealOpen ? (
                <div className="text-sm space-y-1">
                  <div><span className="text-[var(--muted-foreground)]">Type:</span> {influencer.deal_type || '—'}</div>
                  <div><span className="text-[var(--muted-foreground)]">Payment:</span> {fmtMoney(influencer.payment_amount || 0)}</div>
                  <div><span className="text-[var(--muted-foreground)]">Deliverables:</span> {influencer.deliverables || '—'}</div>
                  <div><span className="text-[var(--muted-foreground)]">Expected post:</span> {fmtDate(influencer.expected_post_date)}</div>
                  {influencer.discount_code && <div><span className="text-[var(--muted-foreground)]">Code:</span> {influencer.discount_code}</div>}
                  {influencer.special_instructions && <div><span className="text-[var(--muted-foreground)]">Notes:</span> {influencer.special_instructions}</div>}
                </div>
              ) : (
                <div className="space-y-3">
                  <Field label="Deal Type">
                    <select value={dealType} onChange={e => setDealType(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm">
                      <option value="gifted_only">Gifted only</option>
                      <option value="gifted_paid">Gifted + paid</option>
                      <option value="paid_only">Paid only</option>
                      <option value="affiliate">Affiliate</option>
                    </select>
                  </Field>
                  <Field label="Payment ($)">
                    <input type="number" value={payment} onChange={e => setPayment(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
                  </Field>
                  <Field label="Products"><ProductPicker products={products} setProducts={setProducts} /></Field>
                  <Field label="Deliverables">
                    <textarea value={deliverables} onChange={e => setDeliverables(e.target.value)} rows={2} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Expected post"><input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
                    <Field label="Discount code"><input value={discountCode} onChange={e => setDiscountCode(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
                  </div>
                  <Field label="Special instructions">
                    <textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} rows={2} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" />
                  </Field>
                  <div className="border-t border-[var(--border)] pt-3 space-y-2">
                    <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Shipping</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={ship.firstName || ''} onChange={e => setShip({ ...ship, firstName: e.target.value })} placeholder="First" className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                      <input value={ship.lastName || ''} onChange={e => setShip({ ...ship, lastName: e.target.value })} placeholder="Last" className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                    </div>
                    <input value={ship.address1 || ''} onChange={e => setShip({ ...ship, address1: e.target.value })} placeholder="Address" className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                    <input value={ship.address2 || ''} onChange={e => setShip({ ...ship, address2: e.target.value })} placeholder="Apt / Suite" className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <input value={ship.city || ''} onChange={e => setShip({ ...ship, city: e.target.value })} placeholder="City" className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                      <input value={ship.province || ''} onChange={e => setShip({ ...ship, province: e.target.value })} placeholder="State" className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                      <input value={ship.zip || ''} onChange={e => setShip({ ...ship, zip: e.target.value })} placeholder="ZIP" className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                    </div>
                  </div>
                  <button onClick={saveDeal} disabled={busy} className="w-full py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold">Save Deal</button>
                </div>
              )}
            </section>
          )}

          {/* Shopify Order */}
          {influencer.shopify_order_name && (
            <section className="border border-[var(--border)] rounded-xl p-4">
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-1">Shopify Order</div>
              <div className="text-sm text-emerald-600 font-medium">✓ {influencer.shopify_order_name}</div>
            </section>
          )}

          {/* Content */}
          {showContentSection && (
            <section className="border border-[var(--border)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Content</div>
                <button onClick={() => setContentOpen(v => !v)} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">{contentOpen ? 'Close' : 'Log'}</button>
              </div>
              {(influencer.content_urls || []).length > 0 && !contentOpen && (
                <div className="space-y-1.5">
                  {(influencer.content_urls || []).map(u => <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-xs text-sky-600 hover:underline truncate">{u}</a>)}
                  <div className="text-xs text-[var(--muted-foreground)]">Posted {fmtDate(influencer.content_posted_date)}</div>
                  {(influencer.post_reach || influencer.post_impressions || influencer.post_engagement) && (
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {influencer.post_reach ? `${influencer.post_reach.toLocaleString()} reach` : ''}
                      {influencer.post_impressions ? ` · ${influencer.post_impressions.toLocaleString()} impressions` : ''}
                      {influencer.post_engagement ? ` · ${influencer.post_engagement.toLocaleString()} engagement` : ''}
                    </div>
                  )}
                </div>
              )}
              {contentOpen && (
                <div className="space-y-3">
                  <Field label="Post URLs">
                    <div className="space-y-2">
                      {contentUrls.map((u, i) => (
                        <div key={i} className="flex gap-2">
                          <input value={u} onChange={e => { const c = [...contentUrls]; c[i] = e.target.value; setContentUrls(c); }} className="flex-1 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                          <button onClick={() => setContentUrls(contentUrls.filter((_, j) => j !== i))} className="text-red-500 text-lg">×</button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input value={newContentUrl} onChange={e => setNewContentUrl(e.target.value)} placeholder="https://…" className="flex-1 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                        <button onClick={() => { if (newContentUrl.trim()) { setContentUrls([...contentUrls, newContentUrl.trim()]); setNewContentUrl(''); } }} className="px-3 py-2 text-xs bg-[var(--muted)] rounded-lg">Add</button>
                      </div>
                    </div>
                  </Field>
                  <Field label="Post Date"><input type="date" value={postedDate} onChange={e => setPostedDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
                  <Field label="Content Types">
                    <div className="flex flex-wrap gap-2">
                      {CONTENT_TYPES.map(c => (
                        <button key={c} onClick={() => setContentTypes(contentTypes.includes(c) ? contentTypes.filter(x => x !== c) : [...contentTypes, c])}
                          className={`text-xs px-3 py-1.5 rounded-lg border ${contentTypes.includes(c) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)]'}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Reach"><input type="number" value={mReach} onChange={e => setMReach(e.target.value)} placeholder={String(influencer.post_reach || '')} className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
                    <Field label="Impressions"><input type="number" value={mImpressions} onChange={e => setMImpressions(e.target.value)} placeholder={String(influencer.post_impressions || '')} className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
                    <Field label="Engagement"><input type="number" value={mEngagement} onChange={e => setMEngagement(e.target.value)} placeholder={String(influencer.post_engagement || '')} className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" /></Field>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => logContent(false)} disabled={busy} className="flex-1 py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold">Save</button>
                    {isAdmin && <button onClick={() => logContent(true)} disabled={busy} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold">Mark Complete</button>}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Notes thread */}
          <section className="border border-[var(--border)] rounded-xl p-4">
            <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Notes</div>
            <div className="space-y-3 mb-3 max-h-64 overflow-y-auto">
              {notes.length === 0 ? (
                <div className="text-xs text-[var(--muted-foreground)] italic">No notes yet</div>
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
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--ring)] resize-y" />
              <button onClick={addNote} disabled={!newNote.trim() || !noteName.trim() || busy} className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-xs font-semibold disabled:opacity-50">Add Note</button>
            </div>
          </section>

          {/* Activity log */}
          <section>
            <button onClick={() => setShowActivity(v => !v)} className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2 inline-flex items-center gap-1">
              {showActivity ? '▼' : '▶'} Activity Log
            </button>
            {showActivity && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activity.length === 0 ? (
                  <div className="text-xs text-[var(--muted-foreground)] italic">No activity yet</div>
                ) : activity.slice().reverse().map(a => (
                  <div key={a.id} className="text-xs text-[var(--muted-foreground)] flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--ring)]/50 flex-shrink-0" />
                    <div>
                      <span className="text-[var(--foreground)] font-medium">{a.action.replace(/_/g, ' ')}</span>
                      {a.user_role && <span className="ml-1 text-[10px]">· {a.user_role}</span>}
                      <span className="ml-2 text-[10px]">{new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Delete */}
          {isAdmin && (
            <section className="pt-4 border-t border-[var(--border)]">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-600 hover:underline font-medium">Delete this record</button>
              ) : (
                <div className="bg-red-50 border border-red-200/70 rounded-xl p-3 space-y-2">
                  <div className="text-xs text-red-700">Delete <b>{influencer.instagram_handle}</b>? This cannot be undone.</div>
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
      <div className="hidden md:block absolute top-0 right-0 h-full w-[540px] bg-[var(--card)] shadow-2xl overflow-y-auto animate-slide-right">{children}</div>
      <div className="md:hidden absolute bottom-0 left-0 right-0 bg-[var(--card)] rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl animate-slide-up">
        <div className="text-center pt-3 pb-1"><div className="w-9 h-1 bg-[var(--border)] rounded mx-auto" /></div>
        {children}
      </div>
    </>
  );
}

/* ─── Quick Actions Bar ─── */

function QuickActions(props: {
  status: string; isAdmin: boolean; busy: boolean;
  onApprove: () => void; onShowCounter: () => void; onShowDecline: () => void;
  onWatchlist: () => void; onMoveToPending: () => void; onSetUpDeal: () => void;
  onCreateOrder: () => void; onMarkShipped: () => void; onContentPending: () => void;
  onLogContent: () => void; onMarkComplete: () => void;
}) {
  const { status: s, isAdmin, busy } = props;
  const Btn = (label: string, onClick: () => void, color: string) => (
    <button onClick={onClick} disabled={busy}
      className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-white disabled:opacity-50 ${color}`}>
      {label}
    </button>
  );
  const buttons: React.ReactNode[] = [];
  if (isAdmin && (s === 'pending_review' || s === 'countered')) {
    buttons.push(Btn('Approve ✓', props.onApprove, 'bg-emerald-600'));
    buttons.push(Btn('Counter ↩', props.onShowCounter, 'bg-amber-500'));
    buttons.push(Btn('Decline ✗', props.onShowDecline, 'bg-red-600'));
    if (s === 'pending_review') buttons.push(Btn('Watchlist', props.onWatchlist, 'bg-purple-600'));
  }
  if (isAdmin && s === 'watchlist') {
    buttons.push(Btn('Move to Pending', props.onMoveToPending, 'bg-[var(--primary)] text-[var(--primary-foreground)]'));
  }
  if (isAdmin && s === 'approved') buttons.push(Btn('Set Up Deal →', props.onSetUpDeal, 'bg-sky-600'));
  if (isAdmin && s === 'deal') buttons.push(Btn('Create Order & Mark Shipped', props.onCreateOrder, 'bg-emerald-600'));
  if (isAdmin && s === 'shipped') buttons.push(Btn('Content Pending', props.onContentPending, 'bg-orange-500'));
  if (s === 'content_pending' || s === 'shipped') buttons.push(Btn('Log Content', props.onLogContent, 'bg-[var(--primary)] text-[var(--primary-foreground)]'));
  if (isAdmin && s === 'posted') buttons.push(Btn('Mark Complete ✓', props.onMarkComplete, 'bg-emerald-600'));

  if (buttons.length === 0) return null;
  return <div className="flex flex-wrap gap-2">{buttons}</div>;
}

/* ─── Product Picker ─── */

type ShopifyVariant = { id: string; title: string; sku: string | null; price: number; size: string; inStock: boolean; inventory: number | null };
type ShopifyProduct = { id: string; title: string; handle: string; image: string | null; variants: ShopifyVariant[] };

function ProductPicker({ products, setProducts }: { products: Product[]; setProducts: (p: Product[]) => void }) {
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

  return (
    <div className="space-y-2">
      {products.length > 0 && (
        <div className="space-y-1.5">
          {products.map((p, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[var(--muted)]/50 rounded-lg">
              {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--foreground)] truncate">{p.title}</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">${(p.price || 0).toFixed(2)} {p.sku ? `· SKU ${p.sku}` : ''}</div>
              </div>
              <input type="number" value={p.quantity || 1} onChange={e => { const c = [...products]; c[i] = { ...c[i], quantity: parseInt(e.target.value) || 1 }; setProducts(c); }} className="w-14 p-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-sm text-center" />
              <button onClick={() => setProducts(products.filter((_, j) => j !== i))} className="text-red-500 text-lg px-1">×</button>
            </div>
          ))}
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
