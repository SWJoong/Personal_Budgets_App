"use client"

import { useState } from 'react'
import Image from 'next/image'
import { formatCurrency } from '@/utils/budget-visuals'
import { EasyTerm } from '@/components/ui/EasyTerm'
import { speak } from '@/utils/tts'
import SelfCheckFeedback from '@/components/ui/SelfCheckFeedback'
import ImageLightbox from '@/components/ui/ImageLightbox'

interface Transaction {
  id: string
  date: string
  amount: number
  activity_name: string
  status: 'pending' | 'confirmed'
  receipt_image_url?: string | null
  activity_image_url?: string | null
}

interface Props {
  transactions: Transaction[]
}

export default function TransactionCalendar({ transactions }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i)

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  // 날짜 형식 지정 (YYYY-MM-DD)
  const formatDate = (d: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // 선택된 날짜의 내역
  const selectedTransactions = selectedDate 
    ? transactions.filter(t => t.date === selectedDate)
    : []

  const selectedTotal = selectedTransactions.reduce((acc, t) => acc + Number(t.amount), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* 달력 컨트롤 */}
      <div className="flex items-center justify-between bg-white rounded-3xl p-4 ring-1 ring-zinc-200 shadow-sm">
        <button onClick={prevMonth} className="p-3 rounded-2xl bg-zinc-50 hover:bg-zinc-100 active:bg-zinc-200 transition-colors" aria-label="이전 달">
          <span className="text-xl">◀</span>
        </button>
        <h2 className="text-xl font-black text-zinc-900">
          {year}년 {month + 1}월
        </h2>
        <button onClick={nextMonth} className="p-3 rounded-2xl bg-zinc-50 hover:bg-zinc-100 active:bg-zinc-200 transition-colors" aria-label="다음 달">
          <span className="text-xl">▶</span>
        </button>
      </div>

      {/* 달력 그리드 */}
      <div className="bg-white rounded-[2rem] p-5 sm:p-6 ring-1 ring-zinc-200 shadow-sm">
        <div className="grid grid-cols-7 gap-1 mb-2" role="grid">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`text-center text-xs font-black p-2 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-zinc-400'
            }`}>
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {blanks.map(b => (
            <div key={`blank-${b}`} className="aspect-square p-1" />
          ))}
          
          {days.map(d => {
            const dateStr = formatDate(d)
            const dayTxs = transactions.filter(t => t.date === dateStr)
            const isSelected = selectedDate === dateStr
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            
            const hasConfirmed = dayTxs.some(t => t.status === 'confirmed')
            const hasPending = dayTxs.some(t => t.status === 'pending')
            
            // 활동사진 우선, 없으면 영수증 사진
            const thumbnailUrl =
              dayTxs.find(t => t.activity_image_url)?.activity_image_url ??
              dayTxs.find(t => t.receipt_image_url)?.receipt_image_url ??
              null

            return (
              <button
                key={d}
                role="gridcell"
                onClick={() => setSelectedDate(dateStr)}
                className={`
                  relative aspect-square min-w-[44px] min-h-[44px] flex flex-col items-center justify-start pt-2 rounded-2xl transition-all overflow-hidden
                  ${isSelected ? 'bg-zinc-900 text-white shadow-md scale-105 z-10 ring-2 ring-zinc-900' : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 active:scale-95'}
                  ${isToday && !isSelected ? 'ring-2 ring-primary ring-inset text-primary bg-blue-50/50' : ''}
                `}
              >
                {/* 썸네일 배경 처리 */}
                {thumbnailUrl && !isSelected && (
                  <div 
                    className="absolute inset-0 opacity-20 bg-cover bg-center"
                    style={{ backgroundImage: `url(${thumbnailUrl})` }}
                  />
                )}

                <span className={`text-sm z-10 ${isToday || isSelected ? 'font-black' : 'font-bold'}`}>{d}</span>
                
                {/* 지출 표시 마커 및 썸네일 아이콘 */}
                <div className="mt-auto mb-2 flex flex-col items-center gap-1 z-10">
                  {thumbnailUrl && (
                    <button
                      className="w-5 h-5 rounded-md overflow-hidden ring-1 ring-white/50 shadow-sm mt-1 cursor-zoom-in"
                      onClick={e => { e.stopPropagation(); setLightboxSrc(thumbnailUrl) }}
                    >
                      <Image src={thumbnailUrl} alt="영수증" fill sizes="20px" className="object-cover" />
                    </button>
                  )}
                  {!thumbnailUrl && (hasConfirmed || hasPending) && (
                    <div className="flex gap-1 h-2 mt-2">
                      {hasConfirmed && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                      )}
                      {hasPending && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-orange-300' : 'bg-orange-500'}`} />
                      )}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 선택된 날짜 상세 내역 */}
      <div className={`transition-all duration-300 ${selectedDate ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 pointer-events-none'}`}>
        <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest ml-2 mb-3">
          {selectedDate ? `${selectedDate.split('-')[1]}월 ${selectedDate.split('-')[2]}일 기록` : '날짜를 선택해요'}
        </h3>
        
        {selectedTransactions.length === 0 ? (
          <div className="bg-zinc-50 rounded-3xl p-8 border border-zinc-200 text-center flex flex-col items-center gap-3">
            <span className="text-4xl grayscale opacity-50">💸</span>
            <p className="text-zinc-500 font-bold">이 날은 기록이 없어요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* 총 합계 요약 */}
            <div className="bg-zinc-900 text-white rounded-3xl p-6 shadow-md flex justify-between items-center">
              <span className="text-sm font-bold opacity-80">이 날 쓴 돈</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black">{formatCurrency(selectedTotal)}원</span>
                <button
                  onClick={() => {
                    const txText = selectedTransactions
                      .map((tx: any) => `${tx.activity_name} ${formatCurrency(tx.amount)}원`)
                      .join(', ')
                    speak(`${selectedDate?.split('-')[1]}월 ${selectedDate?.split('-')[2]}일에 쓴 돈이에요. ${txText}. 합계 ${formatCurrency(selectedTotal)}원을 썼어요.`)
                  }}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-sm active:scale-95 transition-all"
                  aria-label="이 날 내역 음성으로 듣기"
                >🔊</button>
              </div>
            </div>

            {/* 개별 내역 리스트 */}
            {selectedTransactions.map(tx => (
              <div key={tx.id} className="bg-white rounded-3xl p-5 ring-1 ring-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  {(tx.activity_image_url || tx.receipt_image_url) ? (
                    <button
                      className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm shrink-0 cursor-zoom-in"
                      onClick={() => setLightboxSrc((tx.activity_image_url || tx.receipt_image_url)!)}
                    >
                      <img
                        src={(tx.activity_image_url || tx.receipt_image_url)!}
                        alt="활동"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 ${
                      tx.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
                    }`}>
                      {tx.status === 'confirmed' ? '✓' : '⏳'}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <p className="font-bold text-zinc-900 text-lg">{tx.activity_name}</p>
                    <p className={`text-xs font-bold ${tx.status === 'confirmed' ? 'text-green-600' : 'text-orange-500'}`}>
                      {tx.status === 'confirmed'
                        ? <EasyTerm formal="예산 반영 완료" easy="돈에서 뺐어요" />
                        : <EasyTerm formal="확인 대기 중" easy="선생님이 확인하고 있어요" />
                      }
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right mt-2 sm:mt-0 sm:ml-auto">
                  <p className="font-black text-zinc-900 text-lg">-{formatCurrency(tx.amount)}원</p>
                </div>
              </div>
            ))}
            
            <div className="mt-6 pt-6 border-t border-zinc-100">
              <SelfCheckFeedback
                question="내역을 확인하기 쉬웠나요?"
                compact={true}
                context="calendar"
              />
            </div>
          </div>
        )}
      </div>

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  )
}
