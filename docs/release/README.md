# docs/release/ — 릴리스·백엔드 노트 (U 소유)

병렬 하네스에서 **U(구현·배포 축)** 가 소유하는 릴리스/백엔드 실행 기록 디렉터리다.
(설계·계획·온톨로지 문서는 W 소유인 `Plan&Source/`, 하네스 계획서는 W 소유인 `docs/harness-plan.md`에 있다.)

## 무엇을 여기 적나
- 마이그레이션 실행 순서·결과 (`supabase/migrations/`, `supabase/seoul/` 빌드 SQL 적용 로그)
- 배포 전환 결정 기록 (예: `supabase/migrations`(구) ↔ `supabase/seoul`(신) 정본 전환)
- 환경변수·인프라 변경 (Vercel, Supabase 프로젝트)
- 릴리스 체크리스트 통과 여부, 롤백 노트

## 파일 네이밍
`NN-주제.md` (예: `01-seoul-schema-cutover.md`, `02-multitenancy-migration.md`)

## 상태 공유 규칙
- 진행 상태(대화)는 여기가 아니라 `scripts/agent-sync.sh post u "..."` (agent-sync 채널)로.
- 코드 핸드오프는 PR·CI로. 이 디렉터리는 **결정·실행 기록**만 남긴다.

## 노트
- [01-seoul-schema-cutover.md](01-seoul-schema-cutover.md) — seoul 정본 전환(D0 컷오버) 실행 노트
- [02-ci-gate-and-branch-protection.md](02-ci-gate-and-branch-protection.md) — CI 게이트 정상화·브랜치 보호·욕구사정 삭제 권한(#24)
- [03-prd-alignment-review.md](03-prd-alignment-review.md) — 서울형 리빌딩 PRD(2026-08-28) 정합성 리뷰: 이미구현/공백/스코프 대조
