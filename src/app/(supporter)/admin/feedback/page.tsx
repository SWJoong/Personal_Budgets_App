import { requireAdmin } from '@/utils/supabase/staff'
import ComingSoon from '@/components/ui/ComingSoon'

export const metadata = { title: '당사자 피드백' }

export default async function FeedbackPage() {
  await requireAdmin()
  return <ComingSoon title="당사자 피드백" emoji="💬" homeHref="/admin" homeLabel="대시보드로 가기" />
}
