import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function BudgetDetailsPage() {
  await requireStaff()
  return <ComingSoon title="예산 상세" emoji="💰" homeHref="/supporter" homeLabel="대시보드로 가기" />
}
