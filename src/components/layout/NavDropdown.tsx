'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'

type NavItem = {
  href: string
  icon: string
  label: string
  soon?: boolean
  subs?: { href: string; icon: string; label: string; soon?: boolean }[]
}

// soon: true 인 항목은 아직 서울형 데이터로 다시 만들지 않아 ComingSoon 화면으로 이어진다.
const NAV_ITEMS: NavItem[] = [
  { href: '/',         icon: '🏠', label: '홈' },
  { href: '/receipt',  icon: '🧾', label: '영수증' },
  { href: '/calendar', icon: '📅', label: '달력' },
  { href: '/plan',     icon: '🤔', label: '나의 계획', soon: true },
  { href: '/gallery',  icon: '📸', label: '사진 모아보기' },
  { href: '/map',      icon: '🗺️', label: '사용 장소 지도' },
  {
    href: '/more',
    icon: '⚙️',
    label: '더보기',
    subs: [
      { href: '/my-plan',              icon: '🎯', label: '내 이용계획' },
      { href: '/evaluations',          icon: '💌', label: '지원자 선생님의 편지', soon: true },
      { href: '/more?open=display',    icon: '🌗', label: '화면 설정' },
      { href: '/more?open=files',      icon: '📁', label: '내 서류함' },
    ],
  },
]

function SoonBadge() {
  return (
    <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
      준비중
    </span>
  )
}

export default function NavDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // 페이지 이동 시 자동 닫기 (Esc·scroll-lock·포커스 트랩/복원은 Modal 프리미티브가 담당)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 라우트 변경 시 드롭다운 닫기(외부 nav 상태 동기화)
    setIsOpen(false)
  }, [pathname])

  return (
    <>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-all active:scale-95"
        aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="text-zinc-600 text-base font-black leading-none select-none">
          {isOpen ? '✕' : '☰'}
        </span>
      </button>

      {/* 우측 슬라이드 드로어 — Modal 로 포커스 트랩/복원·Esc·scroll-lock 확보(중앙 대신 우측 정렬 override) */}
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        label="페이지 이동 메뉴"
        containerClassName="flex justify-end"
        overlayClassName="bg-black/40"
        panelClassName="h-full w-64 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* 드로어 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <span className="text-sm font-black text-zinc-500 uppercase tracking-widest">메뉴</span>
          <button
            onClick={() => setIsOpen(false)}
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-colors"
            aria-label="메뉴 닫기"
          >
            <span className="text-zinc-600 text-sm font-black leading-none">✕</span>
          </button>
        </div>

        {/* 메뉴 목록 */}
        <nav aria-label="페이지 이동" className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors ${
                    isActive ? 'bg-zinc-50' : ''
                  }`}
                >
                  <span className="text-2xl w-8 text-center" aria-hidden="true">{item.icon}</span>
                  <span
                    className={`text-sm font-bold flex-1 ${
                      isActive ? 'text-zinc-900' : 'text-zinc-600'
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.soon && <SoonBadge />}
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                  )}
                </Link>

                {/* 서브 항목 (더보기 하위) */}
                {item.subs && (
                  <div className="flex flex-col pb-1">
                    {item.subs.map((sub) => {
                      const subBase = sub.href.split('?')[0]
                      const isSubActive = pathname === subBase
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setIsOpen(false)}
                          aria-current={isSubActive ? 'page' : undefined}
                          className={`flex items-center gap-2.5 pl-14 pr-5 py-2.5 hover:bg-zinc-50 transition-colors ${
                            isSubActive ? 'bg-zinc-50' : ''
                          }`}
                        >
                          <span className="text-base w-5 text-center shrink-0" aria-hidden="true">{sub.icon}</span>
                          <span
                            className={`text-xs font-bold flex-1 ${
                              isSubActive ? 'text-zinc-900' : 'text-zinc-500'
                            }`}
                          >
                            {sub.label}
                          </span>
                          {sub.soon && <SoonBadge />}
                          {isSubActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </Modal>
    </>
  )
}
