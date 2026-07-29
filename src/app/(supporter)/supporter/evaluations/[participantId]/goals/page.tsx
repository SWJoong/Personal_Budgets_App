import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function SupportGoalsPage() {
  await requireStaff()
  return <ComingSoon title="지원 목표" emoji="🎯" homeHref="/supporter/evaluations" homeLabel="계획과 평가로 가기" />
}
