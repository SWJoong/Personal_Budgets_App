import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function TransactionDetailPage() {
  await requireStaff()
  return <ComingSoon title="거래 상세" emoji="🧾" homeHref="/supporter/transactions" homeLabel="장부로 가기" />
}
