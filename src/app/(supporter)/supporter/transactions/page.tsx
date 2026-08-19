import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function TransactionsPage() {
  await requireStaff()
  return <ComingSoon title="거래 및 회계 관리" emoji="🧾" homeHref="/supporter" homeLabel="대시보드로 가기" />
}
