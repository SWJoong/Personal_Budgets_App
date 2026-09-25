'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { attachReceipt } from '@/app/actions/serviceUsage'
import { useOptionalToast } from '@/components/ui/LiveRegion'

/**
 * 영수증 업로더 — 이미 기록된 지출(usageId)에 영수증을 첨부/교체한다. 실무자·당사자 공용
 * (RLS: 담당 staff 또는 self-pending). 신규 지출은 recordServiceUsage 가 영수증을 함께 받지만,
 * 기존 지출(검토 대기·거래 상세)에 뒤늦게 붙이는 경로가 없어 이 컴포넌트 + attachReceipt 로 메운다.
 *
 * 영수증은 usage 당 1장이라 다중 업로더(ActivityPhotoUploader)와 달리 단건. 파일 선택 → base64 변환
 * → 5MB 검사만 하고 업로드는 액션에 맡긴다(참여자·경로 서버 도출, view-as 차단).
 */

const MAX_BYTES = 5 * 1024 * 1024 // 5MB

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve({ base64: result.split(',')[1] ?? '', mimeType: file.type || 'image/jpeg' })
    }
    reader.onerror = () => reject(new Error('파일을 읽지 못했어요.'))
    reader.readAsDataURL(file)
  })
}

export default function ReceiptUploader({
  usageId,
  hasReceipt = false,
}: {
  usageId: string
  /** 이미 영수증이 있으면 버튼 문구를 '영수증 바꾸기'로 바꾼다. */
  hasReceipt?: boolean
}) {
  const router = useRouter()
  const { announce } = useOptionalToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = '' // 같은 파일 재선택 허용
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError('영수증은 5MB 이하로 올려 주세요.')
      return
    }
    let payload: { base64: string; mimeType: string }
    try {
      payload = await fileToBase64(file)
    } catch {
      setError('사진을 읽지 못했어요. 다시 선택해 주세요.')
      return
    }
    if (!payload.base64) {
      setError('사진을 읽지 못했어요. 다시 선택해 주세요.')
      return
    }
    startTransition(async () => {
      const result = await attachReceipt(usageId, payload)
      if (result.error) {
        setError(result.error)
        announce(result.error, 'assertive')
        return
      }
      announce(hasReceipt ? '영수증을 바꿨어요.' : '영수증을 올렸어요.')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-danger-fg font-bold">{error}</p>}
      <label className="flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-muted text-foreground font-bold text-sm ring-1 ring-border hover:bg-muted-hover transition-colors cursor-pointer">
        <span aria-hidden="true">🧾</span> {pending ? '올리는 중...' : hasReceipt ? '영수증 바꾸기' : '영수증 올리기'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          disabled={pending}
          className="sr-only"
        />
      </label>
    </div>
  )
}
