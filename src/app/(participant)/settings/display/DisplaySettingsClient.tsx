'use client'

import { useState } from 'react'
import { saveUIPreferences } from '@/app/actions/preferences'
import { OPTIONAL_BLOCKS, BLOCK_METADATA, type BlockId, type UIPreferences } from '@/utils/uiPreferences'

/**
 * 화면 설정 — 당사자가 홈에 무엇을 볼지 켜고 끈다. 설계: goala_ui_preferences_W.md §7.
 * 바꾸면 즉시 저장(saveUIPreferences). RLS·트리거가 최종 방어(본인은 ui_preferences 만).
 */
export default function DisplaySettingsClient({
  participantId,
  initial,
}: {
  participantId: string
  initial: UIPreferences
}) {
  const [enabled, setEnabled] = useState<Set<BlockId>>(new Set(initial.enabled_blocks))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(block: BlockId) {
    const prev = enabled
    const next = new Set(prev)
    if (next.has(block)) next.delete(block)
    else next.add(block)
    setEnabled(next) // 낙관적 반영
    setSaving(true)
    setError(null)

    const res = await saveUIPreferences(participantId, {
      enabled_blocks: OPTIONAL_BLOCKS.filter((b) => next.has(b)),
      balance_widget_style: initial.balance_widget_style,
      balance_emoji: initial.balance_emoji,
    })
    setSaving(false)
    if (res?.error) {
      setError(res.error)
      setEnabled(new Set(prev)) // 실패 시 되돌림
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 leading-relaxed">{error}</p>
      )}
      <ul className="flex flex-col gap-2">
        {OPTIONAL_BLOCKS.map((b) => {
          const meta = BLOCK_METADATA[b]
          const on = enabled.has(b)
          return (
            <li key={b}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${meta.label} — ${on ? '보여요' : '숨겨요'}`}
                disabled={saving}
                onClick={() => toggle(b)}
                className="w-full p-4 rounded-2xl bg-white ring-1 ring-zinc-200 flex items-center gap-3 text-left min-h-[44px] disabled:opacity-60 transition-opacity"
              >
                <span aria-hidden="true" className="text-2xl">
                  {meta.icon}
                </span>
                <span className="flex-1 flex flex-col">
                  <span className="font-bold text-zinc-800">{meta.label}</span>
                  <span className="text-xs text-zinc-400">{meta.description}</span>
                </span>
                <span className="shrink-0 flex items-center gap-2">
                  <span className={`text-xs font-bold ${on ? 'text-emerald-600' : 'text-zinc-400'}`}>
                    {on ? '보여요' : '숨겨요'}
                  </span>
                  <span
                    className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors ${
                      on ? 'bg-emerald-500 justify-end' : 'bg-zinc-300 justify-start'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-white shadow" />
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-zinc-400 text-center leading-relaxed pt-1">
        {saving ? '저장하고 있어요…' : '바꾸면 바로 저장해요.'}
      </p>
    </div>
  )
}
