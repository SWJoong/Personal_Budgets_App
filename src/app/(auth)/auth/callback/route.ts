import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { assignRoleForFirstUser } from '@/app/actions/admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      const email = user.email ?? ''
      const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? '').trim()
      const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? process.env.ALLOWED_EMAIL_DOMAIN ?? 'nowondaycare.org')
        .split(',').map(d => d.trim()).filter(Boolean)

      // 1. 슈퍼 관리자 이메일
      const isSuperAdmin = superAdminEmail && email === superAdminEmail

      // 2. 허용 도메인(@nowondaycare.org → 실무자 자동 배정)
      const isAllowedDomain = allowedDomains.some(d => email.endsWith('@' + d))

      // 3. user_invitations 사전 등록 여부 (RLS 우회 필요 → adminClient)
      let isInvited = false
      if (!isSuperAdmin && !isAllowedDomain) {
        const adminClient = createAdminClient()
        const { data: invitation } = await adminClient
          .from('user_invitations')
          .select('id')
          .eq('email', email)
          .is('used_at', null)
          .maybeSingle()
        isInvited = !!invitation
      }

      if (!isSuperAdmin && !isAllowedDomain && !isInvited) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${baseUrl}/login?error=InvalidDomain`)
      }

      // 최초 로그인 시 admin 자동 할당 (데모 모드 폴백용, 실운영에서는 트리거가 처리)
      try {
        await assignRoleForFirstUser()
      } catch (e) {
        console.error('Failed to assign first admin role:', e)
      }

      return NextResponse.redirect(`${baseUrl}${next}`)
    }
  }

  return NextResponse.redirect(`${baseUrl}/login?error=AuthFailed`)
}
