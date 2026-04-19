import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import authConfig from '@/auth.config';

const { auth } = NextAuth(authConfig);

const apiAuthMiddleware = auth((request) => {
  const { pathname } = request.nextUrl;

  if (pathname === '/api/health' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  if (!request.auth) {
    return NextResponse.json(
      { success: false, errorCode: 'UNAUTHORIZED', error: 'OAuth login required' },
      { status: 401 },
    );
  }

  return NextResponse.next();
});

export default function middleware(request: Parameters<typeof apiAuthMiddleware>[0]) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // Only API endpoints require authentication.
  // Static assets and pages are publicly accessible.
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  return apiAuthMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next/image|favicon.ico).*)'],
};
