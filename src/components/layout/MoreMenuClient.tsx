"use client"

import { useState } from 'react'
import { useAccessibility } from '@/hooks/useAccessibility'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
      <span className="text-muted-foreground text-xs font-bold mr-1">{open ? '▲ 접기' : '▼ 펼치기'}</span>
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
                  <span className="text-lg font-black">내 이용계획</span>
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
                  <span className="text-lg font-black">지원자 선생님의 편지</span>
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
              <span className="text-3xl group-hover:scale-110 transition-transform">🤔</span>
              <span className="text-sm font-black text-foreground">해보고 싶은 것</span>
            </Link>
            <Link
              href="/calendar"
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card ring-1 ring-border shadow-sm hover:ring-primary transition-all active:scale-[0.98] group"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">📅</span>
              <span className="text-sm font-black text-foreground">달력</span>
            </Link>
            <Link
              href="/map"
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card ring-1 ring-border shadow-sm hover:ring-primary transition-all active:scale-[0.98] group"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">🗺️</span>
              <span className="text-sm font-black text-foreground">사용 장소 지도</span>
            </Link>
            <Link
              href="/gallery"
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[2rem] bg-card ring-1 ring-border shadow-sm hover:ring-primary transition-all active:scale-[0.98] group"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">📸</span>
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
              <p className="text-sm font-bold text-muted-foreground">🔤 글자 크기를 조절할 수 있어요.</p>
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
                <span className="text-sm font-bold text-foreground">🌗 글씨가 더 잘 보여요</span>
                <span className="text-xs text-muted-foreground font-medium">글씨와 배경의 대비를 높여요</span>
              </div>
              <button
                onClick={() => setHighContrast(!highContrast)}
                className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                role="switch"
                aria-checked={highContrast}
                aria-label="글씨 더 잘 보이기 전환"
              >
                <span className={`relative block w-14 h-8 rounded-full transition-all duration-300 ${highContrast ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`absolute top-1 w-6 h-6 rounded-full bg-card shadow-md transition-all duration-300 ${highContrast ? 'left-7' : 'left-1'}`} />
                </span>
              </button>
            </div>

            {/* 다크 모드 */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">🌙 다크 모드</span>
                <span className="text-xs text-muted-foreground font-medium">눈부심을 줄이기 위해 어두운 배경을 사용해요</span>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`relative w-14 h-8 rounded-full transition-all duration-300 ${darkMode ? 'bg-primary' : 'bg-muted'}`}
                role="switch"
                aria-checked={darkMode}
                aria-label="다크 모드 전환"
              >
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-card shadow-md transition-all duration-300 ${darkMode ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* 쉬운 말 모드 */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">💬 쉬운 말 모드</span>
                <span className="text-xs text-muted-foreground font-medium">쉬운 말로 바꿔요</span>
              </div>
              <button
                onClick={() => setEasyTerms(!easyTerms)}
                className={`relative w-14 h-8 rounded-full transition-all duration-300 ${easyTerms ? 'bg-primary' : 'bg-muted'}`}
                role="switch"
                aria-checked={easyTerms}
                aria-label="쉬운 용어 모드 전환"
              >
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-card shadow-md transition-all duration-300 ${easyTerms ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {/* 노란 배경 모드 */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">🟡 노란 배경 모드</span>
                <span className="text-xs text-muted-foreground font-medium">글 읽기 어려운 분을 위해 배경을 노란색으로 바꿔요</span>
              </div>
              <button
                onClick={() => setYellowBg(!yellowBg)}
                className={`relative w-14 h-8 rounded-full transition-all duration-300 ${yellowBg ? 'bg-primary' : 'bg-muted'}`}
                role="switch"
                aria-checked={yellowBg}
                aria-label="노란 배경 모드 전환"
              >
                <div className={`absolute top-1 w-6 h-6 rounded-full bg-card shadow-md transition-all duration-300 ${yellowBg ? 'left-7' : 'left-1'}`} />
              </button>
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
                <span className="text-4xl block mb-2">📁</span>
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
                    className="flex items-center justify-between p-4 rounded-2xl bg-muted hover:bg-muted-hover transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="text-2xl">📄</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-foreground">{file.title}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{file.file_type}</span>
                      </div>
                    </div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
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
