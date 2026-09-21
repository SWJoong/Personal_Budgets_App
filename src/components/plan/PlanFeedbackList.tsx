import { planFeedbackKindLabel } from '@/utils/planFeedback'
import { formatDate } from '@/utils/formatDate'
import type { PlanFeedbackRow } from '@/app/actions/planFeedback'

/**
 * 계획 피드백 목록(읽기 전용·표시 전용) — 당사자 화면·실무자 계획상세 공용. 훅 없음 → 서버·클라 모두 사용 가능.
 */
export default function PlanFeedbackList({ feedback }: { feedback: PlanFeedbackRow[] }) {
  if (feedback.length === 0) {
    return <p className="text-xs text-muted-foreground">아직 남긴 한마디가 없어요.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {feedback.map((f) => (
        <li key={f.id} className="text-sm p-3 rounded-xl bg-muted">
          <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
            <span className="font-bold">{f.kind === 'question' ? '❓ ' : '👍 '}{planFeedbackKindLabel(f.kind)}</span>
            <span>{formatDate(f.created_at)}</span>
          </div>
          {f.message && <p className="text-foreground leading-relaxed">{f.message}</p>}
        </li>
      ))}
    </ul>
  )
}
