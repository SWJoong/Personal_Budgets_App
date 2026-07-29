import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ComingSoon from '@/components/ui/ComingSoon'

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <ComingSoon title="지도" emoji="🗺️" />
}
