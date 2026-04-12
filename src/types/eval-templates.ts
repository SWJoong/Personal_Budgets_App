export type EvalTemplateId = 'pcp' | 'seoul' | 'mohw' | 'custom'

export interface EvalField {
  id: string
  label: string
  placeholder: string
  rows: number
}

export interface EvalTemplate {
  id: EvalTemplateId
  name: string
  badge: string
  description: string
  fields: EvalField[]
  /** AI easy_summary 생성 시 사용할 컨텍스트 힌트 */
  aiPrompt: string
}

export interface OrgEvalSetting {
  active: EvalTemplateId
  /** custom 선택 시 관리자가 정의한 필드 목록 */
  custom_fields?: EvalField[]
}

export const EVAL_TEMPLATES: Record<Exclude<EvalTemplateId, 'custom'>, EvalTemplate> = {
  pcp: {
    id: 'pcp',
    name: 'PCP 4+1',
    badge: '기본',
    description: '개인중심계획(Person-Centered Planning) 표준 양식. 시도·배움·만족·고민·다음 계획 5개 항목으로 구성됩니다.',
    fields: [
      { id: 'tried',     label: '1. 시도한 것 (What have we tried?)',       placeholder: '이번 달에 새롭게 시도한 활동이나 방법은 무엇인가요?',         rows: 4 },
      { id: 'learned',   label: '2. 배운 것 (What have we learned?)',        placeholder: '시도한 활동을 통해 당사자나 지원자가 알게 된 사실은 무엇인가요?', rows: 4 },
      { id: 'pleased',   label: '3. 만족하는 것 (What are we pleased about?)',placeholder: '잘 진행되었거나 당사자가 즐거워했던 부분은 무엇인가요?',         rows: 4 },
      { id: 'concerned', label: '4. 고민되는 것 (What are we concerned about?)',placeholder: '어려움이 있었거나 개선이 필요한 부분은 무엇인가요?',           rows: 4 },
      { id: 'next_step', label: '+1. 향후 계획 (What are we going to do next?)',placeholder: '다음 달에는 어떤 점을 다르게 하거나 새로 시도해볼까요?',      rows: 4 },
    ],
    aiPrompt: 'PCP(개인중심계획) 4+1 평가를 바탕으로 당사자의 성장과 경험을 쉬운 말로 요약해주세요.',
  },

  seoul: {
    id: 'seoul',
    name: '서울시형',
    badge: '서울시',
    description: '서울시 발달장애인 개인예산 지원사업 평가 양식. 활동 내용·목표 달성·당사자·지원자 의견·다음 계획 5개 항목으로 구성됩니다.',
    fields: [
      { id: 'activity_summary',    label: '1. 이번 달 주요 활동 내용',   placeholder: '이번 달에 진행한 주요 활동과 서비스 이용 내용을 작성해주세요.', rows: 4 },
      { id: 'goal_achievement',    label: '2. 목표 달성 여부 및 내용',   placeholder: '이번 달 설정한 목표의 달성 여부와 구체적인 내용을 기술해주세요.', rows: 4 },
      { id: 'participant_opinion', label: '3. 당사자 의견 및 소감',      placeholder: '당사자가 직접 이번 달 활동에 대해 느낀 점이나 의견을 기록해주세요.', rows: 4 },
      { id: 'supporter_opinion',   label: '4. 지원자 관찰 소견',         placeholder: '지원자가 관찰한 당사자의 변화, 어려움, 지원 방향 등을 작성해주세요.', rows: 4 },
      { id: 'next_plan',           label: '5. 다음 달 지원 계획',        placeholder: '다음 달에 계획하고 있는 활동과 지원 방향을 작성해주세요.',       rows: 4 },
    ],
    aiPrompt: '서울시 개인예산 지원사업 평가 내용을 바탕으로 당사자의 이번 달 활동과 성장을 쉬운 말로 요약해주세요.',
  },

  mohw: {
    id: 'mohw',
    name: '보건복지부형',
    badge: '복지부',
    description: '보건복지부 발달장애인 개인예산제 시범사업 평가 양식. 활동 요약·예산 사용·자기결정·지원 필요·다음 계획 5개 항목으로 구성됩니다.',
    fields: [
      { id: 'monthly_summary',    label: '1. 이번 달 활동 종합 요약',      placeholder: '이번 달 진행된 주요 활동 및 서비스 이용 현황을 종합적으로 요약해주세요.', rows: 4 },
      { id: 'budget_usage',       label: '2. 예산 사용 현황 및 적절성',    placeholder: '개인예산 사용 내역과 사용의 적절성 및 효과성을 평가해주세요.',           rows: 4 },
      { id: 'self_determination', label: '3. 자기결정 실천 사례',          placeholder: '당사자가 스스로 선택하고 결정한 활동이나 경험을 구체적으로 기록해주세요.', rows: 4 },
      { id: 'support_needs',      label: '4. 추가 지원 필요 사항',         placeholder: '현재 지원이 부족하거나 추가적으로 필요한 서비스나 자원이 있다면 작성해주세요.', rows: 4 },
      { id: 'next_month_plan',    label: '5. 다음 달 계획 및 목표',        placeholder: '다음 달에 달성하고자 하는 목표와 계획하고 있는 활동을 작성해주세요.',    rows: 4 },
    ],
    aiPrompt: '보건복지부 개인예산제 평가 내용을 바탕으로 당사자의 자기결정 실천과 이번 달 성과를 쉬운 말로 요약해주세요.',
  },
}

/** custom 템플릿의 기본 필드 (관리자가 수정 가능) */
export const DEFAULT_CUSTOM_FIELDS: EvalField[] = [
  { id: 'field_1', label: '항목 1', placeholder: '내용을 입력해주세요.', rows: 4 },
  { id: 'field_2', label: '항목 2', placeholder: '내용을 입력해주세요.', rows: 4 },
  { id: 'field_3', label: '다음 달 계획', placeholder: '다음 달 계획을 작성해주세요.', rows: 4 },
]

export const DEFAULT_ORG_EVAL_SETTING: OrgEvalSetting = {
  active: 'pcp',
}

/** 현재 설정에서 실제 사용할 필드 목록 반환 */
export function resolveTemplateFields(setting: OrgEvalSetting): EvalField[] {
  if (setting.active === 'custom') {
    return setting.custom_fields?.length ? setting.custom_fields : DEFAULT_CUSTOM_FIELDS
  }
  return EVAL_TEMPLATES[setting.active].fields
}

/** 현재 설정에서 AI 프롬프트 힌트 반환 */
export function resolveAiPrompt(setting: OrgEvalSetting): string {
  if (setting.active === 'custom') {
    return '작성된 평가 내용을 바탕으로 당사자의 이번 달 활동과 성과를 쉬운 말로 요약해주세요.'
  }
  return EVAL_TEMPLATES[setting.active].aiPrompt
}
