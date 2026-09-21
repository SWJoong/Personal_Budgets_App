'use client'

/**
 * 인쇄/PDF 저장 버튼 — 브라우저 인쇄 대화상자를 연다(window.print). 인쇄물에는 자기 자신을 숨긴다(print:hidden).
 * 서버 컴포넌트 보고서 페이지에서 쓰는 최소 클라이언트 조각. 설계: docs/release/14 P2(월간 보고서 출력본).
 */
export default function PrintButton({ label = '인쇄 · PDF로 저장' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden min-h-[44px] px-5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary-hover transition-colors"
    >
      🖨️ {label}
    </button>
  )
}
