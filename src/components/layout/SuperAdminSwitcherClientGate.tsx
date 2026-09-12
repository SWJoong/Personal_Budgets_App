'use client'

import { useAuth } from '@/hooks/useAuth'
import { isSuperAdminEmail } from '@/utils/superAdmin'
import SuperAdminSwitcherMount from './SuperAdminSwitcherMount'

/**
 * 당사자 레이아웃용 클라이언트 슈퍼관리자 게이트.
 *
 * ★왜 서버 판정이 아니라 클라 판정인가: (participant)/layout.tsx 는 '동기 서버 컴포넌트' 계약
 *   (src/app/(participant)/layout.test.tsx — jsdom 통합 렌더)이라 layout 을 async 로 바꿔 서버에서
 *   await getUser() 로 슈퍼관리자를 판정할 수 없다(계약 위반·회귀). 그래서 여기서 클라이언트 세션
 *   (useAuth)으로 판정한다. 실무자/관리자 레이아웃은 이미 async 라 서버에서 판정한다.
 *
 * 한계: 클라이언트에선 process.env.SUPER_ADMIN_EMAIL(비공개)을 못 읽으므로 내장(BUILTIN) 목록만
 *   적용된다. 실제 대상 계정(cheese0318@gmail.com)은 내장이라 정상 동작. env 로만 지정된 슈퍼관리자는
 *   당사자 화면에서 전환기가 안 보일 수 있으나(스태프 화면에선 서버 판정으로 보임), 안전엔 영향 없다
 *   — 전환 자체는 superAdminSwitch(assertAdmin) 서버 게이트가 최종 판정한다.
 */
export default function SuperAdminSwitcherClientGate() {
  const { user } = useAuth()
  const email = user?.email
  const isSuperAdmin = !!email && isSuperAdminEmail(email, undefined)

  return <SuperAdminSwitcherMount isSuperAdmin={isSuperAdmin} />
}
