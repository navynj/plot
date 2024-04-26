import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req: any) => {
  if (!req.auth) {
    return NextResponse.rewrite(new URL('/auth', req.url));
  } else if (req.nextUrl.pathname === '/auth') {
    return NextResponse.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: ['/auth', '/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
