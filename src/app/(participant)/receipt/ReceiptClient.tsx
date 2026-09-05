'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { recordServiceUsage } from '@/app/actions/serviceUsage'
import { analyzeReceipt } from '@/app/actions/ocr'
import { searchPlaces, type PlaceResult } from '@/app/actions/geocode'
import { findOrCreateProvider } from '@/app/actions/serviceProvider'
import { FormField } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/LiveRegion'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

const SETTLEMENT_LABEL: Record<string, string> = {
  pending: '선생님이 살펴봐요',
  accepted: '괜찮아요',
  rejected: '다시 봐야 해요',
  recovered: '선생님과 이야기해요',
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
  const { announce } = useToast()
  const [pending, startTransition] = useTransition()
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrNotice, setOcrNotice] = useState('')
  const [error, setError] = useState('')
  const [amountError, setAmountError] = useState('')
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
      const msg = result.error || '장소 등록에 실패했어요.'
      setError(msg)
      announce(msg, 'assertive')
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
    announce('사진에서 내용을 읽는 중이에요.')
    try {
      const result = await analyzeReceipt(base64)
      if (result.success && result.data) {
        if (result.data.amount) setAmount(String(result.data.amount))
        if (result.data.date) setDate(result.data.date)
        if (result.data.store) setDescription(result.data.store)
        announce('사진에서 내용을 다 읽었어요.')
      } else {
        const notice = '사진에서 내용을 읽지 못했어요. 아래 칸에 직접 입력해 주세요.'
        setOcrNotice(notice)
        announce(notice)
      }
    } finally {
      setOcrLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allocationId) return
    if (!amount || Number(amount) <= 0) {
      const msg = '얼마 썼는지 금액을 적어 주세요.'
      setAmountError(msg)
      announce(msg, 'assertive')
      return
    }

    setError('')
    setAmountError('')
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
        announce(result.error, 'assertive')
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
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <header className="flex h-14 items-center gap-3 px-4 z-10 sticky top-0 bg-card/80 backdrop-blur-md border-b border-border">
        <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="홈으로 가기">
          ←
        </Link>
        <h1 className="text-sm font-black text-foreground">지출 기록하기</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-6 flex flex-col gap-6 max-w-sm mx-auto w-full">
        {!allocationId ? (
          <section className="p-8 rounded-3xl bg-muted text-center">
            <p className="text-muted-foreground font-medium leading-relaxed">아직 예산이 정해지지 않았어요.<br />담당 선생님에게 말씀해 주세요.</p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-4 rounded-xl bg-danger-bg border border-border text-danger-fg text-sm font-medium leading-relaxed">
                {error}
              </div>
            )}

            {/* 막는 장치가 아니라 미리 알려주는 안내다. 기본은 접어 두어 기록을
                방해하지 않고, 궁금할 때 펼쳐 보게 한다(쉬운 정보 원칙: 한 번에
                많은 글을 보여주지 않기). */}
            {spendingRules.length > 0 && (
              <details className="rounded-2xl bg-card ring-1 ring-border overflow-hidden">
                <summary className="p-4 text-sm font-bold text-foreground cursor-pointer min-h-[44px] flex items-center leading-relaxed">
                  💡 지원이 어려운 것도 있어요
                </summary>
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <ul className="flex flex-col gap-1.5">
                    {spendingRules.map((label) => (
                      <li key={label} className="text-sm text-muted-foreground leading-relaxed">· {label}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground leading-relaxed bg-muted rounded-xl p-3">
                    그래도 꼭 필요한 것이면 지원받을 수 있어요.
                    담당 선생님과 먼저 이야기해 보세요.
                  </p>
                </div>
              </details>
            )}

            <div className="flex flex-col gap-2">
              <FormField id="receipt-photo" label="영수증 사진" help="사진이 있으면 날짜·금액을 자동으로 채워줘요.">
                {(field) => (
                  <input
                    {...field}
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
                )}
              </FormField>
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.previewUrl} alt="영수증 미리보기" className="w-full max-h-48 object-contain rounded-xl ring-1 ring-border" />
              )}
              {ocrLoading && <p className="text-xs text-muted-foreground">사진에서 읽어오는 중...</p>}
              {!ocrLoading && ocrNotice && <p className="text-xs text-warning-fg leading-relaxed">{ocrNotice}</p>}
            </div>

            <FormField id="usage-date" label="날짜">
              {(field) => (
                <input
                  {...field}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="p-3 rounded-xl bg-card ring-1 ring-border text-sm"
                />
              )}
            </FormField>

            <FormField
              id="amount"
              label="얼마 썼어요? (원)"
              required
              error={amountError || undefined}
              help={remaining !== null ? `남은 예산 ${won(remaining)}` : undefined}
            >
              {(field) => (
                <input
                  {...field}
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    if (amountError) setAmountError('')
                  }}
                  placeholder="0"
                  className="p-3 rounded-xl bg-card ring-1 ring-border text-sm"
                />
              )}
            </FormField>

            <FormField id="description" label="무엇에 썼어요?">
              {(field) => (
                <input
                  {...field}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 웹툰 학원 수강료"
                  className="p-3 rounded-xl bg-card ring-1 ring-border text-sm"
                />
              )}
            </FormField>

            {selectedPlace ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-foreground">어디에서 썼어요? (선택)</span>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
                  <span className="text-sm font-bold text-foreground">📍 {selectedPlace.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlace(null)}
                    className="text-xs text-muted-foreground min-h-[44px] px-2"
                  >
                    다시 찾기
                  </button>
                </div>
              </div>
            ) : (
              <FormField id="place-search" label="어디에서 썼어요? (선택)">
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-2">
                      <input
                        {...field}
                        type="text"
                        value={placeQuery}
                        onChange={(e) => setPlaceQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePlaceSearch() } }}
                        placeholder="장소 이름으로 찾아보세요"
                        className="flex-1 p-3 rounded-xl bg-card ring-1 ring-border text-sm"
                      />
                      <button
                        type="button"
                        onClick={handlePlaceSearch}
                        disabled={placeSearching}
                        className="px-4 rounded-xl bg-muted text-foreground text-sm font-bold disabled:opacity-50 min-h-[44px] min-w-[44px]"
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
                              className="w-full text-left p-3 rounded-xl bg-card ring-1 ring-border hover:ring-primary transition-all"
                            >
                              <span className="text-sm font-bold text-foreground block">{p.place_name}</span>
                              <span className="text-xs text-muted-foreground">{p.road_address_name || p.address_name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </FormField>
            )}

            {requestedServices.length > 0 && (
              <FormField id="requested-service" label="내 계획 중 어떤 것인가요? (선택)">
                {(field) => (
                  <select
                    {...field}
                    value={requestedServiceId}
                    onChange={(e) => setRequestedServiceId(e.target.value)}
                    className="p-3 rounded-xl bg-card ring-1 ring-border text-sm"
                  >
                    <option value="">고르지 않을래요</option>
                    {requestedServices.map((rs) => (
                      <option key={rs.id} value={rs.id}>{rs.service_name}</option>
                    ))}
                  </select>
                )}
              </FormField>
            )}

            <button
              type="submit"
              disabled={pending || ocrLoading}
              className="p-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 min-h-[44px]"
            >
              {pending ? '저장하고 있어요...' : '기록하기'}
            </button>
          </form>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-muted-foreground">최근에 쓴 돈</h2>
          {usages.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-relaxed">아직 쓴 돈이 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {usages.map((u) => (
                <li key={u.id} className="p-4 rounded-2xl bg-card ring-1 ring-border flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold leading-relaxed">{u.description ?? '활동'}</span>
                    <span className="text-xs text-muted-foreground">{u.usage_date} · {SETTLEMENT_LABEL[u.settlement_status] ?? u.settlement_status}</span>
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
