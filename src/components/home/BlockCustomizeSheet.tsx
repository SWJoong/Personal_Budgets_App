'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { UIPreferences, OPTIONAL_BLOCKS, BLOCK_METADATA, REQUIRED_BLOCKS, BlockId } from '@/types/ui-preferences'
import { useAccessibility } from '@/hooks/useAccessibility'

interface BlockItem {
  id: BlockId
  enabled: boolean
}

interface BlockCustomizeSheetProps {
  isOpen: boolean
  currentPreferences: UIPreferences
  onSave: (newPrefs: UIPreferences) => void
  onClose: () => void
}

export default function BlockCustomizeSheet({
  isOpen,
  currentPreferences,
  onSave,
  onClose,
}: BlockCustomizeSheetProps) {
  const [blocks, setBlocks] = useState<BlockItem[]>(() => buildBlockList(currentPreferences))
  const [draggingId, setDraggingId] = useState<BlockId | null>(null)
  const { highContrast, setHighContrast, darkMode, setDarkMode, yellowBg, setYellowBg, easyTerms, setEasyTerms, fontSize, setFontSize } = useAccessibility()
  // 드래그 중 삽입 위치 — 해당 아이템 '위'에 삽입. 'END'는 맨 아래.
  const [insertBeforeId, setInsertBeforeId] = useState<BlockId | 'END' | null>(null)

  const draggingRef     = useRef<BlockId | null>(null)
  const insertBeforeRef = useRef<BlockId | 'END' | null>(null)
  const enabledListRef  = useRef<HTMLDivElement>(null)

  // FLIP 애니메이션 refs
  const itemElemsRef  = useRef<Map<BlockId, HTMLDivElement>>(new Map())
  const prevPositions = useRef<Map<BlockId, number>>(new Map())
  const shouldFlip    = useRef(false)

  function buildBlockList(prefs: UIPreferences): BlockItem[] {
    const enabledSet = new Set(prefs.enabled_blocks)
    const result: BlockItem[] = prefs.enabled_blocks.map(id => ({ id, enabled: true }))
    OPTIONAL_BLOCKS.forEach(id => {
      if (!enabledSet.has(id)) result.push({ id, enabled: false })
    })
    return result
  }

  useEffect(() => {
    if (isOpen) setBlocks(buildBlockList(currentPreferences))
  }, [isOpen, currentPreferences])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // ── FLIP 애니메이션 ───────────────────────────────────────────────────────
  // 드롭 후 배열이 재정렬되면 각 아이템이 이전 위치 → 새 위치로 부드럽게 이동
  useLayoutEffect(() => {
    if (!shouldFlip.current) return
    shouldFlip.current = false

    itemElemsRef.current.forEach((el, id) => {
      const prev = prevPositions.current.get(id)
      if (prev === undefined) return
      const next = el.getBoundingClientRect().top
      const delta = prev - next
      if (Math.abs(delta) < 1) return

      // 이전 위치에서 시작 (transition 없음)
      el.style.transition = 'none'
      el.style.transform  = `translateY(${delta}px)`
      void el.offsetHeight                                   // reflow 강제
      // 새 위치로 부드럽게 이동
      el.style.transition = 'transform 260ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      el.style.transform  = 'translateY(0px)'
    })
  }, [blocks])

  function capturePositions() {
    itemElemsRef.current.forEach((el, id) => {
      prevPositions.current.set(id, el.getBoundingClientRect().top)
    })
  }

  function toggleBlock(blockId: BlockId) {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, enabled: !b.enabled } : b))
  }

  // ── 드래그 핸들러 (insert-on-release) ─────────────────────────────────────
  // 드래그 중에는 배열 순서를 변경하지 않는다.
  // 삽입 위치(insertBeforeId)만 추적하고, 드롭 시 한 번만 재정렬 → FLIP 애니메이션.

  function onHandlePointerDown(e: React.PointerEvent<HTMLSpanElement>, id: BlockId) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current      = id
    insertBeforeRef.current  = null
    setDraggingId(id)
    setInsertBeforeId(null)
  }

  function onHandlePointerMove(e: React.PointerEvent<HTMLSpanElement>) {
    const currentId = draggingRef.current
    if (!currentId || !enabledListRef.current) return

    const items = Array.from(enabledListRef.current.children) as HTMLElement[]
    let newTarget: BlockId | 'END' = 'END'

    for (const item of items) {
      const targetId = item.dataset.id as BlockId | undefined
      if (!targetId || targetId === currentId) continue       // 드래그 중인 아이템 건너뜀

      const rect = item.getBoundingClientRect()
      const mid  = (rect.top + rect.bottom) / 2

      if (e.clientY < mid) {
        newTarget = targetId
        break
      }
    }

    if (insertBeforeRef.current !== newTarget) {
      insertBeforeRef.current = newTarget
      setInsertBeforeId(newTarget)
    }
  }

  function onHandlePointerUp() {
    const currentId = draggingRef.current
    const target    = insertBeforeRef.current

    if (currentId && target !== null) {
      // 드롭 — 현재 위치 캡처 후 배열 재정렬 → FLIP 실행
      capturePositions()
      shouldFlip.current = true

      setBlocks(prev => {
        const enabled  = prev.filter(b => b.enabled)
        const disabled = prev.filter(b => !b.enabled)
        const item     = enabled.find(b => b.id === currentId)
        if (!item) return prev

        const without = enabled.filter(b => b.id !== currentId)

        if (target === 'END') {
          return [...without, item, ...disabled]
        }

        const idx = without.findIndex(b => b.id === target)
        if (idx === -1) return [...without, item, ...disabled]
        const next = [...without]
        next.splice(idx, 0, item)
        return [...next, ...disabled]
      })
    }

    draggingRef.current     = null
    insertBeforeRef.current = null
    setDraggingId(null)
    setInsertBeforeId(null)
  }

  function handleSave() {
    const enabledBlocks = blocks.filter(b => b.enabled).map(b => b.id)
    onSave({ enabled_blocks: enabledBlocks })
  }

  const enabledBlocks  = blocks.filter(b => b.enabled)
  const disabledBlocks = blocks.filter(b => !b.enabled)
  const sheetTouchStartY = useRef(0)



  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:max-w-[600px] lg:w-full ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="화면 구성 편집"
      >
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab"
          onTouchStart={e => { sheetTouchStartY.current = e.touches[0].clientY }}
          onTouchMove={e => {
            const delta = e.touches[0].clientY - sheetTouchStartY.current
            if (delta > 50) onClose()
          }}
        >
          <div className="w-10 h-1 rounded-full bg-zinc-200" />
        </div>

        {/* 고정 헤더 — 제목 + 저장 버튼 */}
        <div className="flex items-center justify-between px-6 pt-3 pb-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-lg font-black text-zinc-900 leading-tight">화면 꾸미기</h2>
            <p className="text-xs text-zinc-400 mt-0.5">보고 싶은 정보를 선택하고 순서를 바꿀 수 있어요</p>
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-green-600 text-white font-black text-sm active:scale-95 transition-transform"
          >
            저장
          </button>
        </div>

        <div
          className="px-6 pb-10 pt-4 max-h-[72vh] overflow-y-auto"
          style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom) + 0.5rem)' }}
        >

          {/* 화면 설정 */}
          <div className="mb-6">
            <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">화면 설정</p>
            
            {/* 글자 크기 조정 */}
            <div className="bg-white rounded-2xl ring-1 ring-zinc-100 p-3.5 mb-3 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-700">글자 크기</span>
                <span className="text-xs text-zinc-400">화면의 글자 크기를 조절해요</span>
              </div>
              <div className="flex bg-zinc-100 rounded-xl p-1 shrink-0">
                {(['normal', 'large', 'huge'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    aria-label={`글자 크기: ${size === 'normal' ? '보통' : size === 'large' ? '크게' : '아주 크게'}`}
                    className={`w-10 h-8 flex items-center justify-center rounded-lg font-bold transition-all ${
                      fontSize === size ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <span className={size === 'normal' ? 'text-sm' : size === 'large' ? 'text-lg' : 'text-xl'}>가</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-0 bg-white rounded-2xl ring-1 ring-zinc-100 overflow-hidden">
              {[
                { key: 'highContrast', label: '🌗 글씨가 더 잘 보여요', desc: '글씨와 배경의 대비를 높여요', value: highContrast, set: setHighContrast, color: 'bg-zinc-900' },
                { key: 'darkMode',     label: '🌙 다크 모드',           desc: '눈부심을 줄여요',             value: darkMode,     set: setDarkMode,     color: 'bg-indigo-600' },
                { key: 'yellowBg',     label: '🟡 노란 배경',           desc: '읽기 편하게 노란 배경으로',   value: yellowBg,     set: setYellowBg,     color: 'bg-yellow-400' },
                { key: 'easyTerms',    label: '💬 쉬운 말 모드',        desc: '어려운 말을 쉽게 바꿔요',     value: easyTerms,    set: setEasyTerms,    color: 'bg-blue-600' },
              ].map(({ key, label, desc, value, set, color }, idx, arr) => (
                <div
                  key={key}
                  className={`flex items-center justify-between px-4 py-3.5 ${idx < arr.length - 1 ? 'border-b border-zinc-100' : ''}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-700">{label}</span>
                    <span className="text-xs text-zinc-400">{desc}</span>
                  </div>
                  <button
                    onClick={() => set(!value)}
                    className={`relative w-12 h-7 rounded-full transition-all duration-300 ${value ? color : 'bg-zinc-200'}`}
                    role="switch"
                    aria-checked={value}
                  >
                    <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${value ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 필수 블록 */}
          <div className="mb-4">
            <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">항상 보여요</p>
            <div className="flex flex-col gap-2">
              {REQUIRED_BLOCKS.map(blockId => (
                <div key={blockId} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-100">
                  <span className="text-2xl">{blockId === 'balance_widget' ? '💰' : '📸'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-zinc-500">
                      {blockId === 'balance_widget' ? '남은 돈 보기' : '영수증 버튼'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {blockId === 'balance_widget' ? '남은 돈을 그림으로 보여줘요' : '영수증 사진 찍기'}
                    </p>
                  </div>
                  <span className="text-zinc-300">🔒</span>
                </div>
              ))}
            </div>
          </div>

          {/* ON 블록 */}
          {enabledBlocks.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">
                보이는 중 — 줄무늬를 잡고 위아래로 끌어요
              </p>
              <div ref={enabledListRef} className="flex flex-col gap-2">
                {enabledBlocks.map((block) => {
                  const meta = BLOCK_METADATA[block.id]
                  const isDragging = draggingId === block.id
                  const isTarget   = insertBeforeId === block.id && !!draggingId

                  return (
                    <div
                      key={block.id}
                      data-id={block.id}
                      ref={(el) => {
                        if (el) itemElemsRef.current.set(block.id, el)
                        else    itemElemsRef.current.delete(block.id)
                      }}
                      style={isTarget
                        ? { boxShadow: '0 -3px 0 0 #3b82f6' }
                        : undefined
                      }
                      className={`
                        flex items-center gap-3 p-4 rounded-2xl bg-zinc-900 ring-1 select-none
                        ${isDragging
                          ? 'ring-white/30 scale-[1.04] shadow-[0_14px_40px_rgba(0,0,0,0.55)] opacity-75 relative z-10'
                          : 'ring-zinc-800'}
                      `}
                    >
                      {/* 드래그 핸들 */}
                      <span
                        onPointerDown={(e) => onHandlePointerDown(e, block.id)}
                        onPointerMove={onHandlePointerMove}
                        onPointerUp={onHandlePointerUp}
                        onPointerCancel={onHandlePointerUp}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 touch-none select-none transition-colors ${
                          isDragging
                            ? 'cursor-grabbing bg-white/20'
                            : 'cursor-grab text-zinc-500 hover:bg-white/10'
                        }`}
                        aria-label="드래그해서 순서 변경"
                      >
                        <DragHandleIcon />
                      </span>

                      <span className="text-2xl shrink-0">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{meta.label}</p>
                        <p className="text-xs text-zinc-400">{meta.description}</p>
                      </div>

                      {/* 토글 OFF */}
                      <button
                        onClick={() => toggleBlock(block.id)}
                        className="w-6 h-6 rounded-full border-2 border-white bg-white flex items-center justify-center shrink-0 active:scale-90"
                        aria-label={`${meta.label} 숨기기`}
                      >
                        <div className="w-3 h-3 rounded-full bg-zinc-900" />
                      </button>
                    </div>
                  )
                })}
                {/* 마지막 위치에 드롭할 때 나타나는 안내선 */}
                {insertBeforeId === 'END' && !!draggingId && (
                  <div className="h-0.5 bg-blue-500 rounded-full mt-1" />
                )}
              </div>
            </div>
          )}

          {/* OFF 블록 */}
          {disabledBlocks.length > 0 && (
            <div>
              <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">안 보이는 것들</p>
              <div className="flex flex-col gap-2">
                {disabledBlocks.map(block => {
                  const meta = BLOCK_METADATA[block.id]
                  return (
                    <button
                      key={block.id}
                      onClick={() => toggleBlock(block.id)}
                      className="flex items-center gap-4 p-4 rounded-2xl ring-1 text-left transition-all active:scale-[0.98] bg-white ring-zinc-100 hover:ring-zinc-200"
                    >
                      <span className="text-2xl">{meta.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-zinc-700">{meta.label}</p>
                        <p className="text-xs text-zinc-400">{meta.description}</p>
                      </div>
                      <div className="w-6 h-6 rounded-full border-2 border-zinc-200 bg-white shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// 6점 격자 드래그 핸들 아이콘
function DragHandleIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" fill="currentColor" className="text-zinc-400">
      <circle cx="4"  cy="3"  r="2" />
      <circle cx="10" cy="3"  r="2" />
      <circle cx="4"  cy="9"  r="2" />
      <circle cx="10" cy="9"  r="2" />
      <circle cx="4"  cy="15" r="2" />
      <circle cx="10" cy="15" r="2" />
    </svg>
  )
}
