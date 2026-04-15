'use client';

import { useCallback, useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { MetricCard } from '@/components/MetricCard';

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
  already_contacted: boolean;
  status: string;
  declined_reason: string | null;
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
};

type Product = { title?: string; variantId?: string; price?: number; quantity?: number; sku?: string };
type ShippingAddr = { firstName?: string; lastName?: string; address1?: string; address2?: string; city?: string; province?: string; zip?: string; country?: string; phone?: string };

type Stats = {
  pipeline: Record<string, number>;
  thisMonth: { shipped: number; giftedValue: number; posts: number };
};

type NoteRow = { id: string; user_name: string; user_role: string; note_text: string; created_at: string };
type ActivityRow = { id: string; action: string; user_role: string | null; details: Record<string, unknown> | null; created_at: string };

const NICHE_OPTIONS = ['Orthodox/Frum', 'LDS/Mormon', 'Modest Fashion General', 'Hijabi/Muslim Modest', 'Other'];
const CONTENT_OPTIONS = ['Reels', 'Stories', 'Static Posts', 'TikTok'];

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  pending_review: { label: 'Pending', bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-700' },
  approved: { label: 'Approved', bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-700' },
  declined: { label: 'Declined', bg: 'bg-red-50 border-red-200/80', text: 'text-red-600' },
  deal: { label: 'Deal', bg: 'bg-sky-50 border-sky-200/80', text: 'text-sky-700' },
  shipped: { label: 'Shipped', bg: 'bg-blue-50 border-blue-200/80', text: 'text-blue-700' },
  content_pending: { label: 'Content Pending', bg: 'bg-orange-50 border-orange-200/80', text: 'text-orange-700' },
  posted: { label: 'Posted', bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-700' },
  complete: { label: '✓ Complete', bg: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-800' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending_review', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'active', label: 'Active' },
  { key: 'complete', label: 'Complete' },
  { key: 'declined', label: 'Declined' },
];

const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtNum = (n: number | null) => n === null || n === undefined ? '—' : n.toLocaleString();

type Role = 'admin' | 'intern';

export default function InfluencersPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [rows, setRows] = useState<Influencer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Influencer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [toast, setToast] = useState('');
  const [role, setRole] = useState<Role | null>(null);

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
    setRole(d.role);
    setAuthed(true);
    setPwErr('');
  };

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const fetchRows = useCallback(async () => {
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

  useEffect(() => { if (authed) fetchRows(); }, [authed, fetchRows]);

  const refreshSelected = async (id: string) => {
    const r = await fetch(`/api/influencers?status=all`).then(r => r.json());
    const found = (r.influencers || []).find((x: Influencer) => x.id === id);
    if (found) setSelected(found);
    fetchRows();
  };

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

  if (!role) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center text-[var(--muted-foreground)] text-sm">Loading…</div>;
  }

  const pipeline = stats?.pipeline || {};
  const pendingCount = pipeline.pending_review || 0;
  const activeCount = (pipeline.deal || 0) + (pipeline.shipped || 0) + (pipeline.content_pending || 0);
  const contentPending = (pipeline.shipped || 0) + (pipeline.content_pending || 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--primary)] text-[var(--primary-foreground)] px-7 py-3 rounded-full text-sm font-medium z-[200] shadow-xl">{toast}</div>}
      <Nav active="influencers" right={
        <button onClick={() => setShowForm(true)}
          className="text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-3 sm:px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          + Add Influencer
        </button>
      } />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">Influencer Tracker</h2>
          <button onClick={() => setShowGuidelines(v => !v)} className="text-[11px] tracking-wider uppercase text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-semibold">
            {showGuidelines ? '▼' : '▶'} Vetting Guidelines
          </button>
        </div>

        {showGuidelines && <GuidelinesPanel />}

        {/* Pipeline + This Month (admin only) */}
        {role === 'admin' && (
        <section>
          <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-3">Pipeline</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Pending Review" value={String(pendingCount)} sub="awaiting approval" accent="amber" formula="COUNT(status='pending_review'). New prospects submitted, not yet approved/declined." />
            <MetricCard label="Active Deals" value={String(activeCount)} sub="deal + shipped + content pending" accent="sky" formula="deal + shipped + content_pending. Active collabs in progress." />
            <MetricCard label="Content Pending" value={String(contentPending)} sub="waiting on post" formula="shipped + content_pending. Influencers who have product but haven't posted yet." />
            <MetricCard label="Shipped (Month)" value={String(stats?.thisMonth.shipped || 0)} sub="this month" formula="COUNT(status='shipped') where status_changed_at in current month." />
            <MetricCard label="Gifted Value" value={fmtMoney(stats?.thisMonth.giftedValue || 0)} sub="this month" formula="SUM(products_to_send.price × quantity) for shipped/posted/complete in current month." />
            <MetricCard label="Posts Received" value={String(stats?.thisMonth.posts || 0)} sub="this month" formula="COUNT where content_posted_date in current month." />
          </div>
        </section>
        )}

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-2">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`text-[11px] sm:text-xs tracking-wider uppercase px-3 py-1.5 rounded-md transition-colors ${filter === f.key ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}>
              {f.label}
              {f.key === 'pending_review' && pendingCount > 0 && <span className="ml-1.5 text-[10px] bg-amber-500 text-white rounded-full min-w-[16px] inline-block px-1">{pendingCount}</span>}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted-foreground)]">
            <div className="text-3xl mb-2">💌</div>
            <div className="text-sm">No influencers yet. Click &quot;+ Add Influencer&quot; to start.</div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                    <th className="pl-4 pr-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left">Handle</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-right w-[110px]">Followers</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-right w-[90px]">Engage</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[200px]">Niche</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-center w-[130px]">Status</th>
                    <th className="px-2 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[110px]">Deal</th>
                    <th className="px-2 pr-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-left w-[110px]">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map(r => {
                    const sm = STATUS_META[r.status] || STATUS_META.pending_review;
                    return (
                      <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-[var(--accent)]/40 transition-colors">
                        <td className="pl-4 pr-2 py-3">
                          <div className="text-sm font-semibold text-[var(--foreground)]">{r.instagram_handle}</div>
                          {r.created_by === 'intern' && <div className="text-[10px] text-[var(--muted-foreground)]">via intern</div>}
                        </td>
                        <td className="px-2 py-3 text-right text-sm text-[var(--foreground)]">{fmtNum(r.follower_count)}</td>
                        <td className="px-2 py-3 text-right text-sm text-[var(--foreground)]">{r.engagement_rate !== null ? `${r.engagement_rate}%` : '—'}</td>
                        <td className="px-2 py-3 text-xs text-[var(--muted-foreground)] truncate">{(r.niche_tags || []).join(', ') || '—'}</td>
                        <td className="px-2 py-3 text-center"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${sm.bg} ${sm.text}`}>{sm.label}</span></td>
                        <td className="px-2 py-3 text-xs text-[var(--muted-foreground)]">{r.deal_type || '—'}</td>
                        <td className="px-2 pr-4 py-3 text-xs text-[var(--muted-foreground)]">{fmtDate(r.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-2">
              {rows.map(r => {
                const sm = STATUS_META[r.status] || STATUS_META.pending_review;
                return (
                  <div key={r.id} onClick={() => setSelected(r)} className="p-4 bg-[var(--card)] rounded-xl border border-[var(--border)] active:bg-[var(--accent)] shadow-sm">
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="min-w-0 flex-1 mr-3">
                        <div className="font-semibold text-[var(--foreground)]">{r.instagram_handle}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{fmtNum(r.follower_count)} followers · {r.engagement_rate ? `${r.engagement_rate}%` : '—'}</div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${sm.bg} ${sm.text}`}>{sm.label}</span>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">{(r.niche_tags || []).join(', ')}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {showForm && <SubmitForm role={role} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); flash('Submitted for review ✓'); fetchRows(); }} />}
      {selected && <DetailPanel role={role} influencer={selected} onClose={() => setSelected(null)} onChange={refreshSelected} flash={flash} />}
    </div>
  );
}

/* ─── Submit Form ─── */

function SubmitForm({ role, onClose, onCreated }: { role: 'admin' | 'intern'; onClose: () => void; onCreated: () => void }) {
  const [handle, setHandle] = useState('');
  const [url, setUrl] = useState('');
  const [followers, setFollowers] = useState('');
  const [engagement, setEngagement] = useState('');
  const [niches, setNiches] = useState<string[]>([]);
  const [content, setContent] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [alreadyContacted, setAlreadyContacted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Auto-generate profile URL when handle entered
  useEffect(() => {
    if (handle && !url) {
      const clean = handle.replace(/^@/, '').trim();
      if (clean) setUrl(`https://instagram.com/${clean}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const warnings: string[] = [];
  const fNum = parseInt(followers) || 0;
  const eNum = parseFloat(engagement) || 0;
  if (fNum > 50000) warnings.push('Above micro-influencer range (5K-50K). Larger accounts typically want paid deals.');
  if (fNum > 0 && fNum < 2000) warnings.push('Very small account. Gifted product may not generate meaningful reach.');
  if (eNum > 0 && eNum < 3) warnings.push('Below our 3-4% minimum engagement target.');
  if (niches.length === 1 && niches[0] === 'Other') warnings.push('Not in core modest fashion niches. Explain audience fit in notes.');
  if (alreadyContacted) warnings.push('Ryan may have already been in touch — confirm before re-engaging.');

  const submit = async () => {
    if (!handle.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/influencers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instagram_handle: handle.trim(),
        profile_url: url.trim() || null,
        follower_count: fNum || null,
        engagement_rate: eNum || null,
        niche_tags: niches,
        content_types: content,
        bio_notes: notes.trim() || null,
        already_contacted: alreadyContacted,
        created_by: role,
      }),
    });
    setSubmitting(false);
    if (res.ok) onCreated();
    else alert('Failed to submit');
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 sm:inset-auto sm:top-[5%] sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] sm:max-h-[90vh] bg-[var(--card)] sm:rounded-2xl shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-heading text-xl font-semibold text-[var(--foreground)]">{showReview ? 'Review & Submit' : 'New Influencer'}</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
        </div>
        {showReview ? (
          <div className="p-5 space-y-4">
            <div className="bg-[var(--muted)]/40 border border-[var(--border)] rounded-xl p-4 space-y-3">
              <div>
                <div className="font-heading text-lg font-semibold text-[var(--foreground)]">{handle.startsWith('@') ? handle : `@${handle}`}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {fNum ? `${fNum.toLocaleString()} followers` : 'followers —'} · {eNum ? `${eNum}% engagement` : 'engagement —'}
                </div>
                {url && <a href={url} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">{url}</a>}
              </div>
              {niches.length > 0 && (
                <div>
                  <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-1">Niches</div>
                  <div className="flex flex-wrap gap-1.5">{niches.map(n => <span key={n} className="text-[11px] bg-[var(--card)] border border-[var(--border)] px-2 py-0.5 rounded-lg">{n}</span>)}</div>
                </div>
              )}
              {content.length > 0 && (
                <div>
                  <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-1">Content</div>
                  <div className="flex flex-wrap gap-1.5">{content.map(c => <span key={c} className="text-[11px] bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-lg text-sky-700">{c}</span>)}</div>
                </div>
              )}
              {notes && (
                <div>
                  <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-1">Why this influencer?</div>
                  <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{notes}</div>
                </div>
              )}
              {alreadyContacted && <div className="text-xs text-amber-700">⚠ Ryan may have already contacted</div>}
            </div>

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-4 space-y-2">
                <div className="text-[11px] text-amber-700 uppercase tracking-wider font-semibold">Heads Up</div>
                {warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 leading-relaxed">• {w}</div>)}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={submit} disabled={submitting}
                className="flex-1 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit for Review'}
              </button>
              <button onClick={() => setShowReview(false)} className="px-5 py-3 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">← Go Back</button>
            </div>
          </div>
        ) : (
        <div className="p-5 space-y-5">
          <div className="text-[11px] text-[var(--muted-foreground)]">Submitting as <b className="text-[var(--foreground)]">{role}</b></div>

          <Field label="Instagram Handle *">
            <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@username"
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:border-[var(--ring)]" />
          </Field>

          <Field label="Profile URL">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://instagram.com/username"
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:border-[var(--ring)]" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Follower Count">
              <input type="number" value={followers} onChange={e => setFollowers(e.target.value)} placeholder="15000"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:border-[var(--ring)]" />
            </Field>
            <Field label="Engagement Rate (%)">
              <input type="number" step="0.1" value={engagement} onChange={e => setEngagement(e.target.value)} placeholder="3.5"
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:border-[var(--ring)]" />
            </Field>
          </div>

          <Field label="Niche">
            <div className="flex flex-wrap gap-2">
              {NICHE_OPTIONS.map(n => (
                <button key={n} type="button" onClick={() => toggle(niches, setNiches, n)}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors ${niches.includes(n) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Content Types">
            <div className="flex flex-wrap gap-2">
              {CONTENT_OPTIONS.map(c => (
                <button key={c} type="button" onClick={() => toggle(content, setContent, c)}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors ${content.includes(c) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
                  {c}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Why this influencer?">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Audience, aesthetic, engagement quality, fit with Miss Finch…"
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:border-[var(--ring)] resize-y" />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={alreadyContacted} onChange={e => setAlreadyContacted(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-[var(--foreground)]">Ryan may have already contacted them</span>
          </label>

          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-4 space-y-2">
              <div className="text-[11px] text-amber-700 uppercase tracking-wider font-semibold">Heads Up</div>
              {warnings.map((w, i) => (
                <div key={i} className="text-xs text-amber-700 leading-relaxed">• {w}</div>
              ))}
              <div className="text-[10px] text-amber-600/80 italic">These are guidance, not blockers — submit anyway if you think this influencer is a good fit.</div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowReview(true)} disabled={!handle.trim() || !notes.trim()}
              className="flex-1 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              Review →
            </button>
            <button onClick={onClose} className="px-5 py-3 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Cancel</button>
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

/* ─── Guidelines Panel ─── */

function GuidelinesPanel() {
  return (
    <section className="bg-[var(--muted)]/50 border border-[var(--border)] rounded-xl p-5 space-y-4 text-sm">
      <div>
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2">Ideal Profile</div>
        <ul className="text-sm text-[var(--foreground)] space-y-1 list-disc list-inside">
          <li>5K–50K followers (micro-influencer sweet spot)</li>
          <li>3.5%+ average engagement rate</li>
          <li>Modest fashion / Orthodox / LDS / hijabi audience alignment</li>
          <li>Active posting within last 30 days</li>
          <li>High-quality content (consistent aesthetic, good lighting)</li>
        </ul>
      </div>
      <div>
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2">Red Flags</div>
        <ul className="text-sm text-[var(--foreground)] space-y-1 list-disc list-inside">
          <li>Engagement rate below 2% (likely purchased followers)</li>
          <li>No niche overlap with our customer base</li>
          <li>Already featured a direct competitor in last 60 days</li>
          <li>Inconsistent posting — dormant accounts</li>
        </ul>
      </div>
      <div>
        <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2">Deal Guidelines</div>
        <ul className="text-sm text-[var(--foreground)] space-y-1 list-disc list-inside">
          <li><b>5K–15K:</b> Gifted only (1–2 items) + discount code</li>
          <li><b>15K–50K:</b> Gifted + optional flat fee $100–300</li>
          <li><b>50K+:</b> Paid required — negotiate based on deliverables</li>
          <li>Always require: dedicated Reel/post + 2 stories, tagged, within 14 days</li>
        </ul>
      </div>
    </section>
  );
}

/* ─── Detail Panel ─── */

function DetailPanel({ role, influencer, onClose, onChange, flash }: {
  role: 'admin' | 'intern'; influencer: Influencer; onClose: () => void; onChange: (id: string) => void; flash: (m: string) => void;
}) {
  const isAdmin = role === 'admin';
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteRole] = useState<'admin' | 'intern'>(role);
  const [noteName, setNoteName] = useState(role === 'admin' ? 'Ryan' : '');
  const [savingNote, setSavingNote] = useState(false);
  const [busy, setBusy] = useState(false);

  // Decline
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

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

  // Content editor
  const [contentOpen, setContentOpen] = useState(false);
  const [contentUrls, setContentUrls] = useState<string[]>(influencer.content_urls || []);
  const [newContentUrl, setNewContentUrl] = useState('');
  const [postedDate, setPostedDate] = useState(influencer.content_posted_date || new Date().toISOString().slice(0, 10));
  const [contentTypes, setContentTypes] = useState<string[]>(influencer.content_type_posted || []);

  const loadNotes = useCallback(async () => {
    const r = await fetch(`/api/influencers/notes?influencer_id=${influencer.id}`).then(r => r.json());
    setNotes(r.notes || []);
    setActivity(r.activity || []);
  }, [influencer.id]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    await fetch('/api/influencers/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencer_id: influencer.id, user_name: noteName, user_role: noteRole, note_text: newNote.trim() }),
    });
    setNewNote('');
    setSavingNote(false);
    loadNotes();
  };

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(true);
    const res = await fetch('/api/influencers', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: influencer.id, action, user_role: role, ...body }),
    });
    setBusy(false);
    if (!res.ok) { flash('Action failed'); return false; }
    onChange(influencer.id);
    loadNotes();
    return true;
  };

  const createDraft = async () => {
    setBusy(true);
    const res = await fetch('/api/influencers/shopify-draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ influencer_id: influencer.id }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.ok) { flash(`Draft created: ${json.draft?.name}`); onChange(influencer.id); }
    else flash(`Error: ${json.error || 'Failed'}`);
  };

  const saveDeal = async () => {
    await act('set_deal', {
      deal_type: dealType,
      payment_amount: parseFloat(payment) || 0,
      products_to_send: products,
      deliverables, expected_post_date: expectedDate || null,
      special_instructions: specialInstructions, discount_code: discountCode,
      shipping_address: ship,
    });
    flash('Deal saved');
    setDealOpen(false);
  };

  const logContent = async (markComplete: boolean) => {
    await act('log_content', {
      content_urls: contentUrls,
      content_posted_date: postedDate,
      content_type_posted: contentTypes,
      mark_complete: markComplete,
    });
    flash(markComplete ? 'Marked complete ✓' : 'Content logged');
    setContentOpen(false);
  };

  const sm = STATUS_META[influencer.status] || STATUS_META.pending_review;
  const canApprove = isAdmin && influencer.status === 'pending_review';
  const canEditDeal = isAdmin;
  const showDeal = ['approved', 'deal', 'shipped', 'content_pending', 'posted', 'complete'].includes(influencer.status);
  const showContent = ['shipped', 'content_pending', 'posted', 'complete'].includes(influencer.status);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="hidden md:block absolute top-0 right-0 h-full w-[520px] bg-[var(--card)] shadow-2xl overflow-y-auto animate-slide-right">
        <DetailBody />
      </div>
      <div className="md:hidden absolute bottom-0 left-0 right-0 bg-[var(--card)] rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl animate-slide-up">
        <div className="text-center pt-3 pb-1"><div className="w-9 h-1 bg-[var(--border)] rounded mx-auto" /></div>
        <DetailBody />
      </div>
    </div>
  );

  function DetailBody() {
    return (
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-xl font-semibold text-[var(--foreground)] truncate">{influencer.instagram_handle}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${sm.bg} ${sm.text}`}>{sm.label}</span>
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">
              {fmtNum(influencer.follower_count)} followers · {influencer.engagement_rate !== null ? `${influencer.engagement_rate}%` : '—'} engagement
            </div>
            {influencer.profile_url && (
              <a href={influencer.profile_url} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline">View profile ↗</a>
            )}
          </div>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xl">✕</button>
        </div>

        {/* Vetting */}
        <section className="bg-[var(--muted)]/50 rounded-xl p-4 space-y-2">
          <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Vetting Info</div>
          <div className="flex flex-wrap gap-1.5">
            {(influencer.niche_tags || []).map(n => <span key={n} className="text-[10px] bg-[var(--card)] border border-[var(--border)] px-2 py-0.5 rounded-lg text-[var(--muted-foreground)]">{n}</span>)}
            {(influencer.content_types || []).map(c => <span key={c} className="text-[10px] bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-lg text-sky-700">{c}</span>)}
          </div>
          {influencer.bio_notes && <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{influencer.bio_notes}</div>}
          {influencer.already_contacted && <div className="text-[11px] text-amber-700">⚠ Ryan may have already contacted</div>}
          {influencer.declined_reason && <div className="text-[11px] text-red-600">Declined: {influencer.declined_reason}</div>}
        </section>

        {/* Admin actions */}
        {canApprove && !showDecline && (
          <div className="flex gap-2">
            <button onClick={() => act('approve').then(ok => ok && flash('Approved ✓'))} disabled={busy}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              Approve
            </button>
            <button onClick={() => setShowDecline(true)} disabled={busy}
              className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              Decline
            </button>
          </div>
        )}

        {showDecline && (
          <div className="space-y-2">
            <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3} placeholder="Reason for declining (required)…"
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--ring)]" />
            <div className="flex gap-2">
              <button onClick={async () => { if (!declineReason.trim()) return; const ok = await act('decline', { declined_reason: declineReason }); if (ok) { flash('Declined'); setShowDecline(false); } }}
                disabled={!declineReason.trim() || busy}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">Confirm Decline</button>
              <button onClick={() => { setShowDecline(false); setDeclineReason(''); }} className="px-4 py-2.5 text-sm text-[var(--muted-foreground)]">Cancel</button>
            </div>
          </div>
        )}

        {/* Deal terms */}
        {showDeal && (
          <section className="border border-[var(--border)] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Deal Terms</div>
              {canEditDeal && <button onClick={() => setDealOpen(v => !v)} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">{dealOpen ? 'Close' : 'Edit'}</button>}
            </div>
            {!dealOpen ? (
              <div className="text-sm space-y-1">
                <div><span className="text-[var(--muted-foreground)]">Type:</span> {influencer.deal_type || '—'}</div>
                <div><span className="text-[var(--muted-foreground)]">Payment:</span> {fmtMoney(influencer.payment_amount || 0)}</div>
                <div><span className="text-[var(--muted-foreground)]">Products:</span> {(influencer.products_to_send || []).length} items</div>
                <div><span className="text-[var(--muted-foreground)]">Deliverables:</span> {influencer.deliverables || '—'}</div>
                <div><span className="text-[var(--muted-foreground)]">Expected post:</span> {fmtDate(influencer.expected_post_date)}</div>
                {influencer.discount_code && <div><span className="text-[var(--muted-foreground)]">Code:</span> {influencer.discount_code}</div>}
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
                <Field label="Products to Gift">
                  <ProductPicker products={products} setProducts={setProducts} />
                </Field>
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
                    <input value={ship.firstName || ''} onChange={e => setShip({ ...ship, firstName: e.target.value })} placeholder="First name" className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
                    <input value={ship.lastName || ''} onChange={e => setShip({ ...ship, lastName: e.target.value })} placeholder="Last name" className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm" />
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

            {influencer.shopify_order_name ? (
              <div className="text-xs text-emerald-600 font-medium">✓ Shopify order: {influencer.shopify_order_name}</div>
            ) : (influencer.status === 'deal' && (influencer.products_to_send || []).length > 0) ? (
              <button onClick={createDraft} disabled={busy} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                Create Shopify Draft Order
              </button>
            ) : null}

            {influencer.status === 'deal' && influencer.shopify_order_name && (
              <button onClick={() => act('mark_shipped').then(ok => ok && flash('Marked shipped'))} disabled={busy}
                className="w-full py-2.5 bg-sky-600 text-white rounded-xl text-sm font-semibold">Mark Shipped</button>
            )}
          </section>
        )}

        {/* Content */}
        {showContent && (
          <section className="border border-[var(--border)] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Content</div>
              <button onClick={() => setContentOpen(v => !v)} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">{contentOpen ? 'Close' : 'Log'}</button>
            </div>
            {(influencer.content_urls || []).length > 0 && !contentOpen && (
              <div className="space-y-1.5">
                {(influencer.content_urls || []).map(u => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-xs text-sky-600 hover:underline truncate">{u}</a>
                ))}
                <div className="text-xs text-[var(--muted-foreground)]">Posted {fmtDate(influencer.content_posted_date)}</div>
              </div>
            )}
            {contentOpen && (
              <div className="space-y-3">
                <Field label="Post URLs">
                  <div className="space-y-2">
                    {contentUrls.map((u, i) => (
                      <div key={i} className="flex items-center gap-2">
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
                    {CONTENT_OPTIONS.map(c => (
                      <button key={c} onClick={() => setContentTypes(contentTypes.includes(c) ? contentTypes.filter(x => x !== c) : [...contentTypes, c])}
                        className={`text-xs px-3 py-1.5 rounded-lg border ${contentTypes.includes(c) ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)]'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="flex gap-2">
                  <button onClick={() => logContent(false)} disabled={busy} className="flex-1 py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-sm font-semibold">Save Content</button>
                  <button onClick={() => logContent(true)} disabled={busy} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold">Mark Complete</button>
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
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${n.user_role === 'admin' ? 'bg-sky-50 text-sky-700' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>{n.user_role}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">{new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{n.note_text}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <div className="flex gap-2">
              <input value={noteName} onChange={e => setNoteName(e.target.value)} placeholder="Your name" className="flex-1 p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs" />
              <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded ${noteRole === 'admin' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{noteRole}</span>
            </div>
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} placeholder="Add a note…"
              className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--ring)] resize-y" />
            <button onClick={addNote} disabled={!newNote.trim() || savingNote} className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-xs font-semibold disabled:opacity-50">
              {savingNote ? 'Saving…' : 'Add Note'}
            </button>
          </div>
        </section>

        {/* Activity log */}
        <section>
          <div className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold mb-2">Activity</div>
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
        </section>
      </div>
    );
  }
}

/* ─── Product Picker ─── */

type ShopifyVariant = { id: string; title: string; sku: string | null; price: number; size: string; inStock: boolean; inventory: number | null };
type ShopifyProduct = { id: string; title: string; handle: string; image: string | null; variants: ShopifyVariant[] };

function ProductPicker({ products, setProducts }: { products: Product[]; setProducts: (p: Product[]) => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ShopifyProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/influencers/products?search=${encodeURIComponent(search)}`).then(r => r.json());
        setResults(r.products || []);
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const addVariant = (p: ShopifyProduct, v: ShopifyVariant) => {
    setProducts([
      ...products,
      {
        title: `${p.title} — ${v.size}`,
        variantId: v.id,
        price: v.price,
        quantity: 1,
        sku: v.sku || undefined,
      },
    ]);
    setSearch('');
    setResults([]);
    setExpanded(null);
  };

  return (
    <div className="space-y-2">
      {products.length > 0 && (
        <div className="space-y-1.5">
          {products.map((p, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-[var(--muted)]/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--foreground)] truncate">{p.title}</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">${(p.price || 0).toFixed(2)} {p.sku ? `· SKU ${p.sku}` : ''}</div>
              </div>
              <input type="number" value={p.quantity || 1} onChange={e => {
                const c = [...products]; c[i] = { ...c[i], quantity: parseInt(e.target.value) || 1 }; setProducts(c);
              }} className="w-14 p-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-sm text-center" />
              <button onClick={() => setProducts(products.filter((_, j) => j !== i))} className="text-red-500 text-lg px-1">×</button>
            </div>
          ))}
        </div>
      )}

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search Shopify products by title…"
        className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--ring)]"
      />

      {searching && <div className="text-xs text-[var(--muted-foreground)] italic">Searching…</div>}

      {results.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
          {results.map(p => (
            <div key={p.id}>
              <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="w-full flex items-center gap-3 p-2.5 hover:bg-[var(--accent)]/40 text-left">
                {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-lg bg-[var(--muted)] flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--foreground)] truncate">{p.title}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">{p.variants.length} size{p.variants.length !== 1 ? 's' : ''}</div>
                </div>
                <span className="text-xs text-[var(--muted-foreground)]">{expanded === p.id ? '▾' : '▸'}</span>
              </button>
              {expanded === p.id && (
                <div className="pl-14 pr-3 pb-3 flex flex-wrap gap-1.5">
                  {p.variants.map(v => (
                    <button key={v.id} onClick={() => addVariant(p, v)} disabled={!v.inStock}
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${v.inStock ? 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--accent)]' : 'bg-[var(--muted)]/50 border-[var(--border)] text-[var(--muted-foreground)] opacity-50 cursor-not-allowed'}`}>
                      {v.size} · ${v.price.toFixed(0)} {!v.inStock ? '(OOS)' : ''}
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
