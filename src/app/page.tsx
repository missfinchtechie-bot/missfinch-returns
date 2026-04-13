import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function Home() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  
  if (host.startsWith('returns.')) {
    redirect('/returns');
  }
  redirect('/admin');
}
