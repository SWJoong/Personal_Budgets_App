import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export const metadata = { title: '서류' }

export default async function CarePlanEditPage() {
  await requireStaff()
  return <ComingSoon title="이용계획서" emoji="📋" homeHref="/supporter/documents" homeLabel="서류함으로 가기" />
}
