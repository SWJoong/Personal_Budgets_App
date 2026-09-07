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
      // 소유 운영자 계정 — 사용자 명시 요구(2026-09-07): 이 계정은 배포 환경변수 설정 여부와
      // 무관하게 '항상' 슈퍼관리자로 인식한다(Vercel SUPER_ADMIN_EMAIL 을 깜빡해도 로그인만 하면
      // 관리자 접근 보장). 환경변수만으로 관리하고 싶으면 이 배열을 비우면 된다.
      const BUILTIN_SUPER_ADMINS = ['cheese0318@gmail.com']
      // SUPER_ADMIN_EMAIL 은 콤마로 여러 개 지정 가능(예: 부트스트랩 데모관리자 등). 대소문자 무관.
      const superAdminEmails = [
        ...BUILTIN_SUPER_ADMINS,
        ...(process.env.SUPER_ADMIN_EMAIL ?? '').split(','),
      ].map((e) => e.trim().toLowerCase()).filter(Boolean)
      // 미설정 시 빈 목록 — 예전에는 'nowondaycare.org' 로 폴백해서, 이 변수를
      // 깜빡하면 그 기관 소속이 아닌 모든 신규 배포에서 아무도 로그인할 수 없었다.
      const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? process.env.ALLOWED_EMAIL_DOMAIN ?? '')
        .split(',').map(d => d.trim()).filter(Boolean)

      // 1. 슈퍼 관리자 이메일
      const isSuperAdmin = superAdminEmails.includes(email.toLowerCase())

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

      // SUPER_ADMIN_EMAIL 로 지정된 계정은 '무조건 관리자'로 승격한다. assign_first_admin 은
      // 관리자가 0명일 때만 동작하므로(이미 다른 관리자가 있으면 no-op) 그것만으론 부족하다.
      // protect_profile_role 트리거는 로그인 세션(auth.uid())이 자기 role 을 바꾸면 되돌리므로,
      // 서비스롤(auth.uid()=null → 트리거 신뢰경로)로 승격한다. 멱등: 이미 admin 이면 변화 없음.
      if (isSuperAdmin) {
        try {
          const admin = createAdminClient()
          await admin.from('profiles').update({ role: 'admin' }).eq('id', user.id).neq('role', 'admin')
        } catch (e) {
          console.error('Failed to promote super admin:', e)
        }
      }

      // SUPER_ADMIN_EMAIL 미설정 배포용 안전망 — 관리자가 하나도 없을 때 첫 로그인 사용자를 admin 으로.
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
