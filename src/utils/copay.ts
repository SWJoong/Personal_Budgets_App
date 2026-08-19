/**
 * 본인부담금 표시 — 3차(2026) 시범사업에 신설된 제도.
 *
 * 모집 안내문: "기초생활수급자·차상위계층 본인부담금 없음(0원) /
 *              그 외 참여자 지원액의 10%(최대 24만 원)"
 *
 * 금액만으로는 "0원"이 면제인지 제도가 없는 차수인지 구분되지 않아
 * seoul_budget_allocations.copay_status 를 함께 읽는다.
 *
 * ★ 당사자에게 이 금액을 보여주는 이유: 안 보여주면 승인 시점에는 아무 말이 없다가
 *   정산 때 24만원을 청구받게 된다. 발달장애인에게 예고 없는 청구는 그 자체로 해롭다.
 */
export type CopayStatus =
  | 'not_applicable'
  | 'exempt_basic_livelihood'
  | 'exempt_near_poor'
  | 'charged'
  | 'unverified'

export interface CopayDisplay {
  /** 화면에 이 영역을 그릴지 — 제도가 없는 차수면 아예 숨긴다 */
  show: boolean
  amount: number
  /** 쉬운 말 제목 */
  title: string
  /** 쉬운 말 설명 한 줄 */
  note: string
  /** 아직 확정되지 않았음을 시각적으로 구분해야 하는가 */
  pending: boolean
}

export function describeCopay(status: string | null | undefined, amount: number): CopayDisplay {
  switch (status) {
    case 'exempt_basic_livelihood':
    case 'exempt_near_poor':
      return {
        show: true,
        amount: 0,
        title: '내가 낼 돈은 없어요',
        note: '지금은 돈을 안 내도 되는 대상이에요.',
        pending: false,
      }
    case 'charged':
      return {
        show: true,
        amount,
        title: '내가 낼 돈',
        note: '이 돈은 나중에 따로 내요. 위에 있는 쓸 수 있는 돈에서 빠지지 않아요.',
        pending: false,
      }
    case 'unverified':
      return {
        show: true,
        amount,
        title: '내가 낼 돈 (확인 중)',
        note: '아직 확인하는 중이에요. 확인이 끝나면 안 내도 될 수 있어요.',
        pending: true,
      }
    // 'not_applicable' 과 알 수 없는 값은 모두 숨긴다 — 없는 제도를 설명하면 혼란만 준다.
    default:
      return { show: false, amount: 0, title: '', note: '', pending: false }
  }
}

/** 실무자 화면용 짧은 라벨 — 당사자용 쉬운 말과 목적이 다르다 */
export function copayStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'exempt_basic_livelihood': return '면제 (기초생활수급)'
    case 'exempt_near_poor':        return '면제 (차상위)'
    case 'charged':                 return '부과'
    case 'unverified':              return '수급 구분 미확인'
    case 'not_applicable':          return '해당 없음 (부담금 제도 없는 차수)'
    default:                        return '알 수 없음'
  }
}
