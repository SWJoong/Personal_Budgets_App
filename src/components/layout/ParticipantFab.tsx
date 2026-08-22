'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * 당사자 하단 단일 주 액션 (FAB) — 사용자 요구 2026-08-21.
 * 설계: Plan&Source/goala_budget_screen_ux_W.md §6.
 *
 * 당사자는 대개 오른손 엄지 하나로 폰을 조작한다 → 주 동작 하나만 하단 중앙(엄지 자연 호)에 둔다.
 * '📷 내가 쓴 돈 적기' → /receipt(카메라 → 영수증 → OCR 자동채움 → 저장). 기존 TabBar(홈·영수증·더보기)를
 * 대체한다(더보기는 홈 헤더 ⚙ 로 이관). 지원자/관리자 화면과는 무관(경로로 제외).
 *
 * 스펙: 원형 ≥64px(모터·easy-read), 하단 중앙 고정, safe-area 존중, 라벨 항상 노출(아이콘만 두지 않음).
 * FaqButton(bottom-20 right-4)과 좌우로 분리되어 충돌 없음.
 */
export default function ParticipantFab() {
  const pathname = usePathname()
  // 이미 지출 기록 화면이면 숨김(중복). 방어적으로 지원자/관리자/로그인도 제외(이 레이아웃 밖이지만 안전).
  if (
    !pathname ||
    pathname.startsWith('/receipt') ||
    pathname.startsWith('/supporter') ||
    pathname.startsWith('/admin') ||
    pathname === '/login'
  ) {
    return null
  }

  return (
    <Link
      href="/receipt"
      aria-label="내가 쓴 돈 적기"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center justify-center gap-0.5 min-w-[72px] min-h-[72px] px-6 rounded-full bg-zinc-900 text-white shadow-2xl ring-4 ring-white active:scale-95 transition-transform"
    >
      <span className="text-2xl leading-none" aria-hidden="true">
        📷
      </span>
      <span className="text-xs font-bold whitespace-nowrap">내가 쓴 돈 적기</span>
    </Link>
  )
}
