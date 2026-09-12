# 욕구사정·이용계획 수정 — 설계권위 (W)

> 고아 액션 백로그(부분유실) — updateNeedsAssessment·updateUtilizationPlan(둘 다 완성·호출처 0).
> 생성/삭제(사정)·생성/제출(계획)만 있고 **수정이 없던** 것을 배선. 앱 전용·DB 변경 없음. 액션 무변경.

## §1 욕구사정 수정 (AssessmentClient 인라인 편집)
- 배경: `AssessmentClient` 는 create/delete 만 호출. 각 항목에 수정을 더한다. 계약: `AssessmentClient.edit.test.tsx`.
- 구현: 목록의 각 항목(기존 '지우기' 옆)에 **'수정'** 버튼 → 그 항목이 **인라인 편집 폼**으로 전환
  (도움영역 select + 어려운 점/바라는 것/도움이 될 것 — **현재 값 프리필**, 생성 폼 필드 미러).
  '저장'(생성의 '욕구 추가하기'와 구분되는 명칭, 예 "저장") → `updateNeedsAssessment(id, { domainId,
  subdomainId, limitation, needHope, supportExample })` → 성공 시 편집 닫고 router.refresh(). '취소' → 편집만 닫음.
  한 번에 한 항목만 편집(editingId 상태). 44px·focus-visible·쉬운 말. 기존 생성/삭제 회귀 유지.

## §2 이용계획 메타 수정 (신규 PlanMetaEditor + plans/[id] 배선)
- 배경: 계획 메타(작성 방식 authored_with_support·조력자 assisted_by_id·계획 기간 plan_period_start/end)는
  생성(new)에만 있고 상세에서 수정 불가. 계약: `PlanMetaEditor.test.tsx`.
- 신규 `src/app/(supporter)/supporter/plans/[id]/PlanMetaEditor.tsx` ('use client'):
  props `{ planId, authoredWithSupport, assistedById, planPeriodStart, planPeriodEnd, supporters }`.
  편집 필드: 계획 시작일/종료일(date, label "계획 시작일"/"계획 종료일"), 작성 방식(select — NewPlanClient
  의 authored_with_support 값·라벨 재사용), 조력자(select supporters + "없음"). **현재 값 프리필.**
  '저장' → `updateUtilizationPlan(planId, { authoredWithSupport, assistedById: 값||null, planPeriodStart,
  planPeriodEnd })` → 성공 router.refresh(). date 는 빈값이면 그대로(액션이 ''→null 처리).
- 배선: `plans/[id]/page.tsx` 가 plan.authored_with_support·assisted_by_id·plan_period_start/end + supporters
  (profiles role='supporter') 를 로드해 `PlanDetailClient` 통해(또는 페이지에서 직접) `PlanMetaEditor` 렌더.
  위치는 계획 상세 안 '계획 정보' 섹션. (제출/승인 상태에서도 액션은 staff+RLS 로만 판정 — 상태 게이팅은
  하지 않되, 섹션 제목으로 '계획 정보 수정'임을 명확히.)

## 게이트
tsc0·lint0·vitest(AssessmentClient.edit·PlanMetaEditor 계약 + 회귀0)·build0. 액션(needsAssessment·utilizationPlan) 무변경. 앱 전용.
