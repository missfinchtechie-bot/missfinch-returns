import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('mf_auth');
  if (cookie?.value === 'admin' || cookie?.value === 'intern') {
    return NextResponse.json({ authed: true, role: cookie.value });
  }
  // Legacy cookie support
  if (cookie?.value === 'authenticated') {
    return NextResponse.json({ authed: true, role: 'admin' });
  }
  return NextResponse.json({ authed: false }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const adminPassword = process.env.ADMIN_PASSWORD || 'RSH0731';
  const internPassword = process.env.INTERN_PASSWORD || 'intern2026';

  let role: string | null = null;
  if (password === adminPassword) role = 'admin';
  else if (password === internPassword) role = 'intern';

  if (role) {
    const response = NextResponse.json({ success: true, role });
    response.cookies.set('mf_auth', role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
    return response;
  }

  return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
}
