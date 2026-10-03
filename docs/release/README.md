# docs/release/ — 릴리스·백엔드 노트 (오케스트레이터 · U 역할 저작)

하네스에서 **U 역할(구현·배포)** 이 저작하는 릴리스/백엔드 실행 기록 디렉터리다.
(설계·온톨로지 문서는 W 레인 `Plan&Source/`(`harness:w-contract-author` 저작), 하네스 계획서는 `docs/harness-plan.md` v2. 결정 로그 `decisions.md`, QA 실행 기록 `qa-runs/`.)

## 무엇을 여기 적나
- 마이그레이션 실행 순서·결과 (`supabase/migrations/`, `supabase/seoul/` 빌드 SQL 적용 로그)
- 배포 전환 결정 기록 (예: `supabase/migrations`(구) ↔ `supabase/seoul`(신) 정본 전환)
- 환경변수·인프라 변경 (Vercel, Supabase 프로젝트)
- 릴리스 체크리스트 통과 여부, 롤백 노트

## 파일 네이밍
`NN-주제.md` (예: `01-seoul-schema-cutover.md`, `02-multitenancy-migration.md`)

## 상태 공유 규칙
- 진행 상태(저널)는 `scripts/agent-sync.sh post u "..."`, 사람 자리 기록(머지·QA·결정)은 `post w "[… by user] …"` (agent-sync 채널)로.
- 코드 핸드오프는 PR·CI로. 이 디렉터리는 **결정·실행 기록**만 남긴다.

## 노트
- [01-seoul-schema-cutover.md](01-seoul-schema-cutover.md) — seoul 정본 전환(D0 컷오버) 실행 노트
- [02-ci-gate-and-branch-protection.md](02-ci-gate-and-branch-protection.md) — CI 게이트 정상화·브랜치 보호·욕구사정 삭제 권한(#24)
- [03-prd-alignment-review.md](03-prd-alignment-review.md) — 서울형 리빌딩 PRD(2026-08-28) 정합성 리뷰: 이미구현/공백/스코프 대조
- [04-u-parallel-orchestration.md](04-u-parallel-orchestration.md) — U 병렬 오케스트레이션 운영모델
- [05-demo-personas.md](05-demo-personas.md) — 데모 당사자 10명(Nemotron 페르소나+사람중심계획) 시드 실행노트·수동작업 브리핑
- [06-activity-photos-backend.md](06-activity-photos-backend.md) — 활동사진 백엔드(Wave A): `seoul_activity_photos`·RLS·경로위조 트리거·갤러리 2소스 + 수동 절차
- [07-a11y-kwcag-1st-eval.md](07-a11y-kwcag-1st-eval.md) — 웹 접근성(KWCAG 2.2) 1차 평가서(baseline 자가진단) + 인증 화면 라이브 감사
- [08-a11y-remediation.md](08-a11y-remediation.md) — 접근성 적용: 3역할 WAI-ARIA·키보드·인지 접근성
- [08-persona-qa-findings.md](08-persona-qa-findings.md) — 실사용자 QA(3 페르소나) findings + cheese0318 관리자 접근 현황
- [09-a11y-user-eval-plan.md](09-a11y-user-eval-plan.md) — 접근성 실사용자 심사 계획 (기록 도구: [a11y-eval-recorder.html](a11y-eval-recorder.html))
- [10-disability-law-a11y-eval.md](10-disability-law-a11y-eval.md) — 장애인 관련 법률·웹 접근성 준수 평가서 + 우선순위 로드맵
- [11-p0-privacy-compliance.md](11-p0-privacy-compliance.md) — P0 개인정보 준수: 처리방침 초안·AI 국외이전 고지·감사 보관정책
- [12-p0b-audit-retention.md](12-p0b-audit-retention.md) — P0-B 감사로그 완성: 열람(read) 기록 + 보관·파기(pg_cron 런북)
- [12-test-participant-edit-access.md](12-test-participant-edit-access.md) — 테스트 당사자 편집 접근(`TEST_PARTICIPANT_ID`)
- [13-remove-relationship-network.md](13-remove-relationship-network.md) — 관계망(사회관계망 / Track B) 기능 제거
- [14-prd-reprioritization.md](14-prd-reprioritization.md) — PRD 재정합 + 3축 우선순위 백로그 (현행 백로그 2026-09-27 재점검 포함)
- [15-overseas-transfer-decision.md](15-overseas-transfer-decision.md) — AI 개인정보 처리(국외이전·위탁·동의) 근거 결정 메모
- [16-functional-qa-checklist.md](16-functional-qa-checklist.md) — 경로별 기능 QA 체크리스트
- [17-harness-codification.md](17-harness-codification.md) — 하네스 코드화: 서브에이전트 정의·레인 가드 훅·`/verify-pr`·역할 스킬 정정 (부품은 이후 플러그인으로 이전)
- [18-single-account-operating-model.md](18-single-account-operating-model.md) — 단일 계정 운영 모델: W·U=역할, 사람 자리, 검증 티어, 플러그인 `harness` 추출, 전환 기록
- [19-go-live-roadmap-1028.md](19-go-live-roadmap-1028.md) — 10/28 마감 로드맵(제안): 임계 경로·일정·스코프 컷·폴백·Go/No-Go·운영 전환 하드닝 체크리스트
- [20-institution-decision-request-draft.md](20-institution-decision-request-draft.md) — 기관 결정 요청서(초안): 국외이전 근거·처리방침 확정값·DPA·Vercel Analytics, 회신 기한 10/13
- [21-harness-token-efficiency.md](21-harness-token-efficiency.md) — 하네스 토큰 효율 평가(실측 277만 토큰·고정 부팅비 55%)와 개선안 8건, 진행 보고(쉬운 말) 요구사항
- [decisions.md](decisions.md) — 결정 로그(append-only) · [qa-runs/](qa-runs/README.md) — 사람 QA 실행 기록

> 번호 `08`·`12` 는 각각 두 파일이 같은 번호를 쓴다(작성 시점이 겹친 기록). 링크 호환을 위해 파일명은 바꾸지 않는다. *(2026-09-27 갱신)*
