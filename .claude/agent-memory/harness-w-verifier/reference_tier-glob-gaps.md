---
name: tier-glob-gaps
description: 선언 티어 대조 시 harness.json tiers 경로 글롭이 놓치는 고위험 변경 — RLS 술어·경로위조 트리거·정산 판정·담당 배정·내보내기·AI 가림 목록·공유 당사자 문구·검증 규칙 파일
metadata:
  type: reference
---

PR 선언 티어를 볼 때 `tiers.high` 글롭 매치만으로 small/docs 로 두지 않는다. 2026-09-28 기준 글롭 밖이던 고위험 변경:

- **RLS 술어·트리거**: `seoul_can_access`·`seoul_is_staff_for`·`seoul_is_admin` 은 `supabase/seoul/01_core.sql`, 활동사진 경로위조 트리거는 `03_seoul_schema.sql` — 파일명에 `rls` 가 없어 `supabase/**/*rls*.sql` 에 안 걸리고, 함수 본문만 바꾸면 sqlPolicyRegex 변경줄도 0 이다.
- **money/auth 성격인데 목록 밖**: 정산 판정(`src/app/actions/ruleCheck.ts` 의 settlement_status 갱신), 담당자 배정 API(`assigned_supporter_id` = RLS 스코프 입력), 장부 CSV 내보내기 API(assertStaff 게이트).
- **privacy**: AI 가림 목록(PiiTerm)을 만드는 유틸(staffReviewSuggestion·easyReadSummary·activitySuggestion), `createAdminClient`(RLS 우회) 호출부, 감사 호출부(`auditLog(` 삭제).
- **당사자 문구**: `participantCopyGlobs` 가 `src/app/(participant)/**` 뿐이면 공유 컴포넌트(`src/components/{ui,layout,home,plan}`)·`src/utils/easyTerms.ts` 문구 변경에서 verify-pr 가 copy 검수를 생략한다.
- **검증 규칙 자체**: `.claude/skills/**`·`.github/pull_request_template.md`·`docs/harness-plan.md` 는 `**/*.md` 로 docs 티어에 걸린다.

**Why:** 경로 글롭 기반 자기선언 티어는 파일명·디렉터리 규칙에서 벗어난 고위험 코드를 T1/T0 로 흘린다(하네스 단일계정 전환 PR 검증에서 4개 렌즈가 독립 확인).
**How to apply:** 매 PR 에서 변경 파일을 위 목록과 대조하고, 해당하면 선언 티어 상향을 finding 으로 올린다. harness.json 이 고쳐졌으면 현재 설정 기준으로 이 목록을 갱신·축소한다. [[harness-config-probes]]
