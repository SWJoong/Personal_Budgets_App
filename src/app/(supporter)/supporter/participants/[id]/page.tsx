import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function ParticipantDashboardPage() {
  await requireStaff()
  return <ComingSoon title="당사자 통합 현황" emoji="👤" homeHref="/supporter/participants" homeLabel="목록으로 가기" />
}
