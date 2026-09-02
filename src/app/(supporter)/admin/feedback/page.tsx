import Link from 'next/link'
import { requireAdmin } from '@/utils/supabase/staff'
import { getFeedback } from '@/app/actions/feedback'

export const metadata = { title: '당사자 피드백' }

/** SelfCheckFeedback 이 남긴 감정 이모지 → 쉬운 말 라벨(a11y: 이모지는 aria-hidden, 라벨을 읽힌다). */
const RESPONSE_LABEL: Record<string, string> = { '😊': '좋았어요', '😔': '아쉬웠어요' }

/**
 * 당사자 피드백 (GOAL축 A, §4-5) — ComingSoon 스텁 대체. 관리자가 당사자들이 남긴 화면 피드백을 열람.
 * getFeedback(feedback.ts, U 신설) 이 admin 게이트 후 전량 조회+이름 조인. 답변 기능은 이번 스코프 밖(열람 우선).
 */
export default async function FeedbackPage() {
  await requireAdmin()
  const { feedback, error } = await getFeedback()

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <Link
          href="/admin"
          aria-label="대시보드로 가기"
          className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
        >
          ←
        </Link>
        <h1 className="text-xl font-bold tracking-tight">당사자 피드백</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        {error ? (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm leading-relaxed">
            {error}
          </div>
        ) : feedback.length === 0 ? (
          <p className="text-sm text-zinc-500 leading-relaxed py-12 text-center">아직 받은 피드백이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {feedback.map((f) => (
              <li key={f.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0 gap-0.5">
                  <span className="font-bold text-zinc-800 truncate">{f.participantName}</span>
                  {f.context && <span className="text-sm text-zinc-600 leading-relaxed">{f.context}</span>}
                  <span className="text-xs text-zinc-400">{f.created_at?.slice(0, 10)}</span>
                </div>
                {f.response && (
                  <span className="shrink-0 flex flex-col items-center gap-0.5">
                    <span className="text-2xl" aria-hidden="true">{f.response}</span>
                    <span className="text-[11px] text-zinc-500">{RESPONSE_LABEL[f.response] ?? ''}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
