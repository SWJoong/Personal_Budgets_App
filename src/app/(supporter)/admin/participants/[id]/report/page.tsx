import { requireAdmin } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export const metadata = { title: '월간 보고서' }

export default async function ParticipantReportPage() {
  await requireAdmin()
  return <ComingSoon title="월간 보고서" emoji="🖨️" homeHref="/admin/participants" homeLabel="목록으로 가기" />
}
