import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const path = req.nextUrl.pathname;

  // returns.missfinchnyc.com — only allow /returns and static assets
  if (host.startsWith('returns.')) {
    if (path === '/') {
      return NextResponse.rewrite(new URL('/returns', req.url));
    }
    if (path.startsWith('/admin') || path.startsWith('/api')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // app.missfinchnyc.com — only allow /admin and /api
  if (host.startsWith('app.')) {
    if (path === '/') {
      return NextResponse.rewrite(new URL('/admin', req.url));
    }
    if (path.startsWith('/returns')) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Role-based access: intern can only access /admin/influencers
    const authCookie = req.cookies.get('mf_auth')?.value;
    if (authCookie === 'intern') {
      const adminPages = ['/admin/messages', '/admin/financials', '/admin/analytics'];
      // Block intern from non-influencer admin pages (allow /admin/influencers and /api)
      if (path === '/admin' || adminPages.some(p => path.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/influencers', req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
