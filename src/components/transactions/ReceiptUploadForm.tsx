"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTransaction } from '@/app/actions/transaction'
import { analyzeReceipt } from '@/app/actions/ocr'

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
  const [preview, setPreview] = useState<string | null>(null)
  
  // 폼 필드 상태 관리 (자동 입력을 위해)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1]
        setPreview(reader.result as string)
        
        // AI 분석 시작
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
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    try {
      const result = await createTransaction(formData)
      if (result.success) {
        alert('영수증이 성공적으로 등록되었습니다! 지원자 선생님이 곧 확인해주실 거예요.')
        router.push('/')
        router.refresh()
      }
    } catch (error) {
      console.error(error)
      alert('등록 중 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="participant_id" value={participantId} />
      <input type="hidden" name="date" value={date} />
      
      {/* 사진 업로드 영역 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">📸 영수증 사진</label>
        <div 
          className="relative aspect-[3/4] w-full rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden active:scale-[0.98] transition-all"
          onClick={() => document.getElementById('receipt-input')?.click()}
        >
          {preview ? (
            <>
              <img src={preview} alt="영수증 미리보기" className="w-full h-full object-cover" />
              {analyzing && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="font-black animate-pulse">영수증 읽는 중...</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <span className="text-5xl">📷</span>
              <p className="font-bold">사진 찍기 또는 선택</p>
            </div>
          )}
        </div>
        <input 
          id="receipt-input"
          name="receipt"
          type="file" 
          accept="image/*" 
          capture="environment"
          className="hidden" 
          onChange={handleImageChange}
          required
        />
      </div>

      {/* 활동 내용 */}
      <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
        <label className="text-sm font-bold text-zinc-500 ml-1">📝 무엇을 샀나요?</label>
        <input 
          name="description"
          type="text" 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={analyzing ? "AI가 분석하고 있어요..." : "예: 편의점 간식, 영화 티켓"}
          className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 focus:ring-2 focus:ring-primary outline-none text-lg font-bold transition-all"
          required
        />
      </div>

      {/* 금액 */}
      <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-3">
        <label className="text-sm font-bold text-zinc-500 ml-1">💰 얼마인가요?</label>
        <div className="relative">
          <input 
            name="amount"
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
      <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-4">
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

      {/* 제출 버튼 */}
      <button 
        type="submit"
        disabled={loading || analyzing}
        className="w-full py-5 rounded-3xl bg-zinc-900 text-white text-xl font-black shadow-xl active:scale-95 disabled:bg-zinc-300 transition-all mt-4"
      >
        {loading ? '등록 중...' : analyzing ? 'AI 분석 중...' : '📸 영수증 보내기'}
      </button>

      <p className="text-center text-zinc-400 text-sm font-medium">
        보내주신 영수증은 지원자 선생님이 확인한 뒤<br/>정식 예산에 반영됩니다.
      </p>
    </form>
  )
}
