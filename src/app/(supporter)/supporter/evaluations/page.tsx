import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function EvaluationsPage() {
  await requireStaff()
  return <ComingSoon title="계획과 평가" emoji="📝" homeHref="/supporter" homeLabel="대시보드로 가기" />
}
