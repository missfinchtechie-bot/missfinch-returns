import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Miss Finch Returns',
  description: 'Returns management dashboard',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
