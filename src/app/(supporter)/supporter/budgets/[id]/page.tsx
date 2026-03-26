import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import BudgetDetailsView from '@/components/budgets/BudgetDetailsView'

export default async function BudgetDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'supporter')) {
    redirect('/')
  }

  const { data: participant, error } = await supabase
    .from('participants')
    .select(`
      *,
      funding_sources(*)
    `)
    .eq('id', id)
    .single()

  if (error || !participant) {
    notFound()
  }

  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('participant_id', id)
    .order('date', { ascending: false })
    .limit(10)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDayOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`

  const { data: thisMonthTransactions } = await supabase
    .from('transactions')
    .select('amount')
    .eq('participant_id', id)
    .gte('date', firstDayOfMonth)
    .lte('date', lastDayOfMonth)

  const thisMonthSpent = (thisMonthTransactions || []).reduce(
    (sum: number, t: any) => sum + Number(t.amount),
    0
  )

  const totalMonthlyBudget = (participant.funding_sources || []).reduce(
    (acc: number, fs: any) => acc + Number(fs.monthly_budget),
    0
  ) || participant.monthly_budget_default || 0

  return (
    <BudgetDetailsView
      participant={participant}
      fundingSources={participant.funding_sources || []}
      recentTransactions={recentTransactions || []}
      thisMonthSpent={thisMonthSpent}
      totalMonthlyBudget={totalMonthlyBudget}
      userRole={profile.role}
    />
  )
}
