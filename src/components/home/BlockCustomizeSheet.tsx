'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { UIPreferences, OPTIONAL_BLOCKS, BLOCK_METADATA, REQUIRED_BLOCKS, BlockId } from '@/types/ui-preferences'

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
  const [swapTargetId, setSwapTargetId] = useState<BlockId | null>(null)

  // 포인터 핸들러 stale 방지 refs
  const draggingRef    = useRef<BlockId | null>(null)
  const enabledListRef = useRef<HTMLDivElement>(null)

  // FLIP 애니메이션을 위한 refs
  const itemElemsRef   = useRef<Map<BlockId, HTMLDivElement>>(new Map())
  const prevPositions  = useRef<Map<BlockId, number>>(new Map())
  const shouldFlip     = useRef(false)

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
  // blocks 상태가 바뀐 뒤(DOM 반영 직후) 이전 위치 → 새 위치로 부드럽게 이동
  useLayoutEffect(() => {
    if (!shouldFlip.current) return
    shouldFlip.current = false

    itemElemsRef.current.forEach((el, id) => {
      const prev = prevPositions.current.get(id)
      if (prev === undefined) return
      const next = el.getBoundingClientRect().top
      const delta = prev - next
      if (Math.abs(delta) < 1) return

      // 이전 위치에서 시작 (transition 없이)
      el.style.transition = 'none'
      el.style.transform  = `translateY(${delta}px)`
      // reflow 강제 → transition 적용
      void el.offsetHeight
      el.style.transition = 'transform 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
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

  // ── 드래그 핸들러 ─────────────────────────────────────────────────────────
  function onHandlePointerDown(e: React.PointerEvent<HTMLSpanElement>, id: BlockId) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = id
    setDraggingId(id)
    setSwapTargetId(null)
  }

  function onHandlePointerMove(e: React.PointerEvent<HTMLSpanElement>) {
    const currentId = draggingRef.current
    if (!currentId || !enabledListRef.current) return

    const items = Array.from(enabledListRef.current.children) as HTMLElement[]

    for (const item of items) {
      const rect = item.getBoundingClientRect()
      if (e.clientY >= rect.top && e.clientY < rect.bottom) {
        const targetId = item.dataset.id as BlockId | undefined
        if (!targetId || targetId === currentId) {
          setSwapTargetId(null)
          return
        }

        setSwapTargetId(targetId)

        // 위치 캡처 → setBlocks → useLayoutEffect에서 FLIP 실행
        capturePositions()

        setBlocks(prev => {
          const enabled  = prev.filter(b => b.enabled)
          const disabled = prev.filter(b => !b.enabled)
          const fromIdx  = enabled.findIndex(b => b.id === currentId)
          const toIdx    = enabled.findIndex(b => b.id === targetId)
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
            shouldFlip.current = false
            return prev
          }
          shouldFlip.current = true
          const next = [...enabled]
          ;[next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]]
          return [...next, ...disabled]
        })
        break
      }
    }
  }

  function onHandlePointerUp() {
    draggingRef.current = null
    setDraggingId(null)
    setSwapTargetId(null)
  }

  function handleSave() {
    const enabledBlocks = blocks.filter(b => b.enabled).map(b => b.id)
    onSave({ enabled_blocks: enabledBlocks })
  }

  const enabledBlocks  = blocks.filter(b => b.enabled)
  const disabledBlocks = blocks.filter(b => !b.enabled)

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
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-200" />
        </div>

        <div
          className="px-6 pb-10 pt-3 max-h-[80vh] overflow-y-auto"
          style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          <h2 className="text-lg font-black text-zinc-900 mb-1">화면 구성 편집</h2>
          <p className="text-sm text-zinc-400 mb-6">
            보고 싶은 정보를 선택하고 순서를 바꿀 수 있어요
          </p>

          {/* 필수 블록 */}
          <div className="mb-4">
            <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">항상 표시</p>
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

          {/* ON 블록 — 드래그로 순서 변경 */}
          {enabledBlocks.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">
                표시 중 — 핸들을 잡고 위아래로 드래그해요
              </p>
              <div ref={enabledListRef} className="flex flex-col gap-2">
                {enabledBlocks.map((block) => {
                  const meta      = BLOCK_METADATA[block.id]
                  const isDragging = draggingId === block.id
                  const isTarget   = swapTargetId === block.id && !isDragging

                  return (
                    <div
                      key={block.id}
                      data-id={block.id}
                      ref={(el) => {
                        if (el) itemElemsRef.current.set(block.id, el)
                        else    itemElemsRef.current.delete(block.id)
                      }}
                      className={`
                        flex items-center gap-3 p-4 rounded-2xl bg-zinc-900 ring-1 select-none
                        ${isDragging
                          ? 'ring-white/40 scale-[1.04] shadow-[0_12px_36px_rgba(0,0,0,0.5)] opacity-80 z-10 relative'
                          : isTarget
                          ? 'ring-blue-400 shadow-[0_0_0_3px_rgba(96,165,250,0.25)]'
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
              </div>
            </div>
          )}

          {/* OFF 블록 */}
          {disabledBlocks.length > 0 && (
            <div>
              <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">숨김</p>
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

          <button
            onClick={handleSave}
            className="w-full mt-6 py-4 rounded-2xl bg-zinc-900 text-white font-black text-base active:scale-[0.98] transition-transform"
          >
            저장하기
          </button>
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
