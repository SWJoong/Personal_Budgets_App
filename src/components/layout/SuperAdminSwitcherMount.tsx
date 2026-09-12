'use client'

import { usePathname } from 'next/navigation'
import SuperAdminSwitcher from './SuperAdminSwitcher'

/**
 * SuperAdminSwitcher 얇은 마운트 래퍼. 라우터 훅(usePathname)을 순수 컴포넌트로부터 격리한다
 * (SuperAdminSwitcher.test 는 라우터 컨텍스트를 제공하지 않으므로 훅은 여기서만 쓴다).
 * 경로로 현재 화면(관리자/실무자/당사자)을 판정해 prop 으로 내린다. isSuperAdmin 은 상위가 판정.
 */
export default function SuperAdminSwitcherMount({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname()
  const current: 'admin' | 'supporter' | 'participant' = pathname?.startsWith('/admin')
    ? 'admin'
    : pathname?.startsWith('/supporter')
      ? 'supporter'
      : 'participant'

  return <SuperAdminSwitcher isSuperAdmin={isSuperAdmin} current={current} />
}
