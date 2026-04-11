'use client'

import { useEffect, useState } from 'react'
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
  // 순서 포함한 블록 목록 — enabled 블록은 저장 순서 유지, disabled는 하단에
  const [blocks, setBlocks] = useState<BlockItem[]>(() => buildBlockList(currentPreferences))

  function buildBlockList(prefs: UIPreferences): BlockItem[] {
    const enabledSet = new Set(prefs.enabled_blocks)
    const result: BlockItem[] = prefs.enabled_blocks.map(id => ({ id, enabled: true }))
    OPTIONAL_BLOCKS.forEach(id => {
      if (!enabledSet.has(id)) result.push({ id, enabled: false })
    })
    return result
  }

  // 시트가 열릴 때마다 현재 설정으로 초기화
  useEffect(() => {
    if (isOpen) setBlocks(buildBlockList(currentPreferences))
  }, [isOpen, currentPreferences])

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  function toggleBlock(blockId: BlockId) {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, enabled: !b.enabled } : b))
  }

  function moveBlock(blockId: BlockId, direction: 'up' | 'down') {
    setBlocks(prev => {
      // 이동은 enabled 블록 내에서만
      const enabledIndices = prev.map((b, i) => b.enabled ? i : -1).filter(i => i !== -1)
      const posInEnabled = enabledIndices.findIndex(i => prev[i].id === blockId)
      if (posInEnabled === -1) return prev

      if (direction === 'up' && posInEnabled === 0) return prev
      if (direction === 'down' && posInEnabled === enabledIndices.length - 1) return prev

      const targetIdx = direction === 'up'
        ? enabledIndices[posInEnabled - 1]
        : enabledIndices[posInEnabled + 1]
      const currentIdx = enabledIndices[posInEnabled]

      const next = [...prev]
      ;[next[currentIdx], next[targetIdx]] = [next[targetIdx], next[currentIdx]]
      return next
    })
  }

  function handleSave() {
    const enabledBlocks = blocks.filter(b => b.enabled).map(b => b.id)
    onSave({ enabled_blocks: enabledBlocks })
  }

  const enabledBlocks = blocks.filter(b => b.enabled)
  const disabledBlocks = blocks.filter(b => !b.enabled)

  return (
    <>
      {/* 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* 바텀시트 */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:max-w-[600px] lg:w-full ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="화면 구성 편집"
      >
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-200" />
        </div>

        <div
          className="px-6 pb-10 pt-3 max-h-[80vh] overflow-y-auto"
          style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          <h2 className="text-lg font-black text-zinc-900 mb-1">화면 구성 편집</h2>
          <p className="text-sm text-zinc-400 mb-6">보고 싶은 정보를 선택하고 순서를 바꿀 수 있어요</p>

          {/* 필수 블록 */}
          <div className="mb-4">
            <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">항상 표시</p>
            <div className="flex flex-col gap-2">
              {REQUIRED_BLOCKS.map(blockId => (
                <div key={blockId} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-100">
                  <span className="text-2xl">{blockId === 'balance_widget' ? '💰' : '📸'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-zinc-500">
                      {blockId === 'balance_widget' ? '잔액 위젯' : '영수증 버튼'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {blockId === 'balance_widget' ? '현재 예산 잔액 시각화' : '영수증 사진 찍기'}
                    </p>
                  </div>
                  <span className="text-zinc-300">🔒</span>
                </div>
              ))}
            </div>
          </div>

          {/* ON 블록 (순서 변경 가능) */}
          {enabledBlocks.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">표시 중 — 순서 변경 가능</p>
              <div className="flex flex-col gap-2">
                {enabledBlocks.map((block, posIdx) => {
                  const meta = BLOCK_METADATA[block.id]
                  return (
                    <div
                      key={block.id}
                      className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900 ring-1 ring-zinc-800"
                    >
                      {/* 순서 버튼 */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => moveBlock(block.id, 'up')}
                          disabled={posIdx === 0}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black disabled:opacity-20 text-white hover:bg-white/20 active:scale-90 transition-all"
                          aria-label="위로 이동"
                        >▲</button>
                        <button
                          onClick={() => moveBlock(block.id, 'down')}
                          disabled={posIdx === enabledBlocks.length - 1}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black disabled:opacity-20 text-white hover:bg-white/20 active:scale-90 transition-all"
                          aria-label="아래로 이동"
                        >▼</button>
                      </div>

                      <span className="text-2xl">{meta.icon}</span>
                      <div className="flex-1">
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

          {/* 저장 버튼 */}
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
