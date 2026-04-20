import { NextResponse, type NextRequest } from 'next/server'

const MAINTENANCE = true

export function middleware(req: NextRequest) {
  if (!MAINTENANCE) return NextResponse.next()

  const { pathname } = req.nextUrl

  if (pathname === '/maintenance') return NextResponse.next()
  if (pathname.startsWith('/admin')) return NextResponse.next()
  if (pathname.startsWith('/api')) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/maintenance'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

