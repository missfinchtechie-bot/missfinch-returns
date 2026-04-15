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
  }

  // Intern role: lock them to /admin/influencers (APIs still allowed)
  const role = req.cookies.get('mf_auth')?.value;
  if (role === 'intern' && path.startsWith('/admin') && !path.startsWith('/admin/influencers')) {
    return NextResponse.redirect(new URL('/admin/influencers', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
