import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function ReviewQueuePage() {
  await requireStaff()
  return <ComingSoon title="영수증 검토 대기열" emoji="🔍" homeHref="/supporter" homeLabel="대시보드로 가기" />
}
