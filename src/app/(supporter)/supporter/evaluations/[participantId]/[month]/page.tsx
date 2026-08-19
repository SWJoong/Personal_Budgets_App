import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function EvaluationDetailPage() {
  await requireStaff()
  return <ComingSoon title="월별 평가" emoji="📝" homeHref="/supporter/evaluations" homeLabel="계획과 평가로 가기" />
}
