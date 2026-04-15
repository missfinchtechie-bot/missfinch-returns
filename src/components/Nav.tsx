'use client';

import { useEffect, useState } from 'react';

type Page = 'returns' | 'messages' | 'financials' | 'analytics';

const LINKS: { key: Page; label: string; href: string }[] = [
  { key: 'returns', label: 'Returns', href: '/admin' },
  { key: 'messages', label: 'Messages', href: '/admin/messages' },
  { key: 'financials', label: 'Financials', href: '/admin/financials' },
  { key: 'analytics', label: 'Analytics', href: '/admin/analytics' },
];

interface NavProps {
  active: Page;
  right?: React.ReactNode;
}

export function Nav({ active, right }: NavProps) {
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    fetch('/api/messages/list?status=pending_review')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.messages) setPendingCount(d.messages.length); })
      .catch(() => {});
  }, []);

  return (
    <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 sm:px-6 py-3.5 shadow-sm">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0">
          <h1 className="font-heading text-lg sm:text-xl font-semibold italic text-[var(--foreground)]">Miss Finch</h1>
          <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">NYC</span>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <div className="flex items-center gap-0.5 bg-[var(--muted)] rounded-lg p-0.5">
            {LINKS.map(l => {
              const isActive = l.key === active;
              const showBadge = l.key === 'messages' && pendingCount > 0;
              const cls = isActive
                ? 'text-[11px] sm:text-xs tracking-wider uppercase font-semibold px-2 sm:px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md inline-flex items-center gap-1.5'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] sm:text-xs tracking-wider uppercase px-2 sm:px-3 py-1.5 rounded-md hover:bg-[var(--accent)] transition-colors inline-flex items-center gap-1.5';
              return isActive ? (
                <span key={l.key} className={cls}>
                  {l.label}
                  {showBadge && <span className="text-[9px] font-bold bg-[var(--primary-foreground)]/20 text-[var(--primary-foreground)] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{pendingCount}</span>}
                </span>
              ) : (
                <a key={l.key} href={l.href} className={cls}>
                  {l.label}
                  {showBadge && <span className="text-[9px] font-bold bg-amber-500 text-white rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{pendingCount}</span>}
                </a>
              );
            })}
          </div>
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </header>
  );
}

export default Nav;
