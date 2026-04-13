'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/utils/budget-visuals'

interface GalleryItem {
  id: string
  activity_name: string
  date: string
  amount: number
  receipt_image_url: string | null
  activity_image_url: string | null
  category: string | null
}

interface Props {
  items: GalleryItem[]
  currentMonth: string
  months: { value: string; label: string }[]
}

export default function GalleryClient({ items, currentMonth, months }: Props) {
  const router = useRouter()
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null)

  // 날짜별 그룹핑
  const grouped = items.reduce<Record<string, GalleryItem[]>>((acc, item) => {
    const key = item.date
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  function handleMonthChange(month: string) {
    router.push(`/gallery?month=${month}`)
  }

  return (
    <>
      {/* 월 선택 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-background/80 backdrop-blur-md sticky top-14 z-10 border-b border-zinc-100">
        <select
          value={currentMonth}
          onChange={e => handleMonthChange(e.target.value)}
          className="flex-1 p-3 rounded-2xl bg-white ring-1 ring-zinc-200 font-bold text-zinc-800 focus:outline-none focus:ring-zinc-400"
        >
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <span className="text-xs font-bold text-zinc-400 shrink-0">{items.length}장</span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-16 px-4">
          <span className="text-5xl">📷</span>
          <p className="text-base font-bold text-zinc-600">이번 달 사진이 없어요</p>
          <p className="text-sm text-zinc-400">선생님이 영수증이나 활동 사진을 등록하면 여기에 보여요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 p-4">
          {sortedDates.map(date => (
            <section key={date} className="flex flex-col gap-3">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">
                {date.replace(/-/g, '.')}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {grouped[date].flatMap(item => {
                  const cards = []
                  if (item.receipt_image_url) {
                    cards.push(
                      <button
                        key={`${item.id}-receipt`}
                        onClick={() => setLightbox({ src: item.receipt_image_url!, label: `${item.activity_name} — 영수증` })}
                        className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-100 active:scale-[0.97] transition-transform group"
                      >
                        <img src={item.receipt_image_url} alt={item.activity_name} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-xs font-black truncate">{item.activity_name}</p>
                          <p className="text-white/70 text-[10px] font-bold">{formatCurrency(item.amount)}원 · 🧾 영수증</p>
                        </div>
                      </button>
                    )
                  }
                  if (item.activity_image_url) {
                    cards.push(
                      <button
                        key={`${item.id}-activity`}
                        onClick={() => setLightbox({ src: item.activity_image_url!, label: `${item.activity_name} — 활동 사진` })}
                        className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-100 active:scale-[0.97] transition-transform group col-span-2"
                      >
                        <img src={item.activity_image_url} alt={item.activity_name} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-xs font-black truncate">{item.activity_name}</p>
                          <p className="text-white/70 text-[10px] font-bold">{formatCurrency(item.amount)}원 · 📷 활동 사진</p>
                        </div>
                      </button>
                    )
                  }
                  return cards
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.src}
            alt={lightbox.label}
            className="max-w-full max-h-[80dvh] object-contain rounded-2xl shadow-2xl"
          />
          <p className="text-white text-sm font-bold mt-4 text-center">{lightbox.label}</p>
          <button
            onClick={() => setLightbox(null)}
            className="mt-4 px-6 py-3 rounded-2xl bg-white/10 text-white font-bold text-sm"
          >
            닫기
          </button>
        </div>
      )}
    </>
  )
}
