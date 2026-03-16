import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency, getBudgetVisualInfo } from '@/utils/budget-visuals'

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 사용자 프로필 및 역할 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 당사자 예산 정보 조회
  const { data: participant } = await supabase
    .from('participants')
    .select('*, funding_sources(*)')
    .eq('id', user.id)
    .single();

  // 날짜 계산 (현재 달 기준)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const remainingDays = totalDaysInMonth - now.getDate() + 1;

  // 데이터가 없는 경우 (초기 설정 전)
  if (!participant && profile?.role === 'participant') {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <h1 className="text-xl font-bold tracking-tight">아름드리꿈터</h1>
        </header>
        <main className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-6 max-w-sm mx-auto">
          <span className="text-8xl">👋</span>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">반가워요!</h2>
            <p className="text-zinc-500 font-medium leading-relaxed">
              아직 예산 정보가 등록되지 않았습니다.<br />지원자 선생님께 문의해 주세요.
            </p>
          </div>
          <button className="mt-4 px-8 py-3 bg-zinc-100 text-zinc-500 rounded-xl font-bold pointer-events-none">
            준비 중입니다
          </button>
        </main>
      </div>
    );
  }

  // 관리자/지원자인 경우 당사자 목록으로 연결하거나 요약 표시 (MVP에서는 간단히 표시)
  if (profile?.role !== 'participant') {
    return (
       <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <h1 className="text-xl font-bold tracking-tight">아름드리꿈터</h1>
          <div className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold text-zinc-500">지원자</div>
        </header>
        <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-8">
          <section className="p-8 rounded-3xl bg-zinc-900 text-white shadow-xl relative overflow-hidden">
            <div className="flex flex-col gap-2 z-10 relative">
              <h2 className="text-2xl font-bold tracking-tight">안녕하세요, {profile?.name || '지원자'}님!</h2>
              <p className="text-zinc-400 text-sm font-medium">담당하고 계신 당사자들의 예산을 관리하고<br />활동을 기록할 수 있습니다.</p>
            </div>
            <div className="absolute -right-4 -bottom-4 text-7xl opacity-20">📋</div>
          </section>
          
          <div className="grid grid-cols-1 gap-4">
             <button className="flex items-center justify-between p-6 rounded-2xl bg-card ring-1 ring-zinc-200 hover:ring-primary hover:bg-primary/5 transition-all group">
               <div className="flex items-center gap-4">
                 <span className="text-3xl">👥</span>
                 <div className="flex flex-col items-start">
                   <span className="font-bold text-zinc-700">당사자 목록 보기</span>
                   <span className="text-xs text-zinc-400">예산 설정 및 내역 확인</span>
                 </div>
               </div>
               <span className="text-zinc-300 group-hover:text-primary transition-colors">→</span>
             </button>
             
             <button className="flex items-center justify-between p-6 rounded-2xl bg-card ring-1 ring-zinc-200 hover:ring-primary hover:bg-primary/5 transition-all group">
               <div className="flex items-center gap-4">
                 <span className="text-3xl">📊</span>
                 <div className="flex flex-col items-start">
                   <span className="font-bold text-zinc-700">전체 통계 확인</span>
                   <span className="text-xs text-zinc-400">기관 전체 예산 흐름</span>
                 </div>
               </div>
               <span className="text-zinc-300 group-hover:text-primary transition-colors">→</span>
             </button>
          </div>
        </main>
      </div>
    )
  }

  // 당사자인 경우 시각화 데이터 계산
  // 여러 재원이 있을 경우 합산 (통합 보기 기본)
  const fundingSources = participant.funding_sources || [];
  const totalMonthlyBudget = fundingSources.reduce((acc: number, curr: any) => acc + Number(curr.monthly_budget), 0) || participant.monthly_budget_default;
  const currentBalance = fundingSources.reduce((acc: number, curr: any) => acc + Number(curr.current_month_balance), 0);
  
  const visual = getBudgetVisualInfo(currentBalance, totalMonthlyBudget, remainingDays, totalDaysInMonth);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">아름드리꿈터</h1>
        <div className="text-xs font-bold px-3 py-1 bg-zinc-100 rounded-full text-zinc-500">
          {profile?.name || user.email?.split('@')[0]} 님
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto p-4 sm:p-6 flex flex-col gap-8">
        {/* 이번 달 예산 카드 */}
        <section className={`flex flex-col gap-4 rounded-[2.5rem] p-8 shadow-sm ring-1 relative overflow-hidden transition-all
          ${visual.status === 'danger' ? 'bg-red-50 ring-red-200' : 
            visual.status === 'warning' ? 'bg-orange-50 ring-orange-200' : 
            'bg-white ring-zinc-200'}
        `}>
          <div className="flex justify-between items-start z-10 relative">
            <h2 className="text-base font-bold text-zinc-400">이번 달 남은 돈</h2>
            <span className="px-2 py-1 rounded-lg bg-zinc-100 text-[9px] font-black text-zinc-400 tracking-wider">TOTAL</span>
          </div>
          
          <div className="flex items-end gap-2 z-10 relative">
            <span className={`text-6xl font-black tracking-tighter ${
              visual.status === 'danger' ? 'text-red-600' : 
              visual.status === 'warning' ? 'text-orange-600' : 
              'text-zinc-900'
            }`}>
              {formatCurrency(currentBalance)}
            </span>
            <span className="text-2xl text-zinc-400 font-black mb-1.5">원</span>
          </div>
          
          <div className={`mt-2 px-5 py-4 rounded-2xl z-10 relative border ${
            visual.status === 'danger' ? 'bg-red-100/50 border-red-200 text-red-700' : 
            visual.status === 'warning' ? 'bg-orange-100/50 border-orange-200 text-orange-700' : 
            'bg-zinc-50 border-zinc-200 text-zinc-600'
          }`}>
            <p className="text-base font-bold leading-snug break-keep">{visual.message}</p>
          </div>
          
          {/* 하단 정보: 남은 기간 및 시각화 게이지 */}
          <div className="mt-6 flex flex-col gap-3 z-10 relative">
            <div className="flex justify-between text-[11px] font-black text-zinc-300 uppercase tracking-widest">
              <span>{remainingDays}일 남음</span>
              <span>{visual.percentage}%</span>
            </div>
            <div className="h-5 w-full bg-zinc-100 rounded-full overflow-hidden p-1">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  visual.status === 'danger' ? 'bg-red-500' : 
                  visual.status === 'warning' ? 'bg-orange-500' : 
                  'bg-zinc-900'
                }`}
                style={{ width: `${visual.percentage}%` }}
              />
            </div>
          </div>
          
          {/* 장식용 그래픽 요소 (돈주머니 이모지) */}
          <div className="absolute -right-6 -bottom-6 text-9xl opacity-10 rotate-12">
            {visual.icon}
          </div>
        </section>

        {/* 빠른 실행 버튼 영역 */}
        <section className="flex flex-col gap-4">
          <h3 className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] ml-1">오늘의 선택</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="group flex flex-col items-center justify-center p-8 rounded-[2rem] bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-95">
              <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">📸</span>
              <span className="text-lg font-black text-zinc-800">영수증</span>
              <span className="text-[10px] text-zinc-400 mt-1 font-bold">사진 찍기</span>
            </button>
            <button className="group flex flex-col items-center justify-center p-8 rounded-[2rem] bg-white ring-1 ring-zinc-200 hover:ring-zinc-900 hover:bg-zinc-50 transition-all shadow-sm active:scale-95">
              <span className="text-5xl mb-4 group-hover:scale-110 transition-transform">🤔</span>
              <span className="text-lg font-black text-zinc-800">계획</span>
              <span className="text-[10px] text-zinc-400 mt-1 font-bold">미리보기</span>
            </button>
          </div>
        </section>
        
        {/* 올해 예산 (보조 정보) */}
        <section className="p-6 rounded-3xl bg-zinc-50 border border-zinc-200 flex justify-between items-center group active:scale-[0.98] transition-all">
           <div className="flex flex-col gap-1">
             <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">올해 전체 잔액</span>
             <span className="text-xl font-black text-zinc-800">
               {formatCurrency(fundingSources.reduce((acc: number, curr: any) => acc + Number(curr.current_year_balance), 0))}원
             </span>
           </div>
           <div className="w-12 h-12 rounded-2xl bg-white ring-1 ring-zinc-200 flex items-center justify-center text-2xl shadow-sm">
             🗓️
           </div>
        </section>
      </main>
    </div>
  );
}
