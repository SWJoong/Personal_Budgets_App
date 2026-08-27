import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export const metadata = { title: '지출 추가' }

export default async function NewTransactionPage() {
  await requireStaff()
  return <ComingSoon title="지출 등록" emoji="🧾" homeHref="/supporter/transactions" homeLabel="장부로 가기" />
}
