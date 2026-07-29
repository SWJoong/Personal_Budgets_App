import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function TransactionsPage() {
  await requireStaff()
  return <ComingSoon title="거래장부" emoji="🧾" homeHref="/supporter" homeLabel="대시보드로 가기" />
}
