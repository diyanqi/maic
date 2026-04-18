import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import authConfig from '@/auth.config';

const { auth } = NextAuth(authConfig);

const CDN_ORIGIN = 'https://maic.amzcd.top';
const CDN_HOST = 'maic.amzcd.top';

function shouldRedirectToCdn(pathname: string): boolean {
  if (pathname.startsWith('/_next/static/')) return true;
  if (pathname.startsWith('/logos/')) return true;
  if (pathname.startsWith('/avatars/')) return true;
  return /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|map)$/i.test(pathname);
}

export default auth((request) => {
  const { pathname, search, hostname } = request.nextUrl;

  if (
    process.env.NODE_ENV === 'production' &&
    hostname !== CDN_HOST &&
    shouldRedirectToCdn(pathname)
  ) {
    return NextResponse.redirect(`${CDN_ORIGIN}${pathname}${search}`, 307);
  }

  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  if (
    pathname === '/login' ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  if (!request.auth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, errorCode: 'UNAUTHORIZED', error: 'OAuth login required' },
        { status: 401 },
      );
    }

    const callbackUrl = encodeURIComponent(`${pathname}${search}`);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/image|favicon.ico).*)'],
};
