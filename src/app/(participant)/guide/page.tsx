'use client'

import Link from 'next/link'
import { speak } from '@/utils/tts'
import NavDropdown from '@/components/layout/NavDropdown'

const steps = [
  {
    icon: '🏠',
    title: '남은 돈 확인하기',
    desc: '홈 화면에서 이번 달에 사용할 수 있는 돈이 얼마나 남았는지 확인해요. 돈주머니가 가득 차 있으면 예산이 넉넉하다는 뜻이에요!'
  },
  {
    icon: '📸',
    title: '영수증 사진 찍기',
    desc: '물건을 사거나 간식을 먹었다면 영수증 사진을 찍어서 보내주세요. AI가 자동으로 금액과 날짜를 읽어줘요.'
  },
  {
    icon: '📝',
    title: '오늘의 계획 세우기',
    desc: '무엇을 할지 고민될 때는 계획 버튼을 눌러보세요. AI가 남은 돈으로 할 수 있는 재미있는 활동을 추천해줘요.'
  },
  {
    icon: '📅',
    title: '달력에서 확인하기',
    desc: '달력 버튼을 누르면 내가 언제 어디서 돈을 썼는지 한눈에 볼 수 있어요. 초록색 점은 선생님이 확인했다는 뜻이에요!'
  },
  {
    icon: '💌',
    title: '선생님의 편지 읽기',
    desc: '더보기 메뉴에서 선생님이 써준 활동 이야기를 읽어보세요. 한 달 동안 내가 얼마나 잘 지냈는지 알 수 있어요.'
  }
]

export default function GuidePageClient() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground pb-10">
      <header className="flex h-16 items-center justify-between px-6 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl">←</Link>
          <h1 className="text-xl font-bold tracking-tight">앱 사용 설명서</h1>
        </div>
        <NavDropdown />
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full flex flex-col gap-8">
        <div className="text-center py-4">
          <h2 className="text-2xl font-black text-zinc-900 mb-2">반가워요! 👋</h2>
          <p className="text-zinc-500 font-bold">이 앱을 어떻게 사용하는지<br/>쉽게 알려드릴게요.</p>
        </div>

        <div className="flex flex-col gap-4">
          {steps.map((step, i) => (
            <section key={i} className="bg-white rounded-[2.5rem] p-8 shadow-sm ring-1 ring-zinc-200 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-5xl">{step.icon}</span>
                  <h3 className="text-xl font-black text-zinc-900">{i + 1}. {step.title}</h3>
                </div>
                <button
                  onClick={() => speak(`${i + 1}번. ${step.title}. ${step.desc}`)}
                  className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-sm active:scale-95 transition-all shrink-0"
                  aria-label={`${step.title} 음성으로 듣기`}
                >🔊</button>
              </div>
              <p className="text-lg font-bold text-zinc-600 leading-relaxed break-keep">
                {step.desc}
              </p>
            </section>
          ))}
        </div>

        <Link 
          href="/"
          className="mt-4 w-full py-5 rounded-3xl bg-zinc-900 text-white text-xl font-black shadow-xl text-center active:scale-95 transition-all"
        >
          확인했어요! 홈으로 가기
        </Link>
      </main>
    </div>
  )
}
