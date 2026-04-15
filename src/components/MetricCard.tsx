import { Tooltip } from './Tooltip';

type Accent = 'emerald' | 'red' | 'purple' | 'amber' | 'sky';

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  formula?: string;
  trend?: number;
  accent?: Accent;
  negative?: boolean;
}

const accentClasses: Record<Accent, string> = {
  emerald: 'bg-emerald-50/50 border-emerald-200/60',
  red: 'bg-red-50/50 border-red-200/60',
  purple: 'bg-purple-50/50 border-purple-200/60',
  amber: 'bg-amber-50/50 border-amber-200/60',
  sky: 'bg-sky-50/50 border-sky-200/60',
};

const valueClasses: Record<Accent, string> = {
  emerald: 'text-emerald-700',
  red: 'text-red-600',
  purple: 'text-purple-600',
  amber: 'text-amber-700',
  sky: 'text-sky-700',
};

export function MetricCard({ label, value, sub, formula, trend, accent, negative }: MetricCardProps) {
  const wrap = accent ? accentClasses[accent] : 'bg-[var(--card)] border-[var(--border)]';
  const vCls = negative ? 'text-red-600' : accent ? valueClasses[accent] : 'text-[var(--foreground)]';
  const subCls = trend !== undefined
    ? trend > 0 ? 'text-red-500' : trend < 0 ? 'text-emerald-600' : 'text-[var(--muted-foreground)]'
    : 'text-[var(--muted-foreground)]';
  return (
    <div className={`border rounded-xl p-4 shadow-sm ${wrap}`}>
      <div className="flex items-center">
        <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">{label}</p>
        {formula && <Tooltip text={formula} />}
      </div>
      <p className={`font-heading text-2xl font-semibold mt-1 ${vCls}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-1 ${subCls}`}>{sub}</p>}
    </div>
  );
}

export default MetricCard;
