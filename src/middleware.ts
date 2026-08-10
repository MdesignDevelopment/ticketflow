import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl, auth: session } = req

  const isLoginPage = nextUrl.pathname === '/login'
  const isAuthApi = nextUrl.pathname.startsWith('/api/auth')

  // The portal-metrics endpoint authenticates itself with a bearer secret
  // (no session cookie) — let it through to the route handler.
  if (nextUrl.pathname.startsWith('/api/portal-metrics')) {
    return NextResponse.next()
  }

  if (isLoginPage || isAuthApi) {
    if (isLoginPage && session) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
    return NextResponse.next()
  }

  if (!session) {
    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // EXTERN users: dashboard only. EXTERN_PLUS: dashboard + internal dashboard.
  const role = (session.user as any)?.role
  if (role === 'EXTERN' || role === 'EXTERN_PLUS') {
    const allowed =
      nextUrl.pathname === '/dashboard' ||
      nextUrl.pathname.startsWith('/dashboard/partners') ||
      (role === 'EXTERN_PLUS' && nextUrl.pathname === '/admin/internal-dashboard') ||
      (role === 'EXTERN_PLUS' && nextUrl.pathname.startsWith('/api/admin/'))
    if (!allowed) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf)).*)',
  ],
}
