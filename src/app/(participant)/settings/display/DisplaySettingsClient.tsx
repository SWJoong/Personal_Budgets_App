'use client'

import { useState } from 'react'
import { saveUIPreferences } from '@/app/actions/preferences'
import {
  OPTIONAL_BLOCKS,
  BLOCK_METADATA,
  type BlockId,
  type BalanceWidgetStyle,
  type UIPreferences,
} from '@/utils/uiPreferences'

/**
 * 화면 설정 — 당사자가 홈에 무엇을 볼지(블록 토글) + 잔액을 어떤 모양으로 볼지(위젯 스타일) 고른다.
 * 설계: goala_ui_preferences_W.md §7 + goala_balance_widget_roleswitch_W.md §1-2.
 * 바꾸면 즉시 저장(saveUIPreferences). RLS·트리거가 최종 방어(본인은 ui_preferences 만).
 */

/** 잔액 위젯 5스타일 — 라벨/설명은 easy-read. 설명은 다른 스타일의 키워드를 섞지 않는다. */
const STYLE_OPTIONS: { value: BalanceWidgetStyle; icon: string; label: string; desc: string }[] = [
  { value: 'pie', icon: '🥧', label: '파이', desc: '남은 만큼 동그라미가 차요' },
  { value: 'water', icon: '🥤', label: '물컵', desc: '컵에 물이 차요' },
  { value: 'cash', icon: '💵', label: '현금', desc: '지폐가 쌓여요' },
  { value: 'emoji', icon: '😊', label: '이모지', desc: '고른 그림으로 보여줘요' },
  { value: 'text', icon: '🔢', label: '글자', desc: '숫자로 크게 보여줘요' },
]

export default function DisplaySettingsClient({
  participantId,
  initial,
}: {
  participantId: string
  initial: UIPreferences
}) {
  const [enabled, setEnabled] = useState<Set<BlockId>>(new Set(initial.enabled_blocks))
  const [style, setStyle] = useState<BalanceWidgetStyle>(initial.balance_widget_style)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 현재 상태 전체를 저장한다 — 블록·스타일을 서로 덮어쓰지 않도록 항상 최신값으로 보낸다.
  async function persist(nextEnabled: Set<BlockId>, nextStyle: BalanceWidgetStyle) {
    setSaving(true)
    setError(null)
    const res = await saveUIPreferences(participantId, {
      enabled_blocks: OPTIONAL_BLOCKS.filter((b) => nextEnabled.has(b)),
      balance_widget_style: nextStyle,
      balance_emoji: initial.balance_emoji,
    })
    setSaving(false)
    return res
  }

  async function toggle(block: BlockId) {
    const prev = enabled
    const next = new Set(prev)
    if (next.has(block)) next.delete(block)
    else next.add(block)
    setEnabled(next) // 낙관적 반영
    const res = await persist(next, style)
    if (res?.error) {
      setError(res.error)
      setEnabled(new Set(prev)) // 실패 시 되돌림
    }
  }

  async function chooseStyle(next: BalanceWidgetStyle) {
    if (next === style) return
    const prev = style
    setStyle(next) // 낙관적 반영
    const res = await persist(enabled, next)
    if (res?.error) {
      setError(res.error)
      setStyle(prev) // 실패 시 되돌림
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-danger-fg bg-danger-bg rounded-xl px-3 py-2 leading-relaxed">{error}</p>
      )}

      {/* 잔액 위젯 모양 — 라디오 5개(파이·물컵·현금·이모지·글자). */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-black text-foreground">잔액을 어떤 모양으로 볼까요?</h3>
        <div role="radiogroup" aria-label="잔액 위젯 모양" className="flex flex-col gap-2">
          {STYLE_OPTIONS.map((o) => {
            const checked = style === o.value
            return (
              <label
                key={o.value}
                className={`w-full p-4 rounded-2xl bg-card ring-1 flex items-center gap-3 cursor-pointer min-h-[44px] transition-colors ${
                  checked ? 'ring-2 ring-positive' : 'ring-border'
                } ${saving ? 'opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="balance_widget_style"
                  value={o.value}
                  checked={checked}
                  disabled={saving}
                  onChange={() => chooseStyle(o.value)}
                  className="w-5 h-5 accent-positive shrink-0"
                />
                <span aria-hidden="true" className="text-2xl">
                  {o.icon}
                </span>
                <span className="flex-1 flex flex-col">
                  <span className="font-bold text-foreground">{o.label}</span>
                  <span className="text-xs text-muted-foreground">{o.desc}</span>
                </span>
              </label>
            )
          })}
        </div>
      </section>

      {/* 홈에 무엇을 볼지 — 블록 토글. */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-black text-foreground">홈에 무엇을 볼까요?</h3>
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
                  className="w-full p-4 rounded-2xl bg-card ring-1 ring-border flex items-center gap-3 text-left min-h-[44px] disabled:opacity-60 transition-opacity"
                >
                  <span aria-hidden="true" className="text-2xl">
                    {meta.icon}
                  </span>
                  <span className="flex-1 flex flex-col">
                    <span className="font-bold text-foreground">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">{meta.description}</span>
                  </span>
                  <span className="shrink-0 flex items-center gap-2">
                    <span className={`text-xs font-bold ${on ? 'text-success-fg' : 'text-muted-foreground'}`}>
                      {on ? '보여요' : '숨겨요'}
                    </span>
                    <span
                      className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors ${
                        on ? 'bg-positive justify-end' : 'bg-input justify-start'
                      }`}
                    >
                      <span className="w-6 h-6 rounded-full bg-card shadow" />
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground text-center leading-relaxed pt-1">
        {saving ? '저장하고 있어요…' : '바꾸면 바로 저장해요.'}
      </p>
    </div>
  )
}
