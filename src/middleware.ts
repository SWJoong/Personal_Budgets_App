import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 데모 모드: 모든 요청을 인증 없이 통과시킴
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
