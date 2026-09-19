# 13 · 관계망(사회관계망 / Track B) 기능 제거

- **일자**: 2026-09-19
- **브랜치/PR**: `chore/remove-relationship-network` → `[HANDOFF→W]`
- **성격**: 기능 제거(코드·빌드 SQL) + 라이브 DB 드롭(Manual-Ops)

## 왜

온톨로지 구축이 아직 완전하지 않은 점과 서울형 개인예산제 사업의 특수성을 고려해, 앱을 다음 **3축에
집중**해 완성하기로 결정했다.

1. **당사자**의 자기주도성
2. **실무자**의 행정 업무 간소화와 계획 공유
3. **관리자**의 사업 진행 과정 파악과 슈퍼비전

관계망(가족·친구·유급지원·지역사회 4분면 CRUD + 에고그래프 시각화, Track B)은 파생 그래프 큐레이션이라는
설계 의도상 온톨로지 성숙을 전제로 하는데, 그 전제가 아직 이르다고 판단해 제거한다.

## 제거한 것

| 영역 | 파일 |
|------|------|
| UI(그래프 뷰) | `src/app/(supporter)/supporter/network/**` (page·NetworkGraphClient·loading) |
| UI(관계 편집) | `src/app/(supporter)/supporter/[participantId]/network/**` (page·NetworkEditorClient) |
| 서버 액션(CRUD) | `src/app/actions/networkEntities.ts` |
| 순수 로직 | `src/utils/egoGraph.ts` · `src/utils/networkEntity.ts` |
| 빌드 SQL | `supabase/seoul/13_network_entities.sql` · `14_network_graph_overlay.sql` · `15_seed_network_demo.sql` |
| 내비 진입점 | 관리자 대시보드 카드 · 실무자 빠른작업 · 당사자 허브/목록의 "관계망" 링크 |
| 테스트(동반) | 위 구현의 co-located/전용 테스트 일체 |

빌드 파일 13/14/15 는 저장소에서 삭제되어 **번호 결번**이 됨(16~18 은 유지, 재번호 안 함 —
릴리스노트·로그 참조 안정성 우선). `supabase/seoul/README.md` 에 결번·드롭 안내 반영.

## 유지한 것 (제거 범위 밖)

- **`05_seoul_graph.sql`** 의 코어 온톨로지 그래프 뷰 `v_seoul_graph_nodes` / `v_seoul_graph_edges` —
  `11_provider_domains.sql` 등도 의존하는 코어 인프라라 건드리지 않음. (관계망 페이지가 유일 소비자였으나
  이제 미소비 뷰로 남음 — 무해·멱등. 향후 그래프 기능 복귀 시 재활용 가능.)
- **실무자 AI 점검 제안**(`/supporter/[pid]/checkup`, `staffReviewSignals`/`staffReviewSuggestion`) —
  3축 중 "실무자 행정 간소화·관리자 슈퍼비전"에 부합하므로 **유지**. 단 6개 신호 중 관계망 데이터에만
  의존하던 **`isolation`(지역사회 연결 부족) 신호는 함께 제거**(유일 데이터 소스 `seoul_network_entities`
  가 사라짐). 나머지 5개 신호(예산한도·자부담·계획외지출·규칙점검·이용계획심의)는 그대로 동작.

## Manual-Ops — 라이브 DB 드롭 (사용자 수동 실행)

빌드 파일 삭제만으로는 라이브 DB 객체가 정리되지 않는다. **Supabase 대시보드 > SQL Editor** 에서
아래를 수동 실행한다(에이전트는 실행하지 않음 · 프로젝트 Manual-Ops 규칙).

1. 실행 파일: **`supabase/seoul/_drops/2026-09-19_drop_network.sql`**
2. 순서·목적:
   - `v_seoul_graph_edges_curated` / `v_seoul_graph_nodes_curated` 뷰 드롭(14) — 테이블 의존이라 먼저.
   - `seoul_network_entities` 테이블 `DROP … CASCADE`(13) — RLS 정책·인덱스·시드 행(15)까지 함께 제거.
3. **되돌림**: 멱등(`IF EXISTS`). 복구가 필요하면 이 커밋 이전의 13/14/15 를 다시 실행.
4. **데이터 영향**: 관계망 입력 데이터(있다면) 소멸. 데모/QA 시드 성격이라 운영 실데이터 영향은 없을 것으로
   예상하나, 실행 전 대상 프로젝트에서 `SELECT count(*) FROM public.seoul_network_entities;` 로 확인 권장.

## CI (U 레인 · 본 PR 포함)

`.github/workflows/db-verify.yml` 에서 관계망 항목 제거: seoul 빌드 목록 13/14 (초기·멱등 재적용 양쪽) +
검증 목록 `verify_network_entities`·`verify_network_graph_overlay`. 안 하면 삭제된 13/14 를 `psql -f` 하다
빌드 실패. 유지한 `verify_03_graph`·`verify_graph_mask` 등은 05 코어 그래프만 봐서 무영향.

## W 레인 후속 (본 PR 밖)

- **고아 verify 파일**: `Plan&Source/ontology/seoul/verify_network_entities.sql`·
  `verify_network_graph_overlay.sql` 은 이제 CI 에서 호출되지 않음(워크플로 목록에서 제거). 파일 자체
  삭제는 W 판단(방치해도 CI 무영향 — 실행 목록에 없음).
- `Plan&Source/` 의 관계망 설계 문서(예: `goala_relationship_network_W.md`,
  `goala_staff_review_assistant_W.md` §고립신호, verify_*.sql 중 관계망/오버레이 계약)는 U 레인이 아니라
  건드리지 않음 — **W 가 정리/보존 판단**. 이 PR 은 구현·빌드 SQL·동반 테스트만 다룸.
- 본 PR 에서 삭제 정합성을 위해 불가피하게 수정한 W 레인 테스트: `staffReviewSignals.test.ts`
  (isolation 3케이스·network 픽스처 제거), `loading.p7c.test.tsx`(network 라우트 제거),
  `tokenFoundation.test.ts`(network 파일 2건 제거). `staffReviewSuggestion.test.ts:62` 의
  `basis:'isolation'` 은 "감지 안 된 basis 탈락" 환각가드 예시로 그대로 유효(수정 안 함).

## 게이트

`tsc --noEmit` 0 · `eslint` 0 errors · `vitest` 전량 통과(단, 사전존재 flake
`NewTransactionClient.partialfail`(#170 대기)는 격리 실행 6/6 통과 확인 — 본 변경과 무관) ·
`next build` 성공(라우트 목록에서 `/supporter/network`·`/supporter/[pid]/network` 소거 확인).
