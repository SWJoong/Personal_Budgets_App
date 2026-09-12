# 실무자용 AI 점검 제안 (Staff Review Assistant) — 설계권위 (W)

> 관리자 QA #6. 사용자 결정(2026-09-11): **실무자용** · **능동 제안만 먼저(v1)**, 자유 Q&A 챗은 v2 ·
> **데이터 안전 필수** · 비용 sonnet high·일 최대 ~100건. 전달=**당사자별 온디맨드**(허브 버튼).

## 0. 목표

실무자가 담당 당사자를 검토할 때, 예산 이행·점검 신호를 AI가 **우선순위 있는 실무 제안**으로 합성해
보여준다. "무엇이 문제이고 다음에 무엇을 할지"를 한눈에. v1은 **능동 제안 생성**만(자유 대화 아님).

## 1. 아키텍처 — 2층 (안전·비용의 핵심)

발달장애 당사자 개인정보를 다루므로 **AI에 raw 데이터를 주지 않는다**.

```
[기존 뷰/테이블] → (결정론적) computeReviewSignals → ReviewSignal[]
                                                        │  (신호가 없으면 AI 호출 안 함 = 비용 0)
                                                        ▼
                        buildReviewContext(가명·요약) → callAIDeidentified(sonnet) → parseReviewSuggestions(환각가드)
```

- **신호층**(`staffReviewSignals.ts`, 순수·무AI·golden): 이미 fetch 한 원시값 → 점검 신호. 상시·저비용·테스트 가능.
- **AI층**(`staffReviewSuggestion.ts` 순수 + 액션): 신호 **요약**만 가명처리해 sonnet 에 보내 우선순위·실무문장 합성.

## 2. 신호 규칙 (v1 — 6종, `computeReviewSignals(input): ReviewSignal[]`)

입력은 **이미 조회된 원시값**(액션이 뷰→primitive 매핑; 순수로직은 DB 비의존).

| kind | 조건 | severity |
|---|---|---|
| `budget_ceiling` | `exceedsMonthlyCeiling` 또는 `monthlyCeiling>0 && monthSpent/monthlyCeiling ≥ 0.9` | high(초과)/medium(임박) |
| `copay_unsettled` | `copayUnsettledCount > 0` | medium |
| `unplanned_spending` | `unplannedCount > 0` | medium(≥3 high) |
| `rulecheck_pending` | `ruleChecksPending > 0` | high(≥3)/medium |
| `plan_delayed` | `planStatus ∈ {submitted, under_review}` | medium |
| `isolation` | `communityCount===0 && (lastContactDaysAgo≥60 or totalRelations≤1)` | medium |

- `ReviewSignal = { kind, severity: 'high'|'medium'|'info', label, detail }`. label/detail 은 한글 실무 문장.
- 신호 없음 → `[]`(전부 정상). 결정적 정렬(severity desc → kind).

## 3. AI 합성 (`staffReviewSuggestion.ts` 순수 + `actions/staffReviewSuggestion.ts`)

- `REVIEW_SYSTEM`: 실무자 도우미. 규칙 — ①받은 신호 범위 안에서만(지어내지 말 것) ②우선순위 매기고 다음 행동 제시 ③존댓말·간결 ④JSON 하나만.
- `buildReviewContext(signals, {participantLabel})`: 신호 목록을 텍스트로. **이름·기관은 넣지 않거나 넣더라도 terms 로 가명처리**(당사자 라벨은 "이 당사자"로 충분 — 이름 불필요가 기본).
- 출력 스키마: `{"suggestions":[{"priority":"high|medium|low","headline":"...","action":"...","basis":"신호kind"}]}`.
- `parseReviewSuggestions(raw, {validKinds})`: 방어 파싱(코드블록 제거·비배열 빈목록) + **환각가드: `basis` 가 실제 감지된 kind 안에 있어야 통과**. 최대 5개.
- `reviewPiiTerms({participantName?, agencyNames?})`: 넣은 경우에만 가명처리(넣지 않으면 no-op).

### 액션 `generateStaffReviewSuggestions(participantId)`
activitySuggestion 패턴 미러:
1. `viewAsWriteBlock()` — 둘러보기 중 유료 AI·감사로그 차단.
2. `requireStaff()` + **담당 접근 확인**(RLS 스코프 조회가 빈값이면 접근불가로 간주). 관리자=전체, 담당자=배정 당사자만.
3. 뷰 조회(RLS 경유): budget_balance·copay/settlement·unplanned·rule_checks(pending)·plan status·network → `ReviewInput`.
4. `computeReviewSignals`. **신호 0 → `{suggestions:[]}` 반환(AI 미호출=비용 0)**.
5. `callAIDeidentified(context, terms, {system:REVIEW_SYSTEM, model:AI_MODELS.suggest, json:true, cacheSystem:true, maxTokens:700})`.
   - ★`callAI` 직접 호출 금지(`aiGateBoundary.test.ts` 강제) — 반드시 게이트 경유.
   - sonnet-5 **기본 effort=high** → 사용자 요구 충족(ai.ts 무변경).
6. `auditLog(supabase,'ai.review',{targetType:'participant',targetId,participantId,metadata:{model}})`.
7. `parseReviewSuggestions(raw,{validKinds: 감지된 kind들})` 반환. AI 실패 → 친절 에러(DB 무변경).

## 4. 화면 (`StaffReviewSuggestions.tsx` + 허브 배선)

- 실무자 당사자 허브에 **"🤖 AI 점검 제안" 온디맨드 버튼**(누를 때만 액션 호출=비용 제어).
- 상태: 로딩(스피너) / 제안목록(priority 배지 high→red·medium→amber·low→neutral, headline + action) / 빈("지금 점검할 항목이 없어요 — 예산·점검·계획 모두 정상이에요") / 에러(친절).
- 접근성: 버튼 44px, aria-live 결과 영역, 쉬운 말.
- **안전 고지**: 제안 하단에 "AI가 만든 참고 제안이에요. 최종 판단은 선생님이 해요." (과신 방지).

## 5. 안전 (필수)

- **가명처리 게이트**: 전량 `callAIDeidentified`. 이름·기관 → 토큰. 토큰맵 요청스코프 메모리만(저장·로깅 금지). 회귀는 `aiGateBoundary.test.ts`.
- **RLS**: 담당 당사자만(requireStaff + seoul_is_staff_for 스코프 조회). 남의 당사자 신호 유입 불가.
- **인젝션**: 신호는 앱이 만든 요약(당사자 자유텍스트 원문 미포함) → 프롬프트 인젝션면 최소. (v2 Q&A 에서 자유텍스트 다루면 구분자 격리 필수.)
- **viewAs 차단** + **auditLog**(누가·언제·어느 당사자에 AI 호출).
- **과신 방지 고지** UI.

## 6. 비용

sonnet-5 $2/$10·MTok. 일 ~100건 × (~1.5K in + ~0.6K out) ≈ 하루 ~$1 미만(시스템 캐싱 시 ↓). `AI_MODEL_SUGGEST` env 로 모델 교체 가능(sonnet-4-6 원하면 핀).

## 7. 계약 (RED, W)

| 파일 | 단언 |
|---|---|
| `staffReviewSignals.test.ts` | 6종 규칙 golden(초과/임박 severity·자부담·계획외≥3 high·점검대기≥3 high·심의·고립) · 정상=[] · 정렬 |
| `staffReviewSuggestion.test.ts` | 컨텍스트에 신호 반영 · 파싱 방어(코드블록·비배열) · **환각가드(감지 안 된 basis 탈락)** · 5개 상한 · PII terms |
| `StaffReviewSuggestions.test.tsx` | 버튼 클릭→액션호출 · 로딩 · 제안렌더(priority 배지·headline·action) · 빈상태 문구 · 에러 · 안전고지 문구 |

**게이트**: tsc0·lint0·vitest(신규+회귀0, aiGateBoundary 포함)·build0 + 라이브 QA(신호 있는 당사자→제안, 정상 당사자→빈). **DB 슬라이스·Manual-Ops 없음.**

## 8. 범위 밖(v2)
자유 Q&A 챗(케이스로드 질의)·케이스로드 다이제스트·신호 임계 설정 UI·당사자 자유텍스트 반영(인젝션 격리 선행).
