import { createAdminClient } from '@/utils/supabase/server'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function FeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'supporter'].includes(profile.role)) redirect('/')

  const admin = createAdminClient()

  // 전체 피드백 집계
  const { data: allFeedback } = await admin
    .from('participant_feedback')
    .select('id, participant_id, context, response, created_at')
    .order('created_at', { ascending: false })

  const feedbacks = allFeedback ?? []

  // 이모지별 집계
  const positive = feedbacks.filter(f => f.response === '😊').length
  const neutral = feedbacks.filter(f => f.response === '😐').length
  const negative = feedbacks.filter(f => f.response === '😔').length
  const total = feedbacks.length

  // 맥락별 집계
  const CONTEXTS: Record<string, string> = {
    receipt_upload: '🧾 활동 기록',
    calendar: '📅 달력',
    onboarding: '🚀 시작 설정',
  }
  const contextCounts = Object.entries(CONTEXTS).map(([key, label]) => {
    const group = feedbacks.filter(f => f.context === key)
    return {
      key,
      label,
      total: group.length,
      positive: group.filter(f => f.response === '😊').length,
      negative: group.filter(f => f.response === '😔').length,
    }
  })

  // 최근 30일 필터
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recent = feedbacks.filter(f => new Date(f.created_at) >= thirtyDaysAgo)
  const recentPositive = recent.filter(f => f.response === '😊').length
  const recentNegative = recent.filter(f => f.response === '😔').length

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 sticky top-0 bg-white/90 backdrop-blur-md border-b border-zinc-200 z-20">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-zinc-400 hover:text-zinc-600 transition-colors text-xl font-bold">←</Link>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">당사자 피드백</h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* 전체 요약 */}
        <section className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">전체 응답 요약</h2>
          {total === 0 ? (
            <p className="text-zinc-400 font-bold text-sm text-center py-4">아직 피드백이 없어요.</p>
          ) : (
            <div className="flex gap-4 justify-around">
              <div className="flex flex-col items-center gap-1">
                <span className="text-4xl">😊</span>
                <span className="text-2xl font-black text-zinc-900">{positive}</span>
                <span className="text-xs font-bold text-zinc-400">쉬웠어요</span>
              </div>
              {neutral > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl">😐</span>
                  <span className="text-2xl font-black text-zinc-900">{neutral}</span>
                  <span className="text-xs font-bold text-zinc-400">보통이에요</span>
                </div>
              )}
              <div className="flex flex-col items-center gap-1">
                <span className="text-4xl">😔</span>
                <span className="text-2xl font-black text-zinc-900">{negative}</span>
                <span className="text-xs font-bold text-zinc-400">어려웠어요</span>
              </div>
            </div>
          )}
          {total > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-100 text-sm text-zinc-500 font-bold text-center">
              총 {total}건 · 만족도 {total > 0 ? Math.round((positive / total) * 100) : 0}%
            </div>
          )}
        </section>

        {/* 최근 30일 */}
        <section className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">최근 30일</h2>
          <div className="flex gap-6 items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">😊</span>
              <span className="text-xl font-black text-zinc-900">{recentPositive}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">😔</span>
              <span className="text-xl font-black text-zinc-900">{recentNegative}</span>
            </div>
            <span className="text-sm text-zinc-400 font-bold ml-auto">총 {recent.length}건</span>
          </div>
        </section>

        {/* 맥락별 집계 */}
        <section className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">기능별 피드백</h2>
          <div className="flex flex-col gap-3">
            {contextCounts.map(c => (
              <div key={c.key} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50">
                <span className="text-lg font-bold text-zinc-700 w-28 shrink-0">{c.label}</span>
                <div className="flex gap-3 text-sm font-bold">
                  <span>😊 {c.positive}</span>
                  <span>😔 {c.negative}</span>
                </div>
                <span className="ml-auto text-xs text-zinc-400 font-bold">{c.total}건</span>
              </div>
            ))}
          </div>
        </section>

        {/* 최근 피드백 목록 */}
        {feedbacks.length > 0 && (
          <section className="bg-white rounded-[2rem] p-6 ring-1 ring-zinc-200 shadow-sm">
            <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">최근 피드백 20건</h2>
            <div className="flex flex-col gap-2">
              {feedbacks.slice(0, 20).map(f => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-50">
                  <span className="text-xl">{f.response}</span>
                  <span className="text-xs font-bold text-zinc-500">{CONTEXTS[f.context] ?? f.context}</span>
                  <span className="ml-auto text-[10px] text-zinc-400 font-bold">
                    {f.created_at.slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
