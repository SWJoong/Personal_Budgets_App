import { requireStaff } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function MapPage() {
  await requireStaff()
  return <ComingSoon title="지도" emoji="🗺️" homeHref="/supporter" homeLabel="대시보드로 가기" />
}
