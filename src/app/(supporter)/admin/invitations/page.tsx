import { requireAdmin } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function InvitationsPage() {
  await requireAdmin()
  return <ComingSoon title="사용자 초대" emoji="✉️" homeHref="/admin" homeLabel="대시보드로 가기" />
}
