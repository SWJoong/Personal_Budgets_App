'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addActivityPhotos } from '@/app/actions/activityPhoto'
import { useToast } from '@/components/ui/LiveRegion'

/**
 * 활동 사진 업로더 — 특정 지출(usageId)에 활동 사진을 추가한다. 실무자·당사자 공용(RLS: 담당 staff 또는 본인).
 * 설계: docs/release/14 후속(실무자 활동사진 업로드). 사진은 스키마상 지출(usage)에 종속되므로 usageId 필수.
 *
 * 서버 액션 addActivityPhotos 가 참여자·경로를 서버에서 도출(위조 불가) + RLS + 경로위조 트리거로 3중 방어.
 * 이 컴포넌트는 파일 선택·base64 변환·용량 검사만 하고 업로드는 액션에 맡긴다. view-as 중엔 액션이 차단.
 */

const MAX_BYTES = 5 * 1024 * 1024 // 5MB/장

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

export default function ActivityPhotoUploader({ usageId }: { usageId: string }) {
  const router = useRouter()
  const { announce } = useToast()
  const [pending, startTransition] = useTransition()
  const [photos, setPhotos] = useState<{ base64: string; mimeType: string; name: string }[]>([])
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const files = Array.from(e.target.files ?? [])
    const next: { base64: string; mimeType: string; name: string }[] = []
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        setError('사진은 한 장에 5MB 이하로 올려 주세요.')
        continue
      }
      try {
        const { base64, mimeType } = await fileToBase64(f)
        if (base64) next.push({ base64, mimeType, name: f.name })
      } catch {
        setError('사진을 읽지 못했어요. 다시 선택해 주세요.')
      }
    }
    setPhotos((prev) => [...prev, ...next])
    if (inputRef.current) inputRef.current.value = '' // 같은 파일 재선택 허용
  }

  function removeAt(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
  }

  function submit() {
    if (!photos.length) return
    setError('')
    startTransition(async () => {
      const result = await addActivityPhotos(
        usageId,
        photos.map((p) => ({ base64: p.base64, mimeType: p.mimeType })),
      )
      if (result.error) {
        setError(result.error)
        announce(result.error, 'assertive')
        return
      }
      setPhotos([])
      announce(`활동 사진 ${result.added ?? 0}장을 올렸어요.`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-danger-fg font-bold">{error}</p>}

      <label className="flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-muted text-foreground font-bold text-sm ring-1 ring-border hover:bg-muted-hover transition-colors cursor-pointer">
        <span aria-hidden="true">📷</span> 사진 고르기
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
          className="sr-only"
        />
      </label>

      {photos.length > 0 && (
        <>
          <ul className="flex flex-col gap-1">
            {photos.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-lg bg-muted">
                <span className="truncate text-muted-foreground">{p.name}</span>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  disabled={pending}
                  aria-label={`${p.name} 빼기`}
                  className="shrink-0 min-h-[44px] px-2 text-xs font-bold text-muted-foreground hover:text-danger-fg transition-colors"
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="min-h-[44px] px-5 rounded-xl bg-hero text-hero-foreground font-bold text-sm hover:bg-hero-hover transition-colors disabled:opacity-50"
          >
            {pending ? '올리는 중...' : `활동 사진 ${photos.length}장 올리기`}
          </button>
        </>
      )}
    </div>
  )
}
