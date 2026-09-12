'use client'

import { useEffect, useState } from 'react'
import {
  loadEmojiCatalog,
  searchEmoji,
  getEmojisByGroup,
  GROUP_ORDER,
  GROUP_LABELS,
  type EmojiEntry,
} from '@/utils/emojiCatalog'

/**
 * EmojiPicker — 당사자가 잔액 위젯에 쓸 이모지를 그룹 탭·검색으로 고른다 (고아 기능 복원 §1).
 * 설계: Plan&Source/goala_orphan_features_restore_W.md §1. 계약: EmojiPicker.test.tsx.
 *
 * 배경: emojiCatalog(loadEmojiCatalog/searchEmoji/getEmojisByGroup)는 만들어졌으나 소비처 0(선택기 UI
 *   없음)이라 당사자가 balance_emoji 를 못 골랐다. 이 선택기가 그 배선을 채운다.
 * 카탈로그는 무거운 JSON 이라 마운트 후 비동기(loadEmojiCatalog·동적 import)로 불러온다 — 로딩 안내를 둔다.
 * 접근성: 이모지 버튼의 접근명에 이모지 글자 포함, 터치 44px, 전역 focus-visible, 시맨틱 토큰만.
 */

export interface EmojiPickerProps {
  value: string
  onSelect: (emoji: string) => void
}

export default function EmojiPicker({ value, onSelect }: EmojiPickerProps) {
  const [catalog, setCatalog] = useState<EmojiEntry[] | null>(null)
  const [group, setGroup] = useState<string>(GROUP_ORDER[0])
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    loadEmojiCatalog().then((c) => {
      if (alive) setCatalog(c)
    })
    return () => {
      alive = false
    }
  }, [])

  const q = query.trim()
  // 검색어가 있으면 slug 로 걸러진 결과, 없으면 활성 그룹의 이모지. 로딩 전엔 빈 배열.
  const emojis = catalog ? (q ? searchEmoji(catalog, q) : getEmojisByGroup(catalog, group)) : []

  return (
    <div className="flex flex-col gap-3">
      {/* 검색 — slug(영문)로 걸러진다. */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이모지 찾기"
        aria-label="이모지 찾기"
        className="w-full min-h-[44px] rounded-xl bg-input px-4 text-base text-foreground placeholder:text-muted-foreground"
      />

      {/* 그룹 탭 — 검색 중이 아닐 때만. 한글 라벨(GROUP_LABELS). */}
      {!q && (
        <div className="flex flex-wrap gap-2">
          {GROUP_ORDER.map((g) => {
            const meta = GROUP_LABELS[g]
            if (!meta) return null
            const active = g === group
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                aria-pressed={active}
                className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-colors ${
                  active
                    ? 'bg-positive text-positive-foreground'
                    : 'bg-card text-foreground ring-1 ring-border hover:bg-muted-hover'
                }`}
              >
                <span aria-hidden="true">{meta.icon}</span>
                {meta.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 이모지 격자 — 로딩·빈 결과 안내 포함. */}
      {!catalog ? (
        <p role="status" aria-live="polite" className="py-8 text-center text-sm text-muted-foreground">
          이모지를 불러오고 있어요…
        </p>
      ) : emojis.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">찾는 이모지가 없어요.</p>
      ) : (
        <ul className="grid grid-cols-6 gap-1">
          {emojis.map((e) => (
            <li key={e.emoji}>
              <button
                type="button"
                onClick={() => onSelect(e.emoji)}
                aria-pressed={e.emoji === value}
                title={e.slug.replace(/_/g, ' ')}
                className={`w-full min-h-[44px] rounded-xl text-2xl transition-colors hover:bg-muted-hover ${
                  e.emoji === value ? 'ring-2 ring-positive' : ''
                }`}
              >
                {e.emoji}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
