'use client'

import { useEffect, useState } from 'react'
import { UIPreferences, OPTIONAL_BLOCKS, BLOCK_METADATA, REQUIRED_BLOCKS, BlockId } from '@/types/ui-preferences'

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
  const [localEnabled, setLocalEnabled] = useState<Set<BlockId>>(
    new Set(currentPreferences.enabled_blocks)
  )

  // 시트가 열릴 때마다 현재 설정으로 초기화
  useEffect(() => {
    if (isOpen) {
      setLocalEnabled(new Set(currentPreferences.enabled_blocks))
    }
  }, [isOpen, currentPreferences])

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  function toggleBlock(blockId: BlockId) {
    setLocalEnabled(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) {
        next.delete(blockId)
      } else {
        next.add(blockId)
      }
      return next
    })
  }

  function handleSave() {
    onSave({ enabled_blocks: OPTIONAL_BLOCKS.filter(b => localEnabled.has(b)) })
  }

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
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
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

        <div className="px-6 pb-8 pt-3 max-h-[70vh] overflow-y-auto">
          <h2 className="text-lg font-black text-zinc-900 mb-1">화면 구성 편집</h2>
          <p className="text-sm text-zinc-400 mb-6">보고 싶은 정보를 선택하세요</p>

          {/* 필수 블록 (고정) */}
          <div className="mb-4">
            <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">항상 표시</p>
            <div className="flex flex-col gap-2">
              {REQUIRED_BLOCKS.map(blockId => (
                <div key={blockId} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 ring-1 ring-zinc-100">
                  <span className="text-2xl">
                    {blockId === 'balance_widget' ? '💰' : '📸'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-zinc-500">
                      {blockId === 'balance_widget' ? '잔액 위젯' : '영수증 버튼'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {blockId === 'balance_widget' ? '현재 예산 잔액 시각화' : '영수증 사진 찍기'}
                    </p>
                  </div>
                  <div className="w-5 h-5 flex items-center justify-center text-zinc-300">
                    🔒
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 선택 블록 */}
          <div>
            <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em] mb-3">선택 표시</p>
            <div className="flex flex-col gap-2">
              {OPTIONAL_BLOCKS.map(blockId => {
                const meta = BLOCK_METADATA[blockId]
                const isEnabled = localEnabled.has(blockId)
                return (
                  <button
                    key={blockId}
                    onClick={() => toggleBlock(blockId)}
                    className={`flex items-center gap-4 p-4 rounded-2xl ring-1 text-left transition-all active:scale-[0.98] ${
                      isEnabled
                        ? 'bg-zinc-900 ring-zinc-800'
                        : 'bg-white ring-zinc-100 hover:ring-zinc-200'
                    }`}
                  >
                    <span className="text-2xl">{meta.icon}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${isEnabled ? 'text-white' : 'text-zinc-700'}`}>
                        {meta.label}
                      </p>
                      <p className={`text-xs ${isEnabled ? 'text-zinc-400' : 'text-zinc-400'}`}>
                        {meta.description}
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isEnabled
                        ? 'border-white bg-white'
                        : 'border-zinc-200 bg-white'
                    }`}>
                      {isEnabled && (
                        <div className="w-3 h-3 rounded-full bg-zinc-900" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

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
