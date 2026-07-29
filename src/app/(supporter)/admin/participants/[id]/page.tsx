import { requireAdmin } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function ParticipantDetailPage() {
  await requireAdmin()
  return <ComingSoon title="당사자 상세" emoji="👤" homeHref="/admin/participants" homeLabel="목록으로 가기" />
}
