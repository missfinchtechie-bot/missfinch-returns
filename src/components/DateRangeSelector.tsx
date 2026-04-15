'use client';

export type PresetKey = 'today' | 'week' | 'month' | 'last_month' | '90d' | 'all' | 'custom';

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

export function rangeFor(preset: PresetKey, customFrom?: string, customTo?: string): { from: string; to: string } | null {
  if (preset === 'all') return null;
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (preset === 'today') return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (preset === 'week') {
    const s = new Date(now); s.setDate(now.getDate() - now.getDay());
    return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (preset === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString() };
  }
  if (preset === 'last_month') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: startOfDay(s).toISOString(), to: endOfDay(e).toISOString() };
  }
  if (preset === '90d') {
    const s = new Date(now); s.setDate(now.getDate() - 90);
    return { from: startOfDay(s).toISOString(), to: endOfDay(now).toISOString() };
  }
  return {
    from: customFrom ? new Date(customFrom).toISOString() : startOfDay(now).toISOString(),
    to: customTo ? endOfDay(new Date(customTo)).toISOString() : endOfDay(now).toISOString(),
  };
}

interface Props {
  preset: PresetKey;
  onPresetChange: (p: PresetKey) => void;
  customFrom?: string;
  customTo?: string;
  onCustomChange?: (from: string, to: string) => void;
  includeAll?: boolean;
}

export function DateRangeSelector({ preset, onPresetChange, customFrom = '', customTo = '', onCustomChange, includeAll = true }: Props) {
  const presets = includeAll ? PRESETS : PRESETS.filter(p => p.key !== 'all');
  return (
    <div className="flex flex-wrap items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-2">
      {presets.map(p => (
        <button key={p.key} onClick={() => onPresetChange(p.key)}
          className={`text-[11px] sm:text-xs tracking-wider uppercase px-3 py-1.5 rounded-md transition-colors ${preset === p.key ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}>
          {p.label}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <input type="date" value={customFrom} onChange={e => onCustomChange?.(e.target.value, customTo)} className="text-xs px-2 py-1 border border-[var(--border)] rounded-md bg-[var(--card)]" />
          <span className="text-[var(--muted-foreground)] text-xs">→</span>
          <input type="date" value={customTo} onChange={e => onCustomChange?.(customFrom, e.target.value)} className="text-xs px-2 py-1 border border-[var(--border)] rounded-md bg-[var(--card)]" />
        </div>
      )}
    </div>
  );
}

export default DateRangeSelector;
