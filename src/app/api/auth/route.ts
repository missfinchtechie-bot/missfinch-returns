import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('mf_auth');
  if (cookie?.value === 'authenticated') {
    return NextResponse.json({ authed: true });
  }
  return NextResponse.json({ authed: false }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const adminPassword = process.env.ADMIN_PASSWORD || 'RSH0731';

  if (password === adminPassword) {
    const response = NextResponse.json({ success: true });
    // Remember device for 1 year
    response.cookies.set('mf_auth', 'authenticated', {
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
