import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Returns & Exchanges — Miss Finch NYC',
  description: 'Start a return or exchange for your Miss Finch NYC order.',
};

export default function ReturnsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#F5F3EE', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      {children}
    </div>
  );
}
