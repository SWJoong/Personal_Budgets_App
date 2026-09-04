'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { decideRuleCheck } from '@/app/actions/ruleCheck'

interface ReviewItem {
  id: string
  ruleLabel: string
  participantName: string
  usageDate: string
  amount: number
  description: string | null
  placeName: string | null
  receiptUrl: string | null
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

/**
 * 톤 원칙: 여기 쌓인 항목은 "규칙 위반"이 아니라 "계획에 없던 지출이라 사람이
 * 한 번 확인해야 하는 것"이다(1차 설계: 금지는 차단, 요건은 사람 판단). 그래서
 * 위험·경고 색(빨강)이 아니라 안내 색(호박색)을 쓰고, 버튼도 "거부"가 아니라
 * "그대로 인정"/"계획에 없어 제외"로 표현한다.
 */
export default function ReviewQueueClient({ items }: { items: ReviewItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  function handleDecide(id: string, decision: 'accepted' | 'rejected') {
    setError('')
    startTransition(async () => {
      const result = await decideRuleCheck(id, { decision, reason: notes[id]?.trim() || undefined })
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <p className="text-zinc-400 text-sm py-8 text-center leading-relaxed">
        확인할 지출이 없어요. 계획에 없던 지출이 생기면 여기 나타나요.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}
      <ul className="flex flex-col gap-3 list-none">
        {items.map((item) => (
        <li key={item.id} className="p-5 rounded-2xl bg-white ring-1 ring-amber-200 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
              계획에 없던 지출
            </span>
            <span className="font-bold">{won(item.amount)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-bold">{item.participantName}</span>
            <span className="text-sm text-zinc-500">{item.description ?? '활동'} · {item.usageDate}</span>
            {item.placeName && <span className="text-xs text-zinc-400">장소: {item.placeName}</span>}
            {item.ruleLabel && <span className="text-xs text-zinc-400">확인 이유: {item.ruleLabel}</span>}
          </div>
          {item.receiptUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.receiptUrl}
              alt="영수증 사진"
              className="w-full max-h-56 object-contain rounded-xl ring-1 ring-zinc-200 bg-zinc-50"
            />
          ) : (
            <p className="text-xs text-zinc-400 p-3 rounded-xl bg-zinc-50 text-center">영수증 사진이 없어요.</p>
          )}
          <input
            type="text"
            value={notes[item.id] ?? ''}
            onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
            placeholder="확인 메모 (선택)"
            className="p-2 rounded-lg bg-zinc-50 ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleDecide(item.id, 'accepted')}
              disabled={pending}
              className="flex-1 p-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 min-h-[44px]"
            >
              그대로 인정
            </button>
            <button
              onClick={() => handleDecide(item.id, 'rejected')}
              disabled={pending}
              className="flex-1 p-3 rounded-xl bg-zinc-200 text-zinc-700 font-bold text-sm hover:bg-zinc-300 disabled:opacity-50 min-h-[44px]"
            >
              계획에 없어 제외
            </button>
          </div>
        </li>
        ))}
      </ul>
    </div>
  )
}
