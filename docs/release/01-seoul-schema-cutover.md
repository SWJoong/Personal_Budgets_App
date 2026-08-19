# 01 · 서울형 스키마 배포 정본 전환 (Cutover Plan)

> **상태**: 계획(승인 후 실행) · **소유**: U(구현·배포) · **결정 근거**: U↔W FINAL D0 (i)
> **선행 문서**: W 소유 `docs/harness-plan.md`(2축 로드맵) · **관련 메모리**: integration-base-branch

## 목표
`supabase/seoul/`(서울형 리빌드 정본)을 **단일 배포 정본**으로 전환하고, 번호 마이그레이션
`supabase/migrations/`(04~31)의 스키마 드리프트를 제거한다.

## 통합 base
`origin/claude/db-ontology-rdf-format-tnf0qv` (3개 stacked 브랜치의 상위집합).
- 포함: `supabase/seoul/` 30테이블·RLS 77정책·6트리거·그래프뷰·시드(07·08), 라이프사이클 서버액션 11종,
  `src/utils/copay.ts`, 구글 로그인 신원연결 수정, 뷰 RLS(security_invoker) 수정, RDF 3형식 동기화.

## 실행 단계 (승인 시 — 모두 PR·CI 경유, main 직접 push 금지)
1. **아카이브 이관**: `supabase/migrations/04~31` → `supabase/migrations/_archive/` 로 `git mv`
   (삭제 아님 — 이력·롤백 참조 보존). 정본에서 참조만 끊는다.
2. **base 통합**: `db-ontology-rdf-format`의 `supabase/seoul/` 빌드 SQL(00~03,05~08,README)을
   `feat/seoul-cutover` 로 main에 통합 → PR. `verify_*.sql`은 **W 레인**이므로 W가 배치([HANDOFF→U] 수신 후 정렬).
3. **데모 UUID 재현 검증**: 관리자 `00000000-0000-0000-0000-000000000001`·당사자
   `11e95b8b-6806-496d-9f36-88bd04e814b3` 가 `07_seed_program.sql`·`08_seed_demo.sql` 로 재생성되는지 확인.
   → W가 `verify` 시드 존재 검증 추가(합의됨).
4. **타입 재생성**: `npm run generate-types` 로 `src/types/database.ts` 를 seoul 스키마 기준 갱신
   (현재 낡음 — monthly_plans 이후 다수 누락).
5. **마이그레이션 가이드 갱신 요청**: 프로젝트 `CLAUDE.md`의 "데이터베이스 마이그레이션"(현재 최고번호 20 표기)
   → seoul 정본 반영. **CLAUDE.md 하네스/문서 섹션은 W 레인** → `[HANDOFF→W]` 로 요청.

## 실행 순서(Supabase 대시보드 SQL Editor, 수동)
`supabase/seoul/README.md` 순서를 따름: `01_core → 03_seoul_schema → 04_seoul_rls → 05_seoul_graph →
06_storage → 07_seed_program → 08_seed_demo`. (로컬 `db push` 미사용 — 프로젝트 규칙.)

## 리스크·의존성
- **기존 데모 데이터**: 정본 전환 시 기존 `migrations` 기반 데이터와 충돌 가능 → 데모 UUID는 시드로 재현하므로
  데모 환경은 재구축 전제. 실 데이터가 있으면 별도 이행 계획 필요(현재 데모 모드라 리스크 낮음).
- **정체성 모델**: 기존 `auth_user_id` vs `participant_id=auth.uid()` 이원화 → base가 `seoul_is_self()`로 이미 단일화.
- **게이트**: PR은 CI 전체(tsc+lint+test+build) + W 검증(verify_*.sql·계약테스트) 통과 후 merge.

## 실행 게이트
- [ ] 사용자 승인(커밋·PR 개시)
- [ ] W의 `docs/harness-plan.md` 로드맵 확정(축 A 순서)
- [ ] base 브랜치 통합 방식 확정(rebase vs cherry-pick — 상위집합이라 base 자체를 feat로 여는 안이 단순)
