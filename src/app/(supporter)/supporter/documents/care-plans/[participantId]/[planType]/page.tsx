import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function CarePlanEditPage() {
  await requireStaff()
  return <ComingSoon title="이용계획서" emoji="📋" homeHref="/supporter/documents" homeLabel="서류함으로 가기" />
}
