import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// piscine-platform.vercel.app was the Piscine app's original standalone URL,
// bookmarked and shared before it merged into this portfolio site — visitors
// there still expect the app directly, not the portfolio homepage. Any other
// domain this app is deployed under (the portfolio's own URL) should serve
// the homepage normally.
const PISCINE_ONLY_HOSTS = new Set(['piscine-platform.vercel.app'])

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  if (PISCINE_ONLY_HOSTS.has(host)) {
    return NextResponse.redirect(new URL('/piscine', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/',
}
