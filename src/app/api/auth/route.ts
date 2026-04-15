import { NextRequest, NextResponse } from 'next/server';

export type Role = 'admin' | 'intern';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('mf_auth');
  const v = cookie?.value;
  if (v === 'admin' || v === 'authenticated') {
    return NextResponse.json({ authed: true, role: 'admin' as Role });
  }
  if (v === 'intern') {
    return NextResponse.json({ authed: true, role: 'intern' as Role });
  }
  return NextResponse.json({ authed: false }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const adminPassword = process.env.ADMIN_PASSWORD || 'missfinch2026';
  const internPassword = process.env.INTERN_PASSWORD || 'intern2026';

  let role: Role | null = null;
  if (password === adminPassword) role = 'admin';
  else if (password === internPassword) role = 'intern';

  if (!role) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

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

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('mf_auth', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
