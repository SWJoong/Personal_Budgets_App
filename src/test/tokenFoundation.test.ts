import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P2 디자인 토큰 토대 — 아키텍처 적합성 계약 (W).
 * 설계: Plan&Source/goala_p2_token_foundation_W.md §7.
 *
 * 규칙: "토큰화 완료"로 지정된 화면 파일에는 raw Tailwind 팔레트 클래스
 *   (예: text-zinc-500 · bg-white · bg-emerald-50 · ring-amber-200)가 없어야 한다.
 *   화면이 시맨틱 토큰(bg-card·text-foreground·bg-success-bg …)만 써야, 테마가
 *   !important 화면오버라이드 없이 토큰 값 교체(html.dark-mode { --color-* })만으로 동작하기 때문.
 *
 * test-first: 현재 앵커(당사자 홈)에 raw 클래스가 있어 이 계약은 RED 다.
 *   U 가 매핑표(설계 §4)대로 토큰 치환 + globals.css 신규 토큰(§3-2) 추가 → green.
 *   Phase 진행에 따라 TOKENIZED_FILES 를 확장한다(P3~).
 */

const ROOT = process.cwd()

// 토큰화 규율이 적용되는(이관 완료 대상) 화면 파일. P2 = 앵커 1개. 이후 Phase 에서 확장.
const TOKENIZED_FILES = [
  // P2 앵커
  'src/app/(participant)/page.tsx',
  // P3 프리미티브(#92) — 토큰 어휘 단일 진실원천, raw 팔레트 금지
  'src/components/ui/Button.tsx',
  'src/components/ui/Card.tsx',
  'src/components/ui/PageHeader.tsx',
  'src/components/ui/StatusPill.tsx',
  'src/components/ui/MoneyText.tsx',
  'src/components/ui/EmptyState.tsx',
  'src/components/ui/LinkButton.tsx',
  'src/components/ui/buttonStyles.ts',
  // P3 Stage B-1(#93) — 고표면 3화면 리트로핏
  'src/app/(supporter)/supporter/budgets/[id]/page.tsx',
  'src/app/(supporter)/supporter/plans/[id]/PlanDetailClient.tsx',
  'src/app/(supporter)/admin/participants/[id]/ParticipantDetailClient.tsx',
  // P3 Stage B-2(#95) — 거래장부 계열 4화면 리트로핏
  'src/app/(supporter)/supporter/transactions/OrgLedgerClient.tsx',
  'src/app/(supporter)/supporter/transactions/[id]/page.tsx',
  'src/app/(supporter)/supporter/[participantId]/transactions/page.tsx',
  'src/app/(supporter)/supporter/participants/[id]/page.tsx',
  // P4 내비 통일(#98) — TabBar/ParticipantFab 토큰화
  'src/components/layout/TabBar.tsx',
  'src/components/layout/ParticipantFab.tsx',
  // ── P6 a11y 리트로핏(#82) — Phase A 대비 토큰화 배치 ──
  // 설계: Plan&Source/goala_p6_a11y_W.md §2(krds §2 매핑)·§3(raw→시맨틱 토큰표).
  //   등재 근거: 저대비 raw(text-zinc-400/500·slate/gray-400 등, 흰 배경 ~2.4~2.85:1 <AA 4.5:1)를
  //   보유한 전역 내비·진입 화면. 등재 즉시 RAW_SCALE/RAW_WHITE 정규식이 RED — U 가 시맨틱 토큰
  //   (text-muted-foreground·ring-border 등, #89 에서 AA 검증)으로 치환하면 green.
  //   focus:ring-zinc-400 은 제거 후 전역 focus-visible 위임(ring-border) 방향.
  //   B/C 웨이브에서 잔여 ~51 파일로 확장한다(과대 RED 방지 — 이번엔 진입·내비 7개).
  'src/components/layout/MoreMenuClient.tsx',
  'src/app/(auth)/login/page.tsx',
  'src/app/onboarding/OnboardingClient.tsx',
  'src/app/(participant)/more/page.tsx',
  'src/app/(participant)/receipt/ReceiptClient.tsx',
  'src/app/(supporter)/admin/settings/page.tsx',
  'src/app/(supporter)/admin/participants/page.tsx',
  // P6 다크-표면 서브웨이브 — AdminSidebar 다크 반전 표면.
  //   라이트 시맨틱 토큰(text-muted-foreground·bg-card)은 다크 위 검은 글씨라 재사용 불가 →
  //   전용 다크-표면 시맨틱 토큰 세트 신설(--color-sidebar-*, 4모드 AA≥4.5:1).
  //   설계: Plan&Source/goala_p6_darktokens_W.md. 현재 raw slate/white/amber → RED.
  'src/components/layout/AdminSidebar.tsx',

  // ── P6 대비 완성 sweep · Batch 1: 로딩 스켈레톤 15개 (~203 raw hits) ──
  //   순수 표현(bg-zinc/animate-pulse 스켈레톤), 행위·데이터·문구 없음 → 색만 토큰화.
  //   매핑: Plan&Source/goala_p6_sweep_W.md (P2/Phase A §4 확립 매핑 재사용,
  //   bg-zinc-100/200→bg-muted·text-zinc→text-muted-foreground 등). animate-pulse 유지.
  'src/app/loading.tsx',
  'src/app/(participant)/loading.tsx',
  'src/app/(participant)/calendar/loading.tsx',
  'src/app/(participant)/evaluations/loading.tsx',
  'src/app/(participant)/gallery/loading.tsx',
  'src/app/(participant)/map/loading.tsx',
  'src/app/(participant)/more/loading.tsx',
  'src/app/(participant)/plan/loading.tsx',
  'src/app/(participant)/receipt/loading.tsx',
  'src/app/(participant)/settings/profile/loading.tsx',
  'src/app/(supporter)/admin/loading.tsx',
  'src/app/(supporter)/admin/participants/loading.tsx',
  'src/app/(supporter)/admin/participants/[id]/loading.tsx',
  'src/app/(supporter)/supporter/review/loading.tsx',
  'src/app/(supporter)/supporter/transactions/[id]/loading.tsx',

  // ── P6 대비 완성 sweep · Batch 2: 공용 컴포넌트 17 (재사용 레버리지 최대) ──
  //   색만 토큰화(매핑=goala_p6_sweep_W.md). ★Phase B/C 겹침 파일(FormField·Modal·ImageLightbox·
  //   SelfCheckFeedback·ComingSoon=B / NavDropdown·NavigationProgress·FaqButton=C)은 ARIA/구조 불가침, 색만.
  //   Modal·ImageLightbox 는 이미 팔레트 raw-0(green-lock 겸 회귀보호).
  'src/components/admin/ParticipantHomePreviewClient.tsx',
  'src/components/admin/PreviewBanner.tsx',
  'src/components/help/AdminHelpButton.tsx',
  'src/components/help/AdminHelpModal.tsx',
  'src/components/help/HelpButton.tsx',
  'src/components/help/HelpSlideshow.tsx',
  'src/components/home/WaterCupPlanPreview.tsx',
  'src/components/layout/NavDropdown.tsx',
  'src/components/layout/NavigationProgress.tsx',
  'src/components/map/KakaoMap.tsx',
  'src/components/map/PlaceSearch.tsx',
  'src/components/ui/ComingSoon.tsx',
  'src/components/ui/FaqButton.tsx',
  'src/components/ui/FormField.tsx',
  'src/components/ui/ImageLightbox.tsx',
  'src/components/ui/Modal.tsx',
  'src/components/ui/SelfCheckFeedback.tsx',
]

// Tailwind 임의 팔레트(시맨틱 토큰으로 대체돼야 함).
const SCALE = '(?:50|100|200|300|400|500|600|700|800|900|950)'
const PALETTES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const PREFIX = 'bg|text|border|ring|from|via|to|divide|outline|fill|stroke|decoration|accent|caret|shadow'
// 예: text-zinc-500 · bg-emerald-50 · ring-amber-200 · border-zinc-100
const RAW_SCALE = new RegExp(`\\b(?:${PREFIX})-(?:${PALETTES})-${SCALE}\\b`, 'g')
// 예: bg-white · text-white · border-white · ring-white (→ bg-card·text-*-foreground 로)
const RAW_WHITE = /\b(?:bg|text|border|ring)-white\b/g

// 블록/JSX 주석 제거 — 주석이 클래스명을 언급해 생기는 오탐 방지.
// (라인 // 주석은 대상 파일 기준 팔레트 미언급이라 보존; 필요 시 후속 확장.)
function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
}

function findForbidden(src: string): string[] {
  const clean = stripBlockComments(src)
  const hits = [...(clean.match(RAW_SCALE) ?? []), ...(clean.match(RAW_WHITE) ?? [])]
  return [...new Set(hits)].sort()
}

describe('P2 토큰 토대 — 토큰화 화면의 raw 팔레트 클래스 금지', () => {
  it('스캐너가 대상 파일을 실제로 읽는다(적합성 테스트가 살아있음)', () => {
    for (const rel of TOKENIZED_FILES) {
      expect(existsSync(join(ROOT, rel)), `${rel} 가 존재해야 함(경로 오타 방지)`).toBe(true)
    }
    expect(TOKENIZED_FILES.length).toBeGreaterThan(0)
  })

  for (const rel of TOKENIZED_FILES) {
    it(`${rel}: raw 팔레트 클래스 0 (시맨틱 토큰만 사용)`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      const forbidden = findForbidden(src)
      expect(
        forbidden,
        `raw 팔레트 클래스 발견 → 시맨틱 토큰으로 치환하라(설계 §4): ${forbidden.join(', ')}`,
      ).toEqual([])
    })
  }
})
