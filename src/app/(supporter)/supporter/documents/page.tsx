import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function SupporterDocumentsPage() {
  await requireStaff()
  return <ComingSoon title="증빙 및 서류 관리" emoji="🗂️" homeHref="/supporter" homeLabel="대시보드로 가기" />
}
