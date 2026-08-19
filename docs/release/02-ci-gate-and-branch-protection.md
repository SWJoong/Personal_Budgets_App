# 02 · CI 게이트 정상화 + 브랜치 보호 + 욕구사정 삭제 권한

날짜: 2026-08-19 · 담당: U(devops·backend) · 관련 PR: #33 #34 #35 · W 스펙: #23(`Plan&Source/ci_db_verify_spec_W.md`)

## 요약
컷오버 이후 **CI 게이트가 무력**했던 근본 원인을 잡고, 두 워크플로를 **required status check**로 강제해
회귀를 pre-merge 에서 막도록 만들었다. 겸사겸사 W의 욕구사정 삭제 권한 계약(#24)을 초록화했다.

## 1. 근본 원인 — CI가 여태 안 돌던 이유
`ci.yml` 의 staging 스텝이 `if: ${{ secrets.STAGING_SUPABASE_URL != '' }}` 를 썼는데,
GitHub Actions 는 **`if` 조건에서 `secrets` 컨텍스트 참조를 금지**한다 → 워크플로가 시작 즉시
0초 실패("workflow file issue") → `quality-check` 가 **한 번도 게이트로 작동하지 못함**.
그 사이 base 이동 회귀(#26→#30, tsc RED)가 pre-merge 에 안 잡혔다.

## 2. 워크플로 두 개 (both required)
| 워크플로 | job | 실행 | 차단 |
|---|---|---|---|
| `.github/workflows/ci.yml` | `quality-check` | `tsc --noEmit` · `lint` · `vitest` · `next build`(더미 env 폴백) | 전부 blocking |
| `.github/workflows/db-verify.yml` | `db-verify` | postgres:17 에 seoul 빌드(00~05,07,09,10, `ON_ERROR_STOP=1`+멱등) → `verify_*.sql` 11종 → 결과라인 ❌ 시 실패 | blocking |

- **build 더미 폴백**: 시크릿이 없어도 항상 컴파일되게 `${{ secrets.X || 'dummy...' }}` — 결정적 회귀 감지가 목적(실제 클라우드 값 검증은 Vercel 프리뷰 담당).
- **lint blocking 승격**(#35): 컷오버 유입 선재 에러 22건 정리 후 `continue-on-error` 제거. 이제 새 린트 에러는 CI 실패.
  - `set-state-in-effect` 11건은 SSR-safe 마운트 동기화(localStorage·createPortal·close-on-nav·SDK ready)라 사유 명시 scoped-disable(규칙 자체는 신규 코드에 유지).
- **db-verify ❌ 스캔**: 설명용 `\echo` 리터럴 ❌(예: "판정: [A][B][C] ❌")을 제외하도록 필터 정밀화(원시 `grep ❌` 는 위양성).
- **concurrency**: 같은 PR 새 커밋 시 진행 중 런 취소(러너 절약). main push 런은 보존.

## 3. 브랜치 보호 (main) — 2026-08-19 적용
`gh api -X PUT repos/{owner}/{repo}/branches/main/protection` 로 설정:
- **required_status_checks**: `quality-check`, `db-verify`
- **strict: true** — PR 을 최신 main 에 맞춘 뒤에만 병합 → **base 이동 회귀 자동 차단**(#30 교훈).
- **enforce_admins: false** — 비상시 `gh pr merge --admin` escape 유지.
- **required_pull_request_reviews: null** — 리뷰는 W의 독립검증(채널+골든/verify)이 담당, 게이트는 CI.

재설정/확인:
```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  -q '{checks:.required_status_checks.contexts, strict:.required_status_checks.strict, admins:.enforce_admins.enabled}'
```

## 4. 욕구사정 삭제 권한 (#24, W 계약 초록화)
`09_ontology_classification.sql` `seoul_needs_assessment_delete`:
`USING (seoul_is_admin())` → **`USING (seoul_is_staff_for(participant_id))`**
(담당·관리자 삭제 허용 / 비담당 차단 · insert·update 와 대칭). 계약: `verify_needs_assessment_rls.sql` [3].

## 5. 로컬 계약 검증 (클라우드 없이)
`db-verify` 와 동일 조건을 docker 로 재현(CLI·클라우드 프로젝트 불필요):
```bash
docker run -d --rm -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=verify \
  -v "$PWD":/repo:ro postgres:17
# CWD=/repo 로 psql: verify_00_auth_stub → seoul 00~05,07,09,10 적용(ON_ERROR_STOP=1) → verify_*.sql
```
`\i` 상대경로(예: `verify_07`) 때문에 **psql CWD=리포 루트 필수**. 빌드 SQL 은 전부 멱등(재적용 무오류).

## 관련 파일
- `.github/workflows/ci.yml` · `.github/workflows/db-verify.yml`
- `supabase/seoul/09_ontology_classification.sql` · `Plan&Source/ontology/seoul/verify_needs_assessment_rls.sql`(W)
- 수동 클라우드 반영 직전 브리핑: CLAUDE.md 「수동 작업 게이트」(#23) + `supabase/seoul/README.md`
