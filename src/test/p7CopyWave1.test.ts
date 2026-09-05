import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P7 웨이브1 — 당사자 대면 문구 신뢰·쉬운말(easy-read) 교정 계약 (W).
 * 설계: Plan&Source/goala_p7_copy_W.md (문구 매핑표 · forbid 규칙 · easyread 검증결과).
 *
 * 감사 evidence 7개 항목(B1·B2·B4·B7·B8·B9·B11), 총 15개 문자열.
 * 각 후보는 mcp__easyread__validate_easy_read 로 실측해 SEN/VOC/STR 경고 0 으로 수렴.
 *
 * 규칙(golden):
 *   1) 각 대상 파일에 "새 문구" 문자열이 존재해야 한다(존재/렌더 단언의 소스 스냅샷).
 *   2) 각 대상 파일에 "옛 한자어/AI/거짓 라벨" 리터럴이 없어야 한다(forbidRules).
 *   3) 참여자(=당사자) 대면 파일 전반에 금칙 리터럴('심의'·'환수'·'불이익'·'AI'…)이
 *      번지지 않았는지 교차 확인한다.
 *
 * test-first: 현재 소스는 옛 문구라 이 계약은 RED 다.
 *   U(app-6c)가 wordings.file 대로 소스 문자열 교체 → green.
 *   src 구현(소스 문구) 변경은 U 레인. W 는 이 계약과 설계문만 저작한다.
 */

const ROOT = process.cwd()

const FILES = {
  moreMenu: 'src/components/layout/MoreMenuClient.tsx',
  receipt: 'src/app/(participant)/receipt/ReceiptClient.tsx',
  myPlan: 'src/app/(participant)/my-plan/MyPlanClient.tsx',
  evaluations: 'src/app/(participant)/evaluations/page.tsx',
  guide: 'src/app/(participant)/guide/page.tsx',
  home: 'src/app/(participant)/page.tsx',
} as const

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8')
}

// 참여자 문구의 'AI' 리터럴만 잡는다(식별자 DOMAIN_ICON·MAIN 등의 "AI" 부분문자열은
// 앞뒤가 ASCII 글자라 제외). copy 에서 쓰인 'AI가'·'AI ' 등은 앞뒤가 따옴표/공백/한글이라 매칭.
const PARTICIPANT_AI_LITERAL = /(?<![A-Za-z_])AI(?![A-Za-z_])/

// 소스 문자열 리터럴로 실제 코드에 존재하는지 확인(따옴표 포함 매칭으로
// 주석·설명문 오탐을 줄인다).
function hasStringLiteral(src: string, literal: string): boolean {
  return (
    src.includes(`'${literal}'`) ||
    src.includes(`"${literal}"`) ||
    src.includes(`>${literal}<`) ||
    src.includes(`{${literal}}`) ||
    // JSX 텍스트 노드(줄바꿈·공백 포함 가능)로 렌더되는 경우
    src.includes(literal)
  )
}

describe('P7 웨이브1 — 당사자 대면 문구 신뢰·쉬운말 골든 계약', () => {
  // ── B1: my-plan 은 열람 전용(작성 불가)이라 '작성' 라벨은 사실오류 + '심의' 한자어 ──
  describe('B1 · MoreMenu 내 이용계획 부제', () => {
    const src = read(FILES.moreMenu)

    it('새 문구 "계획과 결과를 봐요" 가 존재한다', () => {
      expect(hasStringLiteral(src, '계획과 결과를 봐요')).toBe(true)
    })

    it('거짓 라벨(열람전용 화면인데 "작성")이 부제에 없다', () => {
      // 옛 부제 전체가 사라졌는지 + '작성' 리터럴이 없는지
      expect(src.includes('이용계획 작성하고 심의 결과 보기')).toBe(false)
      expect(src.includes('작성')).toBe(false)
    })

    it("한자 행정어 '심의' 리터럴이 없다", () => {
      expect(src.includes('심의')).toBe(false)
    })

    it('my-plan 화면이 열람 전용 정합을 유지한다(작성/저장/제출 버튼 부재)', () => {
      const plan = read(FILES.myPlan)
      // 열람 전용 원칙: 계획을 저장/제출하는 당사자 조작 버튼이 없어야 한다.
      expect(plan.includes('열람 전용')).toBe(true)
      expect(/<button[^>]*>\s*저장/.test(plan)).toBe(false)
      expect(/<button[^>]*>\s*제출/.test(plan)).toBe(false)
    })
  })

  // ── B2: SETTLEMENT_LABEL 4종 행정 한자어 → 비위협 쉬운말 ──
  describe('B2 · ReceiptClient SETTLEMENT_LABEL', () => {
    const src = read(FILES.receipt)

    it('pending = "선생님이 살펴봐요"', () => {
      expect(hasStringLiteral(src, '선생님이 살펴봐요')).toBe(true)
    })
    it('accepted = "괜찮아요"', () => {
      expect(hasStringLiteral(src, '괜찮아요')).toBe(true)
    })
    it('rejected = "다시 봐야 해요"', () => {
      expect(hasStringLiteral(src, '다시 봐야 해요')).toBe(true)
    })
    it('recovered = "선생님과 이야기해요"', () => {
      expect(hasStringLiteral(src, '선생님과 이야기해요')).toBe(true)
    })

    it('옛 한자 상태어(확인 중/인정됨/반려됨/환수됨)가 없다', () => {
      expect(src.includes("'확인 중'")).toBe(false)
      expect(src.includes('인정됨')).toBe(false)
      expect(src.includes('반려됨')).toBe(false)
      expect(src.includes('환수됨')).toBe(false)
    })
    it("금칙어 '환수' 리터럴이 없다", () => {
      expect(src.includes('환수')).toBe(false)
    })
  })

  // ── B8: 이의신청 안심 문구 '불이익' → 비위협 ──
  describe('B8 · MyPlan 이의신청 안심 문구', () => {
    const src = read(FILES.myPlan)

    it('새 문구 "요청해도 나쁜 일은 생기지 않아요." 가 존재한다', () => {
      expect(src.includes('요청해도 나쁜 일은 생기지 않아요.')).toBe(true)
    })
    it('옛 문구 "요청한다고 불이익이 생기지 않아요."(당사자 노출)가 없다', () => {
      expect(src.includes('요청한다고 불이익이 생기지 않아요.')).toBe(false)
    })
  })

  // ── B9: STATUS_LABEL 심의상태 한자어 완화 ──
  describe('B9 · MyPlan STATUS_LABEL 배너 문구', () => {
    const src = read(FILES.myPlan)

    it('submitted = "선생님들이 계획을 냈어요. 곧 살펴볼 거예요."', () => {
      expect(src.includes('선생님들이 계획을 냈어요. 곧 살펴볼 거예요.')).toBe(true)
    })
    it('approved = "계획대로 해도 좋대요"', () => {
      expect(src.includes('계획대로 해도 좋대요')).toBe(true)
    })
    it('conditional = "조금 바꾸면 계획대로 할 수 있어요"', () => {
      expect(src.includes('조금 바꾸면 계획대로 할 수 있어요')).toBe(true)
    })
    it('rejected = "이번에는 어렵대요"', () => {
      expect(src.includes('이번에는 어렵대요')).toBe(true)
    })

    it('옛 한자 상태어(제출 완료/승인됐어요/조건부/반려됐어요)가 없다', () => {
      expect(src.includes('제출 완료')).toBe(false)
      expect(src.includes('승인됐어요')).toBe(false)
      expect(src.includes('조건부')).toBe(false)
      expect(src.includes('반려됐어요')).toBe(false)
    })
  })

  // ── B7: evaluations 뒤로가기 aria-label 을 실제 목적지(/more)와 일치 ──
  describe('B7 · evaluations 뒤로가기 aria-label', () => {
    const src = read(FILES.evaluations)

    it('href="/more" 인 링크의 라벨은 "더보기로 가기"', () => {
      expect(src.includes('더보기로 가기')).toBe(true)
    })
    it('부정확한 "뒤로 가기"/"홈으로 가기" 라벨이 없다', () => {
      expect(src.includes('aria-label="뒤로 가기"')).toBe(false)
      expect(src.includes('aria-label="홈으로 가기"')).toBe(false)
    })
    it('목적지가 여전히 /more 임을 보존한다', () => {
      expect(src.includes('href="/more"')).toBe(true)
    })
  })

  // ── B4: 참여자 문구 'AI' 리터럴 금지 → '컴퓨터가' ──
  describe('B4 · guide 활동 안내 AI 리터럴 제거', () => {
    const src = read(FILES.guide)

    it('영수증 OCR 문구 = "컴퓨터가 금액과 날짜를 자동으로 읽어줘요."', () => {
      expect(src.includes('컴퓨터가 금액과 날짜를 자동으로 읽어줘요.')).toBe(true)
    })
    it('활동제안 문구 = "컴퓨터가 남은 돈으로 할 수 있는 재미있는 활동을 알려줘요."', () => {
      expect(
        src.includes('컴퓨터가 남은 돈으로 할 수 있는 재미있는 활동을 알려줘요.'),
      ).toBe(true)
    })
    it("참여자 문구에 'AI' 리터럴이 없다", () => {
      expect(PARTICIPANT_AI_LITERAL.test(src)).toBe(false)
    })
  })

  // ── B11: 홈 domain_breakdown 제목을 설정 라벨과 통일 ──
  describe('B11 · 홈 영역별 보기 제목 통일', () => {
    const src = read(FILES.home)

    it('제목(텍스트 노드) = 설정 라벨과 동일한 "어디에 썼는지"', () => {
      // 부제 "어디에 썼는지 봐요." 와 구분하기 위해 정확한 텍스트 노드로 단언한다.
      // (현재 제목은 "영역별로 보기" 라 이 단언은 RED 다.)
      expect(src.includes('>어디에 썼는지<')).toBe(true)
    })
    it('부제 = "무엇에 얼마나 썼는지 봐요."', () => {
      expect(src.includes('무엇에 얼마나 썼는지 봐요.')).toBe(true)
    })
    it('옛 추상 제목 "영역별로 보기"가 없다', () => {
      expect(src.includes('영역별로 보기')).toBe(false)
    })
    it('설정 정본 라벨(uiPreferences)이 easy-read 값을 유지한다', () => {
      const ui = read('src/utils/uiPreferences.ts')
      expect(ui.includes('어디에 썼는지')).toBe(true)
    })
  })

  // ── 교차 금칙(forbidRules): 당사자 대면 파일 전반 ──
  describe('forbidRules · 당사자 대면 파일 금칙 리터럴 교차확인', () => {
    const participantFacing = [FILES.moreMenu, FILES.receipt, FILES.myPlan, FILES.evaluations, FILES.guide, FILES.home]

    it.each(participantFacing)('%s 에 "심의"·"환수"·"불이익" 금칙어가 없다', (rel) => {
      const src = read(rel)
      expect(src.includes('심의')).toBe(false)
      expect(src.includes('환수')).toBe(false)
      // '불이익'은 설명 주석(L128)에도 남을 수 있으나, 당사자 노출 문구 정본은
      // '나쁜 일'로 대체한다. 주석 포함 금지로 강하게 못 박아 재발 방지.
      expect(src.includes('불이익')).toBe(false)
    })

    it.each([FILES.guide, FILES.receipt, FILES.home, FILES.moreMenu])(
      "%s 에 참여자 노출 'AI' 리터럴이 없다",
      (rel) => {
        const src = read(rel)
        expect(PARTICIPANT_AI_LITERAL.test(src)).toBe(false)
      },
    )
  })
})
