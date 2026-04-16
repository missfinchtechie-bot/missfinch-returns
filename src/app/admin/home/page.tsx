'use client';

import { useEffect, useState } from 'react';
import Nav from '@/components/Nav';

type KPIs = {
  revenue30: number;
  orderCount30: number;
  inboxCount: number;
  activeCollabs: number;
  needsAction: number;
  returnRate: number;
};

type FeedItem = { type: string; text: string; date: string; link: string };

const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtTimeAgo = (d: string): string => {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const FEED_ICONS: Record<string, string> = { return: '📦', collab: '💌', activity: '📝' };

export default function HomePage() {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth', { method: 'GET' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.role === 'intern') { window.location.href = '/admin/influencers'; return; }
        if (d?.role === 'admin') { setRole(d.role); setAuthed(true); }
      })
      .catch(() => {});
  }, []);

  const login = async () => {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (!res.ok) { setPwErr('Wrong password'); return; }
    const d = await res.json();
    if (d.role === 'intern') { window.location.href = '/admin/influencers'; return; }
    setRole(d.role); setAuthed(true); setPwErr('');
  };

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetch('/api/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setKpis(d.kpis); setFeed(d.feed || []); }
      })
      .finally(() => setLoading(false));
  }, [authed]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl font-semibold text-[var(--foreground)] tracking-wide">MISS FINCH</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 tracking-widest uppercase">Dashboard</p>
          </div>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Enter password" className="w-full p-4 rounded-xl border border-[var(--border)] text-lg text-center focus:outline-none focus:border-[var(--primary)] bg-[var(--card)]" />
          {pwErr && <p className="text-red-500 text-center text-sm mt-3">{pwErr}</p>}
          <button onClick={login} className="w-full mt-4 p-4 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-xl text-base font-semibold hover:opacity-90 transition-opacity">Log In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Nav active="home" />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">Dashboard</h2>

        {loading ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] text-sm">Loading…</div>
        ) : kpis && (
          <>
            {/* KPI Cards */}
            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPICard label="Revenue (30d)" value={fmtMoney(kpis.revenue30)} sub={`${kpis.orderCount30} orders`} href="/admin/financials"
                border="border-l-emerald-500" tone="text-emerald-700" />
              <KPICard label="Orders (30d)" value={String(kpis.orderCount30)} sub="non-cancelled" href="/admin/financials"
                border="border-l-sky-500" tone="text-sky-700" />
              <KPICard label="Pending Returns" value={String(kpis.inboxCount)} sub="inbox, need action" href="/admin"
                border={kpis.inboxCount > 0 ? 'border-l-amber-500' : 'border-l-stone-300'} tone={kpis.inboxCount > 0 ? 'text-amber-700' : 'text-[var(--foreground)]'} />
              <KPICard label="Active Collabs" value={String(kpis.activeCollabs)} sub="not posted/passed" href="/admin/influencers"
                border="border-l-blue-500" tone="text-blue-700" />
              <KPICard label="Needs Your Action" value={String(kpis.needsAction)} sub="negotiate + approve + inbox" href="/admin/influencers"
                border={kpis.needsAction > 0 ? 'border-l-red-500' : 'border-l-stone-300'} tone={kpis.needsAction > 0 ? 'text-red-700 font-bold' : 'text-[var(--foreground)]'} />
              <KPICard label="Return Rate" value={`${kpis.returnRate}%`} sub="returns / orders (month)" href="/admin/analytics"
                border={kpis.returnRate > 25 ? 'border-l-red-500' : kpis.returnRate > 15 ? 'border-l-amber-500' : 'border-l-emerald-500'}
                tone={kpis.returnRate > 25 ? 'text-red-600' : kpis.returnRate > 15 ? 'text-amber-700' : 'text-emerald-700'} />
            </section>

            {/* Quick Links */}
            <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <QuickLink href="/admin" label="Returns" sub={`${kpis.inboxCount} inbox`} icon="📦" />
              <QuickLink href="/admin/financials" label="Financials" sub={`${fmtMoney(kpis.revenue30)} 30d`} icon="💰" />
              <QuickLink href="/admin/analytics" label="Analytics" sub={`${kpis.returnRate}% rate`} icon="📊" />
              <QuickLink href="/admin/influencers" label="Influencers" sub={`${kpis.activeCollabs} active`} icon="💌" />
              <QuickLink href="/admin/messages" label="Messages" sub="—" icon="✉️" />
            </section>

            {/* Recent Activity Feed */}
            <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Recent Activity</h3>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {feed.length === 0 ? (
                  <div className="p-5 text-center text-sm text-[var(--muted-foreground)]">No recent activity</div>
                ) : feed.map((f, i) => (
                  <a key={i} href={f.link} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--accent)]/40 transition-colors">
                    <span className="text-lg">{FEED_ICONS[f.type] || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--foreground)] truncate">{f.text}</div>
                    </div>
                    <span className="text-[10px] text-[var(--muted-foreground)] flex-shrink-0">{f.date ? fmtTimeAgo(f.date) : '—'}</span>
                  </a>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function KPICard({ label, value, sub, href, border, tone }: {
  label: string; value: string; sub: string; href: string; border: string; tone: string;
}) {
  return (
    <a href={href} className={`bg-[var(--card)] border border-[var(--border)] border-l-4 ${border} rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">{label}</p>
      <p className={`font-heading text-2xl font-semibold mt-1 ${tone}`}>{value}</p>
      <p className="text-[10px] mt-0.5 text-[var(--muted-foreground)]">{sub}</p>
    </a>
  );
}

function QuickLink({ href, label, sub, icon }: { href: string; label: string; sub: string; icon: string }) {
  return (
    <a href={href} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:shadow-md transition-shadow flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-sm font-semibold text-[var(--foreground)]">{label}</div>
        <div className="text-[10px] text-[var(--muted-foreground)]">{sub}</div>
      </div>
    </a>
  );
}
