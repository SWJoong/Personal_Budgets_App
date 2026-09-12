'use client'

import { useTransition } from 'react'
import { superAdminSwitch } from '@/app/actions/viewAs'

type RoleView = 'admin' | 'supporter' | 'participant'

const ROLES: { key: RoleView; label: string; icon: string }[] = [
  { key: 'admin', label: '관리자', icon: '🏢' },
  { key: 'supporter', label: '실무자', icon: '🧑‍💼' },
  { key: 'participant', label: '당사자', icon: '🙂' },
]

/**
 * 슈퍼관리자(운영자) 전용 우측 상단 역할 화면 전환기.
 * 설계: Plan&Source/goala_balance_widget_roleswitch_W.md §2-2. 계약: SuperAdminSwitcher.test.tsx.
 *
 * ★안전: 권한 확장이 아니라 '표시 대상 전환'(기존 view-as 모델 재사용). 실제 전환은 서버 액션
 *   superAdminSwitch(assertAdmin) 가 수행하므로, UI 가 잘못 노출돼도 비관리자가 누르면 서버가 거부한다.
 *   isSuperAdmin 판정은 상위(서버 레이아웃 또는 클라 게이트)가 내려준다.
 *
 * current: 지금 보고 있는 화면. 이 컴포넌트는 라우터 훅을 쓰지 않는 순수 컴포넌트다(테스트가 라우터
 *   컨텍스트를 제공하지 않음) — 경로 판정은 상위 Mount 가 usePathname 으로 담당해 prop 으로 내린다.
 *
 * 접근성: 3개 컨트롤 모두 '텍스트' 라벨(관리자/실무자/당사자, 이모지는 aria-hidden 장식)로 쉬운 정보
 *   원칙을 지킨다. 현재 화면 버튼은 aria-pressed=true + 시맨틱 토큰으로 강조 → 색만으로 전달하지 않는다.
 */
export default function SuperAdminSwitcher({
  isSuperAdmin,
  current,
}: {
  isSuperAdmin: boolean
  current: RoleView
}) {
  const [pending, startTransition] = useTransition()

  if (!isSuperAdmin) return null

  return (
    <div className="fixed top-2 right-2 z-[80] print:hidden flex items-center gap-1.5 rounded-full bg-card ring-1 ring-border shadow-lg px-2 py-1">
      <span aria-hidden="true" className="pl-1 text-base leading-none">🛡️</span>
      <div role="group" aria-label="역할 화면 전환" className="flex items-center gap-1">
        {ROLES.map(({ key, label, icon }) => {
          const active = key === current
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => startTransition(() => { superAdminSwitch(key) })}
              className={
                'flex items-center gap-1 min-h-[44px] px-3 rounded-full text-sm font-bold transition-colors disabled:opacity-60 ' +
                (active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted-hover')
              }
            >
              <span aria-hidden="true" className="text-base leading-none">{icon}</span>{label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
