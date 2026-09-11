import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/utils/supabase/staff'
import StaffReviewSuggestions from './StaffReviewSuggestions'

/**
 * 실무자용 AI 점검 제안 화면 (관리자 QA #6) — 담당 당사자의 예산 이행·점검 신호를 AI 가 우선순위 제안으로 합성.
 * 설계: Plan&Source/goala_staff_review_assistant_W.md §4. 온디맨드(버튼 클릭 시에만 액션 호출=비용 제어).
 * RLS: requireStaff + 참여자 스코프 조회(담당범위 밖이면 notFound).
 */
export const metadata = { title: 'AI 점검 제안' }

export default async function CheckupPage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params
  const { supabase } = await requireStaff()

  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) notFound()

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center min-w-0">
          <Link
            href={`/supporter/participants/${participantId}`}
            aria-label="뒤로 가기"
            className="text-muted-foreground hover:text-foreground transition-colors mr-3 min-w-[44px] min-h-[44px] flex items-center"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold tracking-tight truncate">
            {participant.name ?? '이름 없음'}님 점검 제안
          </h1>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6">
        <StaffReviewSuggestions participantId={participantId} />
      </main>
    </div>
  )
}
