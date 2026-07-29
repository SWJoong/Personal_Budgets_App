import { requireAdmin } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function ParticipantPreviewPage() {
  await requireAdmin()
  return <ComingSoon title="당사자 화면 미리보기" emoji="👁️" homeHref="/admin/participants" homeLabel="목록으로 가기" />
}
