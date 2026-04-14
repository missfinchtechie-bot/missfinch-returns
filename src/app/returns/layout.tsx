import type { Metadata } from 'next';
import { DM_Sans, Cormorant_Garamond } from 'next/font/google';

const dmSans = DM_Sans({ 
  subsets: ['latin'], 
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
});

const cormorant = Cormorant_Garamond({ 
  subsets: ['latin'], 
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
});

export const metadata: Metadata = {
  title: 'Returns & Exchanges — Miss Finch NYC',
  description: 'Start a return or exchange for your Miss Finch NYC order.',
};

export default function ReturnsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen ${dmSans.variable} ${cormorant.variable}`}
      style={{ background: '#F5F3EE', fontFamily: 'var(--font-dm-sans), -apple-system, sans-serif' }}>
      {children}
    </div>
  );
}
