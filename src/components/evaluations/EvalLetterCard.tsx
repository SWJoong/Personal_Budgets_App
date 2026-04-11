'use client'

import { speak } from '@/utils/tts'

/**
 * EvalLetterCard — 당사자 평가 열람 카드 (가이드라인 §3, §5.2 적용)
 * 
 * TTS 읽어주기 + 선호도 피드백(스마일/새드) 포함
 */
export default function EvalLetterCard({
  displayMonth,
  summary,
  nextStep,
}: {
  displayMonth: string
  summary: string
  nextStep: string
}) {
  return (
    <section className="bg-white rounded-[2.5rem] p-8 shadow-sm ring-1 ring-zinc-200 flex flex-col gap-6 border-b-4 border-zinc-100">
      <div className="flex justify-between items-center">
        <span className="px-4 py-1.5 rounded-full bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest">
          {displayMonth}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => speak(`${displayMonth} 선생님의 편지에요. ${summary}. 다음 달 약속은, ${nextStep}`)}
            className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-sm active:scale-95 transition-all"
            aria-label="편지 음성으로 듣기"
          >🔊</button>
          <span className="text-3xl">💌</span>
        </div>
      </div>

      {/* 쉬운 요약 내용 */}
      <div className="bg-zinc-50 rounded-3xl p-6 border border-zinc-100">
        <p className="text-lg font-bold text-zinc-800 leading-relaxed break-keep">
          {summary}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider ml-1">다음 달 약속</h4>
        <div className="p-4 rounded-2xl bg-blue-50 text-blue-700 font-bold text-sm flex gap-3">
          <span>✨</span>
          <p>{nextStep}</p>
        </div>
      </div>
    </section>
  )
}
