"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTransaction } from '@/app/actions/transaction'
import { analyzeReceipt } from '@/app/actions/ocr'

interface FundingSource {
  id: string
  name: string
}

type PhotoTab = 'receipt' | 'activity'

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
  const [photoTab, setPhotoTab] = useState<PhotoTab>('receipt')

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

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1]
      setReceiptPreview(reader.result as string)

      setAnalyzing(true)
      try {
        const result = await analyzeReceipt(base64)
        if (result.success && result.data) {
          setDescription(result.data.store || '')
          setAmount(String(result.data.amount || ''))
          if (result.data.date) setDate(result.data.date)
        }
      } catch (error) {
        console.error('분석 실패:', error)
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
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

      const result = await createTransaction(formData)
      if (result.success) {
        setToast({type: 'success', message: '활동이 성공적으로 등록되었습니다!'})
        setTimeout(() => {
          router.push('/')
          router.refresh()
        }, 1500)
      }
    } catch (error) {
      console.error(error)
      setToast({type: 'error', message: '등록 중 오류가 발생했습니다. 다시 시도해 주세요.'})
    } finally {
      setLoading(false)
    }
  }

  const hasAnyPhoto = receiptPreview || activityPreview

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {toast && (
        <div className={`p-4 rounded-2xl text-sm font-bold animate-fade-in-up ${
          toast.type === 'success' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'
        }`}>
          <div className="flex justify-between items-center">
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="text-lg ml-2" aria-label="알림 닫기">✕</button>
          </div>
        </div>
      )}

      {/* 사진 탭 선택 */}
      <div className="flex bg-zinc-100 rounded-xl p-1 gap-1">
        <button
          type="button"
          onClick={() => setPhotoTab('receipt')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            photoTab === 'receipt' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
          }`}
        >
          <span>🧾</span> 영수증 사진
        </button>
        <button
          type="button"
          onClick={() => setPhotoTab('activity')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            photoTab === 'activity' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
          }`}
        >
          <span>📸</span> 활동 사진
        </button>
      </div>

      {/* 영수증 사진 탭 */}
      {photoTab === 'receipt' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-500 ml-1">🧾 영수증 사진 <span className="text-zinc-300 font-medium">(선택)</span></label>
            {receiptPreview && (
              <button type="button" onClick={() => { setReceiptPreview(null); setReceiptFile(null) }}
                className="text-xs text-red-400 font-bold">삭제</button>
            )}
          </div>
          <div
            className="relative aspect-[3/4] w-full rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
            onClick={() => document.getElementById('receipt-input')?.click()}
          >
            {receiptPreview ? (
              <>
                <img src={receiptPreview} alt="영수증 미리보기" className="w-full h-full object-cover" />
                {analyzing && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                    <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="font-black animate-pulse">영수증 읽는 중...</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <span className="text-5xl">🧾</span>
                <p className="font-bold">영수증 사진 선택 (선택사항)</p>
                <p className="text-xs">찍으면 AI가 자동으로 내용을 읽어요</p>
              </div>
            )}
          </div>
          <input id="receipt-input" type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handleReceiptChange} />
        </div>
      )}

      {/* 활동 사진 탭 */}
      {photoTab === 'activity' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-500 ml-1">📸 활동 사진 <span className="text-zinc-300 font-medium">(선택, 1장)</span></label>
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
      )}

      {/* 사진 등록 현황 표시 */}
      {hasAnyPhoto && (
        <div className="flex gap-2">
          {receiptPreview && (
            <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">🧾 영수증 1장</span>
          )}
          {activityPreview && (
            <span className="text-xs font-bold px-2 py-1 bg-green-50 text-green-600 rounded-lg">📸 활동사진 1장</span>
          )}
        </div>
      )}

      {/* 활동 내용 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">📝 무엇을 했나요?</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={analyzing ? "AI가 분석하고 있어요..." : "예: 편의점 간식, 영화 티켓"}
          className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
          required
        />
      </div>

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

      {/* 재원 선택 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">💳 어떤 돈을 썼나요?</label>
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
        className="w-full py-5 rounded-3xl bg-zinc-900 text-white text-xl font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all mt-4"
      >
        {loading ? '등록 중...' : analyzing ? 'AI 분석 중...' : '활동 기록하기'}
      </button>

      <p className="text-center text-zinc-400 text-sm font-medium">
        사진은 선택사항이에요.<br/>지원자 선생님이 확인한 뒤 정식으로 반영됩니다.
      </p>
    </form>
  )
}
