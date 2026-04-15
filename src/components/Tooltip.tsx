export function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-block ml-1 cursor-help">
      <span className="text-[10px] text-[var(--muted-foreground)]/60 hover:text-[var(--muted-foreground)] transition-colors">ⓘ</span>
      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[var(--foreground)] text-[var(--background)] text-[11px] px-3 py-2 rounded-lg shadow-xl z-50 leading-relaxed whitespace-normal">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-[var(--foreground)]" />
      </div>
    </div>
  );
}

export default Tooltip;
