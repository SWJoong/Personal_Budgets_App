'use client'

import { useEffect, useState, useTransition } from 'react'
import { exitParticipantView } from '@/app/actions/viewAs'
import { VIEW_AS_ID_COOKIE, VIEW_AS_NAME_COOKIE } from '@/utils/viewAsCookies'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * 관리자 '둘러보기(view-as)' 상단 배너 — 지금 남의 당사자 화면을 미리보기 중이며 저장되지 않음을
 * 알리고, 원터치로 빠져나갈 수 있게 한다. 쿠키를 클라이언트에서 읽어 상태를 정한다(레이아웃은
 * 동기 컴포넌트로 유지 → SSR/테스트 계약 보존). 미리보기가 아니면 아무것도 렌더하지 않는다.
 */
export function ViewAsBanner() {
  const [vs, setVs] = useState<{ active: boolean; name: string | null }>({ active: false, name: null })
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const id = readCookie(VIEW_AS_ID_COOKIE)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 클라 전용 쿠키를 마운트 후 읽어 동기화(SSR-safe)
    if (id) setVs({ active: true, name: readCookie(VIEW_AS_NAME_COOKIE) })
  }, [])

  if (!vs.active) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2 bg-warning-bg text-warning-fg ring-1 ring-warning-fg/20"
    >
      <span className="text-sm font-bold leading-relaxed">
        🔎 관리자 미리보기 — {vs.name ?? '당사자'}님 화면이에요. 여기서는 저장되지 않아요.
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => { exitParticipantView() })}
        disabled={pending}
        className="shrink-0 min-h-[44px] px-4 rounded-xl bg-card text-foreground ring-1 ring-border font-bold text-sm hover:bg-muted-hover transition-colors disabled:opacity-60"
      >
        {pending ? '나가는 중…' : '미리보기 나가기'}
      </button>
    </div>
  )
}
