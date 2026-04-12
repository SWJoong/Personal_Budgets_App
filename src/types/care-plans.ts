export type CarePlanType = 'mohw_plan' | 'seoul_plan'

// ────────────────────────────────────────────────────────────────────────────
// 보건복지부형 이용계획서 (2~5절, 개인정보 제외)
// ────────────────────────────────────────────────────────────────────────────
export interface MohwServicePlanRow {
  category: string      // 대분류
  service_name: string  // 서비스 내용
  frequency: string     // 횟수/기간
  budget: number | null // 할당 예산 (원)
}

export interface MohwNeedsEntry {
  limitations: string  // 제한점
  wishes: string       // 욕구와 희망
}

export interface MohwPlanContent {
  // 2절: 현재 이용서비스 현황
  activity_support_used: boolean
  activity_support_details: string
  day_activity_used: boolean
  day_activity_details: string
  other_services: string

  // 3절: 현재 일상생활
  daily_routine: string       // 하루를 보내는 방식
  important_people: string    // 가장 중요한 사람
  life_goals: string          // 가장 원하는 것
  daily_difficulties: string  // 불편한 점
  needed_support: string      // 필요한 지원

  // 4절: 개인예산 지원영역 욕구사정 (7개 대분류)
  needs: Record<string, MohwNeedsEntry>

  // 5절: 개인예산 이용계획
  plan_goal: string
  service_plan: MohwServicePlanRow[]
}

// ────────────────────────────────────────────────────────────────────────────
// 서울형 이용계획서 (개인예산 이용계획 + 복지부 참여여부, 개인정보 제외)
// ────────────────────────────────────────────────────────────────────────────
export interface SeoulPlanContent {
  mohw_participation: 'yes' | 'no' | ''  // 보건복지부 시범사업 참여여부

  // 나의 상황
  strengths: string        // 나의 재능, 강점, 기술
  difficulties: string     // 장애로 인한 어려움
  desired_change: string   // 원하는 변화와 지원
  desired_life: string     // 원하는 삶의 모습
  trial_goals: string      // 시도하고 싶은 것 (1~2년 목표)

  // 지원받고 싶은 서비스
  desired_services: [string, string, string]
}

export type CarePlanContent = MohwPlanContent | SeoulPlanContent

// ────────────────────────────────────────────────────────────────────────────
// 메타데이터
// ────────────────────────────────────────────────────────────────────────────
export const CARE_PLAN_LABELS: Record<CarePlanType, string> = {
  mohw_plan: '보건복지부형 이용계획서',
  seoul_plan: '서울형 이용계획서',
}

export const CARE_PLAN_DESCRIPTIONS: Record<CarePlanType, string> = {
  mohw_plan: '현재 이용서비스·일상생활·욕구사정·이용계획 (2~5절)',
  seoul_plan: '나의 상황·지원받고 싶은 서비스·복지부 참여여부',
}

export const MOHW_NEEDS_CATEGORIES: { key: string; label: string }[] = [
  { key: 'physical_health', label: '신체적 건강' },
  { key: 'mental_health',   label: '정신적 건강' },
  { key: 'housing',         label: '주거' },
  { key: 'daily_life',      label: '일상생활' },
  { key: 'employment',      label: '일자리' },
  { key: 'rights',          label: '법률 및 권익보장' },
  { key: 'culture',         label: '문화 및 여가(사회참여)' },
]

// 빈 MohwPlanContent 초기값
export function emptyMohwPlanContent(): MohwPlanContent {
  const emptyNeeds: Record<string, MohwNeedsEntry> = {}
  for (const cat of MOHW_NEEDS_CATEGORIES) {
    emptyNeeds[cat.key] = { limitations: '', wishes: '' }
  }
  return {
    activity_support_used: false,
    activity_support_details: '',
    day_activity_used: false,
    day_activity_details: '',
    other_services: '',
    daily_routine: '',
    important_people: '',
    life_goals: '',
    daily_difficulties: '',
    needed_support: '',
    needs: emptyNeeds,
    plan_goal: '',
    service_plan: [],
  }
}

// 빈 SeoulPlanContent 초기값
export function emptySeoulPlanContent(): SeoulPlanContent {
  return {
    mohw_participation: '',
    strengths: '',
    difficulties: '',
    desired_change: '',
    desired_life: '',
    trial_goals: '',
    desired_services: ['', '', ''],
  }
}
