"use client"

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createTransaction } from '@/app/actions/transaction'
import { analyzeReceiptFile } from '@/utils/receiptOcr/analyzeReceiptFile'
import {
  PAYMENT_METHODS,
  RECEIPT_CATEGORIES,
  type PaymentMethod,
  type ReceiptCategory,
} from '@/utils/receiptOcr/types'
import ReceiptPlaceBox from '@/components/map/ReceiptPlaceBox'
import { useReceiptPlace } from '@/components/map/useReceiptPlace'
import { EasyTerm } from '@/components/ui/EasyTerm'
import SelfCheckFeedback from '@/components/ui/SelfCheckFeedback'
import { speak } from '@/utils/tts'

interface FundingSource {
  id: string
  name: string
}

export default function ReceiptUploadForm({
  participantId,
  fundingSources
}: {
  participantId: string
  fundingSources: FundingSource[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)

  // 영수증 사진 상태
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  // 활동 사진 상태 (최대 1장)
  const [activityPreview, setActivityPreview] = useState<string | null>(null)
  const [activityFile, setActivityFile] = useState<File | null>(null)

  // 폼 필드 상태
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  // 영수증에서 찾은 장소 (자동 감지 → 못 찾으면 직접 검색)
  const placeFinder = useReceiptPlace()
  // 결제 방법 · 종류 (영수증에서 읽은 값이 있으면 미리 채우고, 없으면 기본값)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('체크카드')
  const [category, setCategory] = useState<ReceiptCategory>('기타')
  // 영수증 글자 읽기 상태
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrMessage, setOcrMessage] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)
  const [ocrFailed, setOcrFailed] = useState(false)

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    setOcrFailed(false)
    // 장소는 영수증마다 다르니 새 사진을 고르면 이전 장소를 비운다
    placeFinder.reset()

    // 이전 영수증에서 자동으로 채운 값이 새 영수증에 남지 않게 비운다
    if (autoFilled) {
      setDescription('')
      setAmount('')
      setDate(new Date().toISOString().split('T')[0])
      setPaymentMethod('체크카드')
      setCategory('기타')
      setAutoFilled(false)
    }

    // 미리보기는 글자를 읽는 동안에도 바로 보여 준다
    const reader = new FileReader()
    reader.onloadend = () => setReceiptPreview(reader.result as string)
    reader.readAsDataURL(file)

    // 글자 읽기는 이 기기(브라우저)에서 한다. 서버에 AI 키가 있을 때만 서버 AI 를 먼저 쓴다.
    setAnalyzing(true)
    setOcrProgress(0)
    setOcrMessage('읽을 준비를 하고 있어요')
    try {
      const result = await analyzeReceiptFile(file, (percent, message) => {
        setOcrProgress(percent)
        setOcrMessage(message)
      })
      if (result.success && result.data) {
        const d = result.data
        if (d.store) setDescription(d.store)
        if (d.amount) setAmount(String(d.amount))
        if (d.date) setDate(d.date)
        if (d.paymentMethod) setPaymentMethod(d.paymentMethod)
        if (d.category) setCategory(d.category)
        setAutoFilled(true)

        // 상호로 먼저 찾고, 영수증 주소와 가장 가까운 곳을 고른다 (못 찾으면 직접 검색 칸이 뜬다)
        void placeFinder.detect({ store: d.store, address: d.address })
      } else {
        setOcrFailed(true)
      }
    } catch (error) {
      console.error('분석 실패:', error)
      setOcrFailed(true)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleActivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setActivityFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setActivityPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveActivityPhoto = () => {
    setActivityPreview(null)
    setActivityFile(null)
    const input = document.getElementById('activity-input') as HTMLInputElement
    if (input) input.value = ''
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('participant_id', participantId)
      formData.set('date', date)
      formData.set('description', description)
      formData.set('amount', amount)
      if (receiptFile) formData.set('receipt', receiptFile)
      if (activityFile) formData.set('activity_image', activityFile)
      if (placeFinder.place) {
        formData.set('place_name', placeFinder.place.place_name)
        formData.set('place_lat', String(placeFinder.place.lat))
        formData.set('place_lng', String(placeFinder.place.lng))
      }

      const result = await createTransaction(formData)
      if (result.success) {
        setShowFeedback(true)
      }
    } catch (error) {
      console.error(error)
      setToast({type: 'error', message: '저장이 안 됐어요. 다시 눌러주세요.'})
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {toast && toast.type === 'error' && (
        <div className="p-4 rounded-2xl text-sm font-bold animate-fade-in-up bg-red-50 text-red-700 ring-1 ring-red-200">
          <div className="flex justify-between items-center">
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="text-lg ml-2" aria-label="알림 닫기">✕</button>
          </div>
        </div>
      )}

      {/* 영수증 사진 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-500 ml-1">🧾 <EasyTerm formal="영수증 사진" easy="물건 산 종이 사진" /> <span className="text-zinc-300 font-medium">(선택)</span></label>
          {receiptPreview && (
            <button type="button" onClick={() => { setReceiptPreview(null); setReceiptFile(null); setOcrFailed(false); placeFinder.reset() }}
              className="text-xs text-red-400 font-bold">삭제</button>
          )}
        </div>
        <div
          className="relative aspect-square w-full rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
          onClick={() => document.getElementById('receipt-input')?.click()}
        >
          {receiptPreview ? (
            <>
              <img src={receiptPreview} alt="영수증 미리보기" className="w-full h-full object-cover" />
              {analyzing && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="font-black animate-pulse">영수증 읽는 중... {ocrProgress}%</p>
                  <p className="text-xs mt-1 font-medium px-6 text-center">{ocrMessage}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <span className="text-5xl">🧾</span>
              <p className="font-bold"><EasyTerm formal="영수증 사진 선택" easy="물건 산 종이 사진 찍기" /> (선택)</p>
              <p className="text-xs text-center">사진을 찍으면 글자를 읽어서 채워줘요<br />밝은 곳에서 영수증이 크게 보이게 찍어요</p>
            </div>
          )}
        </div>
        <input id="receipt-input" type="file" accept="image/*" capture="environment"
          className="hidden" onChange={handleReceiptChange} />
      </div>

      {/* 영수증 글자 읽기 결과 안내 */}
      {!analyzing && autoFilled && (
        <div role="status" className="px-4 py-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-sm font-bold text-amber-900">
          📋 사진에서 읽은 내용이에요. 틀린 곳은 고쳐 주세요.
        </div>
      )}
      {!analyzing && ocrFailed && (
        <div role="status" className="px-4 py-3 rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 text-sm font-bold text-zinc-700">
          😢 사진에서 글자를 못 읽었어요. 밝은 곳에서 영수증이 크게 보이게 다시 찍거나, 직접 적어 주세요.
        </div>
      )}

      {/* 활동 사진 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-500 ml-1">📸 <EasyTerm formal="활동 사진" easy="오늘 한 일 사진" /> <span className="text-zinc-300 font-medium">(선택, 1장)</span></label>
          {activityPreview && (
            <button type="button" onClick={handleRemoveActivityPhoto}
              className="text-xs text-red-400 font-bold">삭제</button>
          )}
        </div>
        <div
          className="relative aspect-square w-full rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
          onClick={() => !activityPreview && document.getElementById('activity-input')?.click()}
        >
          {activityPreview ? (
            <img src={activityPreview} alt="활동 사진 미리보기" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <span className="text-5xl">📷</span>
              <p className="font-bold">활동 사진 선택 (1장)</p>
              <p className="text-xs">오늘 활동한 사진을 올려요</p>
            </div>
          )}
        </div>
        <input id="activity-input" type="file" accept="image/*" capture="environment"
          className="hidden" onChange={handleActivityChange} />
      </div>

      {/* 활동 내용 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">📝 무엇을 했나요?</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={analyzing ? "사진을 읽고 있어요..." : "예: 편의점 간식, 영화 티켓"}
          className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
          required
        />
      </div>

      {/* 영수증에서 찾은 장소 (자동 감지 · 못 찾으면 직접 검색) */}
      <ReceiptPlaceBox
        status={placeFinder.status}
        place={placeFinder.place}
        source={placeFinder.source}
        hintName={placeFinder.hintName}
        onChoose={placeFinder.choose}
        onClear={placeFinder.clear}
      />

      {/* 금액 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">💰 얼마인가요?</label>
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full p-4 pr-12 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-2xl font-black text-right transition-all"
            required
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">원</span>
        </div>
      </div>

      {/* 결제 방법 · 종류 (영수증에서 읽은 값이 미리 채워져요. 바꿀 수 있어요) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="payment-method" className="text-sm font-bold text-zinc-500 ml-1">💳 어떻게 냈나요?</label>
          <select
            id="payment-method"
            name="payment_method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-bold appearance-none"
          >
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="receipt-category" className="text-sm font-bold text-zinc-500 ml-1">🏷️ 어떤 종류인가요?</label>
          <select
            id="receipt-category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ReceiptCategory)}
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-base font-bold appearance-none"
          >
            {RECEIPT_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 재원 선택 (1개이면 자동선택 숨김) */}
      {fundingSources.length <= 1 ? (
        <input type="hidden" name="funding_source_id" value={fundingSources[0]?.id ?? ''} />
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-zinc-500 ml-1">💳 <EasyTerm formal="결제 수단" easy="어떤 돈을 썼나요" />?</label>
          <select
            name="funding_source_id"
            className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold appearance-none"
            required
          >
            {fundingSources.map(fs => (
              <option key={fs.id} value={fs.id}>{fs.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 날짜 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">📅 언제인가요?</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
        />
      </div>

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={loading || analyzing}
        className="w-full py-5 rounded-3xl bg-green-600 text-white text-xl font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all mt-4"
      >
        {loading ? '등록 중...' : analyzing ? '영수증 읽는 중...' : '활동 기록하기'}
      </button>

      <p className="text-center text-zinc-400 text-sm font-medium">
        사진은 선택사항이에요.<br/>지원자 선생님이 확인하면 예산에 반영해요.
      </p>

      {/* 성공 알림 + 자기결정 피드백 — Portal로 화면 중앙 오버레이 */}
      {showFeedback && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center gap-2 animate-fade-in-up">
            <span className="text-5xl">✅</span>
            <p className="text-xl font-black text-zinc-900">활동을 기록했어요!</p>
            <p className="text-sm text-zinc-500 font-medium text-center">지원자 선생님이 확인하면 예산에 반영해요.</p>
            <div className="w-full h-px bg-zinc-100 my-2" />
            <SelfCheckFeedback
              question="활동을 기록하기 쉬웠나요?"
              context="receipt_upload"
              onComplete={() => {
                setTimeout(() => {
                  router.push('/')
                  router.refresh()
                }, 1200)
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </form>
  )
}
