import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
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
      // 미설정 시 빈 목록 — 예전에는 'nowondaycare.org' 로 폴백해서, 이 변수를
      // 깜빡하면 그 기관 소속이 아닌 모든 신규 배포에서 아무도 로그인할 수 없었다.
      const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? process.env.ALLOWED_EMAIL_DOMAIN ?? '')
        .split(',').map(d => d.trim()).filter(Boolean)

      // 1. 슈퍼 관리자 이메일
      const isSuperAdmin = superAdminEmail && email === superAdminEmail

      // 2. 허용 도메인 (실무자 소속 기관 이메일)
      const isAllowedDomain = allowedDomains.some(d => email.endsWith('@' + d))

      // 3. 사전 등록된 참여자와 연결되었는가 — handle_new_user() 트리거가 방금
      //    exchangeCodeForSession() 안에서 이메일이 일치하는 participants 행을
      //    이미 찾아 auth_user_id 를 채웠다. 여기서는 그 결과만 확인한다.
      //    (예전에는 user_invitations 를 "used_at IS NULL" 로 다시 조회했는데,
      //    트리거가 그 초대를 이미 소비해 둔 뒤라 항상 거짓이 되는 경쟁 조건이 있었다.)
      let isLinkedParticipant = false
      let isInvited = false
      if (!isSuperAdmin && !isAllowedDomain) {
        const { data: participant } = await supabase
          .from('participants')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        isLinkedParticipant = !!participant

        if (!isLinkedParticipant) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          // 트리거가 초대(user_invitations)를 소비해 role 을 admin/supporter 로
          // 지정해 두었다면 참여자 기본값(participant)이 아닐 것이다.
          isInvited = profile?.role === 'admin' || profile?.role === 'supporter'
        }
      }

      if (!isSuperAdmin && !isAllowedDomain && !isLinkedParticipant && !isInvited) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${baseUrl}/login?error=InvalidDomain`)
      }

      // 최초 로그인 시 admin 자동 할당 (관리자가 하나도 없을 때의 안전망)
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
