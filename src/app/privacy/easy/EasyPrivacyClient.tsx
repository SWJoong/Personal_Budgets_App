'use client'

import Link from 'next/link'
import { speak } from '@/utils/tts'
import { PRIVACY_DRAFT } from '@/content/privacyPolicy'

/**
 * 개인정보 처리방침 — 쉬운 말판(당사자용, 발달장애인법 §10 의사소통지원).
 * 모든 문구 easyread `validate_easy_read` = pass 검증(오류0·경고0). 근거: docs/release/11 §3-2.
 * TTS(🔊)로 각 안내를 느린 한국어로 읽어 줌(Web Speech API). 그림(이모지) 병기.
 * ★확정 전 초안 배너(PRIVACY_DRAFT).
 */

interface EasySection {
  icon: string
  title: string
  /** 각 줄 = 짧은 한 문장(easyread 검증본). 화면은 줄 분리, TTS 는 이어 읽음. */
  lines: string[]
}

const SECTIONS: EasySection[] = [
  {
    icon: '📋',
    title: '우리가 모으는 정보',
    lines: [
      '우리 앱은 당신의 이름과 생년월일을 알아요.',
      '당신의 장애 정보도 알아요.',
      '돈을 어디에 썼는지 기록해요.',
      '활동 사진도 저장해요.',
    ],
  },
  {
    icon: '🎯',
    title: '왜 모으나요',
    lines: ['개인예산으로 무엇을 했는지 함께 잘 관리해요.'],
  },
  {
    icon: '🔒',
    title: '안전하게 지켜요',
    lines: ['당신의 정보는 안전하게 지켜요.', '담당 선생님과 관리자만 볼 수 있어요.'],
  },
  {
    icon: '🤖',
    title: '인공지능 안내',
    lines: [
      "'인공지능'은 사람처럼 생각하는 컴퓨터 프로그램이에요.",
      '우리 앱은 영수증 사진을 읽어서 금액을 자동으로 적어 줘요.',
      '이 일을 인공지능이 도와줘요.',
      '이 프로그램을 만든 회사는 미국에 있어요.',
      '그래서 사진과 글을 미국으로 보내요.',
      '글에서 이름과 기관 이름은 안 보이게 가려요.',
      '손으로 직접 적을 수도 있어요.',
    ],
  },
  {
    icon: '✋',
    title: '당신의 권리',
    lines: [
      '당신은 당신의 정보를 볼 수 있어요.',
      '정보를 고칠 수 있어요.',
      '정보를 지울 수 있어요.',
      '동의를 취소할 수 있어요.',
    ],
  },
  {
    icon: '💬',
    title: '궁금하면',
    lines: ['궁금한 점은 담당 선생님께 물어보세요.'],
  },
]

export default function EasyPrivacyClient() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-10 text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur-md">
        <Link
          href="/"
          aria-label="홈으로 가기"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-2xl text-muted-foreground transition-colors hover:text-foreground"
        >
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="flex-1 text-xl font-bold tracking-tight">개인정보 이야기</h1>
        <Link
          href="/privacy"
          className="inline-flex min-h-11 items-center rounded-xl bg-muted px-3 text-sm font-bold text-foreground hover:bg-muted-hover"
        >
          전문 보기
        </Link>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-6"
      >
        {PRIVACY_DRAFT && (
          <p className="rounded-2xl bg-warning-bg px-5 py-4 text-center font-bold text-warning-fg break-keep">
            이 안내는 아직 준비 중이에요.
          </p>
        )}

        <div className="py-2 text-center">
          <p className="text-lg font-bold text-muted-foreground break-keep">
            우리 앱이 당신의 정보를<br />어떻게 지키는지 알려드려요.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {SECTIONS.map((s) => (
            <section
              key={s.title}
              className="flex flex-col gap-4 rounded-[2.5rem] bg-card p-8 shadow-sm ring-1 ring-border"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-5xl" aria-hidden="true">
                    {s.icon}
                  </span>
                  <h2 className="text-xl font-black text-foreground break-keep">{s.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => speak(`${s.title}. ${s.lines.join(' ')}`)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm transition-all hover:bg-muted-hover active:scale-95"
                  aria-label={`${s.title} 음성으로 듣기`}
                >
                  🔊
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {s.lines.map((line, i) => (
                  <p key={i} className="text-lg font-bold leading-relaxed text-muted-foreground break-keep">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Link
          href="/"
          className="mt-2 w-full rounded-3xl bg-hero py-5 text-center text-xl font-black text-hero-foreground shadow-xl transition-all active:scale-95"
        >
          다 읽었어요! 홈으로 가기
        </Link>
      </main>
    </div>
  )
}
