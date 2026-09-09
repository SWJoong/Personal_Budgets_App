'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { VIEW_AS_ID_COOKIE } from '@/utils/viewAsCookies'

/**
 * 당사자 하단 단일 주 액션 (FAB) — 사용자 요구 2026-08-21.
 * 설계: Plan&Source/goala_budget_screen_ux_W.md §6.
 *
 * 당사자는 대개 오른손 엄지 하나로 폰을 조작한다 → 주 동작 하나만 하단 중앙(엄지 자연 호)에 둔다.
 * '📷 내가 쓴 돈 적기' → /receipt(카메라 → 영수증 → OCR 자동채움 → 저장). TabBar(홈·달력·계획·더보기)와
 * 공존하며 /receipt 를 단독 소유한다(P4 — 영수증 탭 제거·중복 해소, TabBar 위에 배치). 지원자/관리자 화면과는 무관.
 *
 * 스펙: 원형 ≥64px(모터·easy-read), 하단 중앙 고정, safe-area 존중, 라벨 항상 노출(아이콘만 두지 않음).
 * FaqButton(bottom-20 right-4)과 좌우로 분리되어 충돌 없음.
 */
export default function ParticipantFab() {
  const pathname = usePathname()

  // 관리자 둘러보기(view-as) 중엔 지출 기록 진입점을 숨긴다(읽기전용 미리보기 · 저장 차단됨).
  // 쿠키를 클라이언트에서 읽으므로 하이드레이션 후 판정된다(SSR 기본값은 '보임').
  const [viewAs, setViewAs] = useState(false)
  useEffect(() => {
    const cookie = typeof document !== 'undefined' ? document.cookie : ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 클라 전용 쿠키를 마운트 후 읽어 동기화(SSR-safe)
    setViewAs(new RegExp('(?:^|; )' + VIEW_AS_ID_COOKIE + '=').test(cookie))
  }, [])

  // 이미 지출 기록 화면이면 숨김(중복). 방어적으로 지원자/관리자/로그인도 제외(이 레이아웃 밖이지만 안전).
  if (
    !pathname ||
    pathname.startsWith('/receipt') ||
    pathname.startsWith('/supporter') ||
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    viewAs
  ) {
    return null
  }

  // 접근성: 고정 위치 FAB 이 어떤 랜드마크에도 속하지 않으면 axe 'region' 위반(모든 콘텐츠는
  // 랜드마크 안에 있어야 함). region 랜드마크로 감싸 포함한다. ★navigation 이 아니라 region 인 이유:
  // 당사자 레이아웃의 navigation 랜드마크는 TabBar 하나로 고정(P4 계약, layout.test.tsx). FAB 을
  // 두 번째 nav 로 만들면 그 계약이 깨진다. 고정 위치는 <a> 에 그대로 둔다(래퍼는 0-높이 블록).
  return (
    <div role="region" aria-label="빠른 실행">
      <Link
        href="/receipt"
        aria-label="내가 쓴 돈 적기"
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center justify-center gap-0.5 min-w-[72px] min-h-[72px] px-6 rounded-full bg-hero text-hero-foreground shadow-2xl ring-4 ring-card active:scale-95 transition-transform"
      >
        <span className="text-2xl leading-none" aria-hidden="true">
          📷
        </span>
        <span className="text-xs font-bold whitespace-nowrap">내가 쓴 돈 적기</span>
      </Link>
    </div>
  )
}
