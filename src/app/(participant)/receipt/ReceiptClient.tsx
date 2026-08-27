'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { recordServiceUsage } from '@/app/actions/serviceUsage'
import { analyzeReceipt } from '@/app/actions/ocr'
import { searchPlaces, type PlaceResult } from '@/app/actions/geocode'
import { findOrCreateProvider } from '@/app/actions/serviceProvider'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

const SETTLEMENT_LABEL: Record<string, string> = {
  pending: '확인 중',
  accepted: '인정됨',
  rejected: '반려됨',
  recovered: '환수됨',
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      resolve({ base64, mimeType: file.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ReceiptClient({
  participantId,
  allocationId,
  requestedServices,
  usages,
  remaining,
  spendingRules,
}: {
  participantId: string
  allocationId: string | null
  requestedServices: { id: string; service_name: string }[]
  usages: { id: string; usage_date: string; amount: number; description: string | null; settlement_status: string }[]
  remaining: number | null
  spendingRules: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrNotice, setOcrNotice] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [requestedServiceId, setRequestedServiceId] = useState('')
  const [photo, setPhoto] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null)

  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([])
  const [placeSearching, setPlaceSearching] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; providerId: string } | null>(null)

  async function handlePlaceSearch() {
    if (!placeQuery.trim()) return
    setPlaceSearching(true)
    try {
      const results = await searchPlaces(placeQuery.trim())
      setPlaceResults(results)
    } finally {
      setPlaceSearching(false)
    }
  }

  async function handlePlaceSelect(place: PlaceResult) {
    const result = await findOrCreateProvider({
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      lat: place.lat,
      lng: place.lng,
    })
    if (result.error || !result.providerId) {
      setError(result.error || '장소 등록에 실패했어요.')
      return
    }
    setSelectedPlace({ name: place.place_name, providerId: result.providerId })
    setPlaceResults([])
    setPlaceQuery('')
  }

  async function handlePhotoSelected(file: File) {
    setError('')
    setOcrNotice('')
    const { base64, mimeType } = await fileToBase64(file)
    setPhoto({ base64, mimeType, previewUrl: URL.createObjectURL(file) })

    setOcrLoading(true)
    try {
      const result = await analyzeReceipt(base64)
      if (result.success && result.data) {
        if (result.data.amount) setAmount(String(result.data.amount))
        if (result.data.date) setDate(result.data.date)
        if (result.data.store) setDescription(result.data.store)
      } else {
        setOcrNotice('사진에서 내용을 읽지 못했어요. 아래 칸에 직접 입력해 주세요.')
      }
    } finally {
      setOcrLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allocationId) return
    if (!amount || Number(amount) <= 0) {
      setError('금액을 입력해 주세요.')
      return
    }

    setError('')
    startTransition(async () => {
      const result = await recordServiceUsage({
        participantId,
        allocationId,
        usageDate: date,
        amount: Number(amount),
        description: description.trim() || undefined,
        requestedServiceId: requestedServiceId || undefined,
        providerId: selectedPlace?.providerId,
        receiptBase64: photo?.base64,
        receiptMimeType: photo?.mimeType,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setAmount('')
      setDescription('')
      setRequestedServiceId('')
      setPhoto(null)
      setSelectedPlace(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <Link href="/" className="text-zinc-400 hover:text-zinc-600 transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="홈으로 가기">
          ←
        </Link>
        <h1 className="text-sm font-black text-zinc-800">지출 기록하기</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col gap-6 max-w-sm mx-auto w-full">
        {!allocationId ? (
          <section className="p-8 rounded-3xl bg-zinc-100 text-center">
            <p className="text-zinc-500 font-medium leading-relaxed">아직 예산이 정해지지 않았어요.<br />담당 선생님에게 말씀해 주세요.</p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium leading-relaxed">
                {error}
              </div>
            )}

            {/* 막는 장치가 아니라 미리 알려주는 안내다. 기본은 접어 두어 기록을
                방해하지 않고, 궁금할 때 펼쳐 보게 한다(쉬운 정보 원칙: 한 번에
                많은 글을 보여주지 않기). */}
            {spendingRules.length > 0 && (
              <details className="rounded-2xl bg-white ring-1 ring-zinc-200 overflow-hidden">
                <summary className="p-4 text-sm font-bold text-zinc-700 cursor-pointer min-h-[44px] flex items-center leading-relaxed">
                  💡 지원이 어려운 것도 있어요
                </summary>
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <ul className="flex flex-col gap-1.5">
                    {spendingRules.map((label) => (
                      <li key={label} className="text-sm text-zinc-600 leading-relaxed">· {label}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-zinc-500 leading-relaxed bg-zinc-50 rounded-xl p-3">
                    그래도 꼭 필요한 것이면 지원받을 수 있어요.
                    담당 선생님과 먼저 이야기해 보세요.
                  </p>
                </div>
              </details>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs text-zinc-500 font-medium">영수증 사진 (있으면 자동으로 채워줘요)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handlePhotoSelected(file)
                }}
                className="text-sm"
              />
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.previewUrl} alt="영수증 미리보기" className="w-full max-h-48 object-contain rounded-xl ring-1 ring-zinc-200" />
              )}
              {ocrLoading && <p className="text-xs text-zinc-400">사진에서 읽어오는 중...</p>}
              {!ocrLoading && ocrNotice && <p className="text-xs text-amber-600 leading-relaxed">{ocrNotice}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">날짜</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-500 font-medium">얼마 썼어요? (원)</label>
                {remaining !== null && (
                  <span className="text-xs text-zinc-400">남은 예산 {won(remaining)}</span>
                )}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">무엇에 썼어요?</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 웹툰 학원 수강료"
                className="p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-medium">어디에서 썼어요? (선택)</label>
              {selectedPlace ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-100">
                  <span className="text-sm font-bold text-zinc-700">📍 {selectedPlace.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlace(null)}
                    className="text-xs text-zinc-400 min-h-[44px] px-2"
                  >
                    다시 찾기
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={placeQuery}
                      onChange={(e) => setPlaceQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePlaceSearch() } }}
                      placeholder="장소 이름으로 찾아보세요"
                      className="flex-1 p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handlePlaceSearch}
                      disabled={placeSearching}
                      className="px-4 rounded-xl bg-zinc-200 text-zinc-700 text-sm font-bold disabled:opacity-50 min-h-[44px] min-w-[44px]"
                    >
                      찾기
                    </button>
                  </div>
                  {placeResults.length > 0 && (
                    <ul className="flex flex-col gap-1 mt-1">
                      {placeResults.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => handlePlaceSelect(p)}
                            className="w-full text-left p-3 rounded-xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all"
                          >
                            <span className="text-sm font-bold text-zinc-700 block">{p.place_name}</span>
                            <span className="text-xs text-zinc-400">{p.road_address_name || p.address_name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {requestedServices.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 font-medium">내 계획 중 어떤 것인가요? (선택)</label>
                <select
                  value={requestedServiceId}
                  onChange={(e) => setRequestedServiceId(e.target.value)}
                  className="p-3 rounded-xl bg-white ring-1 ring-zinc-200 text-sm focus:ring-zinc-400 focus:outline-none"
                >
                  <option value="">고르지 않을래요</option>
                  {requestedServices.map((rs) => (
                    <option key={rs.id} value={rs.id}>{rs.service_name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={pending || ocrLoading}
              className="p-3 rounded-xl bg-zinc-900 text-white font-bold text-sm disabled:opacity-50 min-h-[44px]"
            >
              {pending ? '저장하고 있어요...' : '기록하기'}
            </button>
          </form>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-zinc-500">최근에 쓴 돈</h2>
          {usages.length === 0 ? (
            <p className="text-zinc-400 text-sm leading-relaxed">아직 쓴 돈이 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {usages.map((u) => (
                <li key={u.id} className="p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold leading-relaxed">{u.description ?? '활동'}</span>
                    <span className="text-xs text-zinc-400">{u.usage_date} · {SETTLEMENT_LABEL[u.settlement_status] ?? u.settlement_status}</span>
                  </div>
                  <span className="font-bold">{won(u.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
