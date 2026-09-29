"use client"

import { useState } from 'react'
import { useAccessibility } from '@/hooks/useAccessibility'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Term } from '@/components/ui/Term'

interface FileLink {
  id: string
  title: string
  url: string
  file_type: string
}

function SectionToggle({
  title,
  open,
  onToggle,
}: {
  title: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full min-h-[44px] flex items-center justify-between py-1 mb-2"
    >
      <h2 className="text-sm font-black text-foreground uppercase tracking-widest ml-2">{title}</h2>
      <span className="text-muted-foreground text-xs font-bold mr-1"><span aria-hidden="true">{open ? '▲' : '▼'}</span> {open ? '접기' : '펼치기'}</span>
    </button>
  )
}

/**
 * 화면설정 켜기/끄기 스위치 — 보이는 트랙(w-14 h-8)은 버튼 자신이고, 세로 터치 영역만 ::before 로 44px.
 * 가로는 트랙 56px 로 이미 44px 이상. 세로 히트영역은 테두리(고대비 2px)와 무관하게 h-11 고정·가운데 정렬.
 *
 * 테마 CSS(globals.css)와의 관계 — 트랙 색이 모든 모드에서 살아 있어야 한다(1.4.11):
 * - 다크·고대비 규칙 `.participant-view [class*="rounded-"]:not(button)…` 은 !important 로 배경을
 *   카드색(다크 #1a2540)·흰색(고대비)으로 덮는다. 트랙을 안쪽 span 으로 옮기면 켜짐/꺼짐 색이 사라지므로
 *   트랙은 반드시 버튼 자신(`:not(button)` 예외)이어야 한다. 버튼에는 고대비 2px 검정 테두리만 더해진다.
 * - 손잡이(span)는 그 규칙에 걸려 다크 #1a2540·고대비 #fff(2px 검정 테두리)로 바뀐다 — 두 트랙 색 모두와
 *   3:1 이상이 되도록 트랙 토큰을 고른다.
 * - 꺼짐 트랙은 bg-muted-foreground: bg-muted 는 카드 위 약 1.1:1 이라 꺼진 스위치 모양이 안 보였다.
 *   (앱 CSS 실측, 카드 대비 = 손잡이 대비: 꺼짐 라이트·노랑 6.1 · 다크 5.0 · 고대비 6.5 / 켜짐 5.1 · 6.3 · 9.6.)
 *   켜짐은 bg-primary(모드별 토큰 재정의).
 * - 색 말고도 상태가 보이게: 손잡이 위치(왼쪽=꺼짐/오른쪽=켜짐) + 켜짐일 때 손잡이 안 체크 표시(장식).
 */
function SettingSwitch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative shrink-0 w-14 h-8 rounded-full transition-all duration-300 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 ${checked ? 'bg-primary' : 'bg-muted-foreground'}`}
    >
      <span className={`absolute top-1 w-6 h-6 rounded-full bg-card shadow-md flex items-center justify-center transition-all duration-300 ${checked ? 'left-7' : 'left-1'}`}>
        {checked && (
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5 text-primary"
          >
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        )}
      </span>
    </button>
  )
}

export default function MoreMenuClient({
  fileLinks,
  initialOpenSection,
}: {
  fileLinks: FileLink[]
  initialOpenSection?: string
}) {
  const { fontSize, setFontSize, highContrast, setHighContrast, easyTerms, setEasyTerms, yellowBg, setYellowBg, darkMode, setDarkMode } = useAccessibility()
  const supabase = createClient()
  const router = useRouter()

  const [openMyRecord, setOpenMyRecord] = useState(true)
  const [openQuickNav, setOpenQuickNav] = useState(true)
  const [openDisplay, setOpenDisplay] = useState(initialOpenSection === 'display')
  const [openFiles, setOpenFiles] = useState(initialOpenSection === 'files')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 나의 기록 */}
      <section className="flex flex-col">
        <SectionToggle title="나의 기록" open={openMyRecord} onToggle={() => setOpenMyRecord(v => !v)} />
        {openMyRecord && (
          <div className="flex flex-col gap-3">
            <Link
              href="/my-plan"
              className="flex items-center justify-between p-5 rounded-[2rem] bg-primary text-primary-foreground shadow-xl hover:bg-primary-hover transition-all active:scale-[0.98] group"
            >
              <div className="flex items-center gap-4">
                <span aria-hidden="true" className="text-3xl group-hover:scale-110 transition-transform">🎯</span>
                <div className="flex flex-col">
                  <span className="text-lg font-black">내 <Term formal="이용계획" /></span>
                  <span className="text-xs font-bold text-primary-foreground">계획과 결과를 봐요</span>
                </div>
              </div>
              <span aria-hidden="true" className="text-2xl">▸</span>
            </Link>
            <Link
              href="/evaluations"
              className="flex items-center justify-between p-5 rounded-[2rem] bg-hero text-hero-foreground shadow-xl hover:bg-hero-hover transition-all active:scale-[0.98] group"
            >
              <div className="flex items-center gap-4">
                <span aria-hidden="true" className="text-3xl group-hover:scale-110 transition-transform">💌</span>
                <div className="flex flex-col">
                  <span className="text-lg font-black">선생님이 남긴 기록</span>
                  <span className="text-xs font-bold text-hero-foreground">나의 한 달 활동 이야기 보기</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-2xl">▸</span>
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* 빠른 이동 */}
      <section className="flex flex-col">
        <SectionToggle title="빠른 이동" open={openQuickNav} onToggle={() => setOpenQuickNav(v => !v)} />
        {openQuickNav && (
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/plan"
              className="relative flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card ring-1 ring-border shadow-sm hover:ring-primary transition-all active:scale-[0.98] group"
            >
              <span aria-hidden="true" className="text-3xl group-hover:scale-110 transition-transform">🤔</span>
              <span className="text-sm font-black text-foreground">해보고 싶은 것</span>
            </Link>
            <Link
              href="/calendar"
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card ring-1 ring-border shadow-sm hover:ring-primary transition-all active:scale-[0.98] group"
            >
              <span aria-hidden="true" className="text-3xl group-hover:scale-110 transition-transform">📅</span>
              <span className="text-sm font-black text-foreground">달력</span>
            </Link>
            <Link
              href="/map"
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card ring-1 ring-border shadow-sm hover:ring-primary transition-all active:scale-[0.98] group"
            >
              <span aria-hidden="true" className="text-3xl group-hover:scale-110 transition-transform">🗺️</span>
              <span className="text-sm font-black text-foreground">사용 장소 지도</span>
            </Link>
            <Link
              href="/gallery"
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card ring-1 ring-border shadow-sm hover:ring-primary transition-all active:scale-[0.98] group"
            >
              <span aria-hidden="true" className="text-3xl group-hover:scale-110 transition-transform">📸</span>
              <span className="text-sm font-black text-foreground">사진 모아보기</span>
            </Link>
            <Link
              href="/guide"
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card ring-1 ring-border shadow-sm hover:ring-primary transition-all active:scale-[0.98] group"
            >
              <span aria-hidden="true" className="text-3xl group-hover:scale-110 transition-transform">📖</span>
              <span className="text-sm font-black text-foreground">앱 사용 안내</span>
            </Link>
            <Link
              href="/settings/profile"
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card ring-1 ring-border shadow-sm hover:ring-primary transition-all active:scale-[0.98] group"
            >
              <span aria-hidden="true" className="text-3xl group-hover:scale-110 transition-transform">👤</span>
              <span className="text-sm font-black text-foreground">내 정보</span>
            </Link>
          </div>
        )}
      </section>

      {/* 화면 설정 */}
      <section className="flex flex-col">
        <SectionToggle title="화면 설정" open={openDisplay} onToggle={() => setOpenDisplay(v => !v)} />
        {openDisplay && (
          <div className="bg-card rounded-[2rem] p-6 ring-1 ring-border shadow-sm flex flex-col gap-6">
            {/* 글자 크기 */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-bold text-muted-foreground"><span aria-hidden="true">🔤</span> 글자 크기를 조절할 수 있어요.</p>
              <div className="flex gap-2">
                {([
                  { id: 'normal', label: '가', size: '기본' },
                  { id: 'large', label: '가', size: '크게' },
                  { id: 'huge', label: '가', size: '매우 크게' },
                ] as const).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setFontSize(s.id)}
                    className={`flex-1 flex flex-col items-center justify-center py-4 rounded-2xl transition-all border-2
                      ${fontSize === s.id
                        ? 'bg-primary border-primary text-primary-foreground shadow-lg scale-105'
                        : 'bg-muted border-transparent text-muted-foreground hover:bg-muted-hover hover:text-foreground'}
                    `}
                  >
                    <span className={`font-black ${s.id === 'normal' ? 'text-sm' : s.id === 'large' ? 'text-xl' : 'text-3xl'}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] font-bold mt-1">{s.size}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 고대비 모드 */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground"><span aria-hidden="true">🌗</span> 글씨가 더 잘 보여요</span>
                <span className="text-xs text-muted-foreground font-medium">글씨와 배경의 대비를 높여요</span>
              </div>
              <SettingSwitch checked={highContrast} onToggle={() => setHighContrast(!highContrast)} label="글씨 더 잘 보이기 전환" />
            </div>

            {/* 다크 모드 */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground"><span aria-hidden="true">🌙</span> 다크 모드</span>
                <span className="text-xs text-muted-foreground font-medium">눈부심을 줄이기 위해 어두운 배경을 사용해요</span>
              </div>
              <SettingSwitch checked={darkMode} onToggle={() => setDarkMode(!darkMode)} label="다크 모드 전환" />
            </div>

            {/* 쉬운 말 모드 */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground"><span aria-hidden="true">💬</span> 쉬운 말 모드</span>
                <span className="text-xs text-muted-foreground font-medium">쉬운 말로 바꿔요</span>
              </div>
              <SettingSwitch checked={easyTerms} onToggle={() => setEasyTerms(!easyTerms)} label="쉬운 용어 모드 전환" />
            </div>

            {/* 노란 배경 모드 */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground"><span aria-hidden="true">🟡</span> 노란 배경 모드</span>
                <span className="text-xs text-muted-foreground font-medium">글 읽기 어려운 분을 위해 배경을 노란색으로 바꿔요</span>
              </div>
              <SettingSwitch checked={yellowBg} onToggle={() => setYellowBg(!yellowBg)} label="노란 배경 모드 전환" />
            </div>
          </div>
        )}
      </section>

      {/* 내 서류함 */}
      <section className="flex flex-col">
        <SectionToggle title="내 서류함" open={openFiles} onToggle={() => setOpenFiles(v => !v)} />
        {openFiles && (
          <div className="bg-card rounded-[2rem] p-6 ring-1 ring-border shadow-sm flex flex-col gap-3">
            {fileLinks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <span aria-hidden="true" className="text-4xl block mb-2">📁</span>
                <p className="text-sm font-bold">아직 등록한 서류가 없어요.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {fileLinks.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${file.title} (새 창으로 열림)`}
                    className="flex items-center justify-between p-4 rounded-2xl bg-muted hover:bg-muted-hover transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="text-2xl">📄</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-foreground">{file.title}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{file.file_type}</span>
                      </div>
                    </div>
                    <span aria-hidden="true" className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 로그아웃 */}
      <section className="flex flex-col gap-4">
        <button
          onClick={handleLogout}
          className="w-full p-5 rounded-[2rem] bg-danger-bg text-danger-fg font-black text-center ring-1 ring-border hover:bg-danger-bg-hover transition-all active:scale-95"
        >
          안전하게 나가기
        </button>
      </section>
    </div>
  )
}
