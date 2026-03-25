import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Vercel 등 로드밸런서 환경에서 실제 호스트 추출
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // 도메인 제한 로직
      const email = user.email ?? ''
              const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? process.env.ALLOWED_EMAIL_DOMAIN ?? 'nowondaycare.org').split(',')
                              const adminEmails = (process.env.ADMIN_EMAILS ?? 'cheese0318@gmail.com').split(',').map(e => e.trim()).filter(Boolean)
              if (!allowedDomains.some(d => email.endsWith('@' + d.trim())) && !adminEmails.includes(email)) {  
      await supabase.auth.signOut()
        return NextResponse.redirect(`${baseUrl}/login?error=InvalidDomain`)
      }

      return NextResponse.redirect(`${baseUrl}${next}`)
    }
  }

  return NextResponse.redirect(`${baseUrl}/login?error=AuthFailed`)
}
