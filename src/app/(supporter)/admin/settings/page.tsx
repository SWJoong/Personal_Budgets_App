import { requireAdmin } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function AdminSettingsPage() {
  await requireAdmin()
  return <ComingSoon title="시스템 설정" emoji="⚙️" homeHref="/admin" homeLabel="대시보드로 가기" />
}
