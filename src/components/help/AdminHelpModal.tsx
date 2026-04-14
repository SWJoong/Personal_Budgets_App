'use client'

import type { AdminHelpPage } from '@/data/adminHelpContent'

interface Props {
  page: AdminHelpPage
  onClose: () => void
}

export default function AdminHelpModal({ page, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-black text-zinc-900 text-lg">{page.pageTitle} 도움말</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-xl font-bold transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 항목 목록 */}
        <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto flex-1">
          {page.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <p className="font-bold text-zinc-900 text-sm">{item.title}</p>
                <p className="text-sm text-zinc-500 leading-relaxed mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}

          {/* 저장 용량 안내 (settings 전용) */}
          {page.storageNote && (
            <div className="mt-2 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
              <span className="text-xl shrink-0">💡</span>
              <p className="text-xs text-blue-700 leading-relaxed">
                용량이 부족해지면 Supabase 대시보드에서 유료 플랜(Pro, $25/월부터)으로 업그레이드할 수 있습니다.
                업그레이드 없이 용량 절약을 원한다면 오래된 영수증 이미지를 주기적으로 정리하세요.
              </p>
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        <div className="px-6 py-4 border-t border-zinc-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-700 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
