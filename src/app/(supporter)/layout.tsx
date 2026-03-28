import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { SupporterLayoutClient } from './SupporterLayoutClient'

export const dynamic = 'force-dynamic'

export default async function SupporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Demo mode: Skip authentication
  // In production, enable authentication by setting NEXT_PUBLIC_DEMO_MODE=false
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'

  if (!isDemoMode) {
    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {}
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      redirect('/login')
    }

    const { data: userData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if ((userData as any)?.role === 'participant') {
      redirect('/')
    }
  }

  return <SupporterLayoutClient>{children}</SupporterLayoutClient>
}
