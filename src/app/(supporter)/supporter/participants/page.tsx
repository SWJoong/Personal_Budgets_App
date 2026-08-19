import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function ParticipantsOverviewPage() {
  await requireStaff()
  return <ComingSoon title="당사자 통합 현황" emoji="👥" homeHref="/supporter" homeLabel="대시보드로 가기" />
}
