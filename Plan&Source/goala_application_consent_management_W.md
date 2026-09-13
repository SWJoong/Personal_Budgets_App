# 신청서 동의 관리 — 설계권위 (W)

> 고아/부분유실 액션 배선 — 신청서(application) 흐름의 동의·수급현황.
> `recordConsent` 는 이미 배선(체크박스+저장)돼 있고, **철회·수급현황·이력조회 3종이 미배선**이다.
> DB 변경 없음. 액션(`src/app/actions/application.ts`) **무변경**. 대상: `ApplicationDetailClient` + 그 `page.tsx`.

## §0 현재 상태(정밀)
- `recordConsent` — 배선됨(`ApplicationDetailClient` 체크박스 general/unique_id + '동의 내용 저장').
- `withdrawConsent(consentId)` — **미배선**. 개인정보보호법 철회권(`withdrawn_at` 스탬프, `is_agreed`는 보존). 현재 화면엔 철회 UI 가 없다(체크 해제=is_agreed만, 철회 아님) → **실제 공백**.
- `getBenefitStatus(participantId)` — **미배선**. 페이지는 `participates_in_mohw_pilot` 한 필드만 로드(복지부 경고용). 수급현황(공공부조·활동지원·서울형추가) 표시 없음.
- `getConsentRecords(applicationId)` — **미배선**(페이지가 `seoul_consent_records` 인라인 쿼리). 데이터는 이미 로드됨 → 배선은 액션 소비처 부여(저churn 리팩터).

## §1 동의 철회 — `withdrawConsent` 배선 (핵심)
- `ApplicationDetailClient` 기존 '동의 확인'(체크박스+저장) **그대로 유지**(recordConsent 흐름·동작 불변).
- 그 아래 **신규 '동의 이력' 섹션** 추가 — `initialConsents`(id·consent_type·is_agreed·withdrawn_at 이미 전달됨) 렌더:
  - 비었으면 "아직 기록된 동의가 없어요."
  - 각 레코드: `CONSENT_LABEL[type]` + 상태 —
    `withdrawn_at` 있으면 `철회됨 · {withdrawn_at.slice(0,10)}`(muted), 없으면 `is_agreed?'동의함':'동의 안 함'`.
  - `is_agreed && !withdrawn_at` 인 레코드에만 **철회 컨트롤**: 버튼(표시문구 "동의 철회",
    `aria-label={`${CONSENT_LABEL[type]} 철회`}`) → 그 행이 **인라인 확인**으로 전환(한 번에 한 건, `withdrawingId`):
    `<p role="alert">이 동의를 철회할까요?</p>` + 안내 "개인정보보호법에 따른 철회권이에요. 철회해도 이미 처리된
    내용은 남아요." + [그대로 두기][철회하기]. "철회하기" → `withdrawConsent(record.id)`(useTransition):
    성공 → announce('…철회했어요.','polite') · router.refresh() · 확인닫기 / 실패 → setError · 확인닫기.
    "그대로 두기" → 확인닫기(미호출).
- `CONSENT_LABEL` = 기존 재사용(general '개인정보 수집·이용 동의', unique_id '고유식별정보(주민등록번호 등) 처리 동의').

## §2 수급현황 표시 — `getBenefitStatus` 배선
- 신규 **'수급현황' 섹션**(읽기전용, staff 참고). props 신규 `initialBenefitStatus?`(선택·기본 null):
  `{ public_assistance: string|null; uses_activity_support: boolean; uses_seoul_additional_support: boolean; participates_in_mohw_pilot: boolean } | null`.
  ★기존 계약(`ApplicationDetailClient.test.tsx`)은 이 prop 을 안 넘김 → **반드시 optional·기본 null**(회귀 방지).
- null 이면 "아직 입력된 수급현황이 없어요.". 있으면 행 목록(각 행 = 라벨 + 값, within 스코프 가능한 단순 `<div>` 행):
  - 공공부조 수급현황 → `PA_LABEL`: `''|null`→'아직 확인 못함' · `basic_livelihood`→'기초생활수급' · `near_poor`→'차상위(조건부수급)' · `none`→'해당없음'.
  - 장애인 활동지원서비스 → `uses_activity_support ? '이용 중' : '이용 안 함'`.
  - 서울형 추가지원 → `uses_seoul_additional_support ? '이용 중' : '이용 안 함'`.
  - 보건복지부 시범사업 → `participates_in_mohw_pilot ? '참여 중' : '참여 안 함'`.

## §3 페이지 배선 (`applications/[id]/page.tsx`) — 고아 액션 소비처
- consent: 인라인 `supabase.from('seoul_consent_records')...` → `getConsentRecords(id)` 의 `consents` 로 교체.
- benefit: 인라인 `seoul_benefit_status.select('participates_in_mohw_pilot')` → `getBenefitStatus(application.participant_id)`
  의 `benefitStatus` 로 교체. `participatesInMohwPilot={benefitStatus?.participates_in_mohw_pilot ?? false}`(기존 경고 유지) +
  `initialBenefitStatus={benefitStatus ?? null}` 전달. participant/cohort/decision 은 인라인 유지.

## 계약 (신규 파일)
`src/app/(supporter)/supporter/applications/[id]/ApplicationDetailClient.consent.test.tsx` — 철회 확인 흐름·이미철회 버튼없음·수급현황 표시/빈상태. 기존 `ApplicationDetailClient.test.tsx`(선정 선행조건)는 **무수정·계속 green**.

## 접근성·게이트
44px·focus-visible·시맨틱 토큰·`hover:*-hover`(P7)·확인문구 role=alert·철회버튼 aria-label. 신규 상호작용은 `window.confirm` 금지(인라인 확인).
tsc0·lint0·vitest(신규 계약 + 회귀0, 기존 ApplicationDetailClient.test 포함)·build0. 액션 무변경. 앱 전용.
