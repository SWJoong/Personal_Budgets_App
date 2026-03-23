import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function SupporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  if ((userData as any)?.role === 'participant') { // 'participant' is the string role
    redirect('/')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* TODO: Add AdminSidebar component here */}
      <aside className="hidden w-64 bg-slate-800 text-white md:block">
        <div className="p-4 font-bold text-xl border-b border-slate-700">관리자/지원자 메뉴</div>
        {/* Placeholder for sidebar items */}
      </aside>
      
      <main className="flex-1 w-full bg-slate-50 relative">
        {children}
      </main>
    </div>
  );
}
