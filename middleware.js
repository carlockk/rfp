import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

function isPublicPath(pathname) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/favicon')) return true;
  if (pathname.startsWith('/logo')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  return false;
}

export function middleware(req) {
  const token = req.cookies.get('token')?.value;
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api');

  if (!token && !isApiRoute && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}
