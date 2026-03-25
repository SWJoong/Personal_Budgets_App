import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed) redirect('/')

  // Fetch existing supporters for participant selection
  const { data: supporters } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .eq('role', 'supporter')

  // Fetch existing participants for supporter selection
  const { data: participants } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .eq('role', 'participant')
    .eq('onboarding_completed', true)

  return (
    <OnboardingClient
      userId={user.id}
      userEmail={user.email || ''}
      userName={profile?.name || user.user_metadata?.full_name || ''}
      userAvatar={user.user_metadata?.avatar_url || ''}
      supporters={supporters || []}
      participants={participants || []}
    />
  )
}
