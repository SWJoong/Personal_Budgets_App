'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-700 transition-colors"
    >
      🖨️ 인쇄 / PDF 저장
    </button>
  )
}
