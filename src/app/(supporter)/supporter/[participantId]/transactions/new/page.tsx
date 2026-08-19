import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function NewTransactionPage() {
  await requireStaff()
  return <ComingSoon title="지출 등록" emoji="🧾" homeHref="/supporter" homeLabel="대시보드로 가기" />
}
