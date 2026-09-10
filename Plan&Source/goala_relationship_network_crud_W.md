# Track B — 당사자 사회 관계망 CRUD (설계·계약 authority, W 레인)

> 사용자 방향(2026-09-10): "당사자의 관계망을 편집하고 추가 — OWL 추론 후 사회복지사가 직접 CRUD."
> 참조앱: Microsoft Ontology-Playground(Cytoscape + 비주얼 에디터). **확정 모델(사용자 승인)**:
> "파생그래프 + 수동 큐레이션" — 실제 OWL reasoner 도입 아님. 기존 FK-파생 그래프를 '후보'로 두고
> 실무자가 사회관계를 얹어 CRUD, provenance(파생/수동)로 구분.
> (읽기전용 분석 그래프 설계는 별도 `goala_relationship_network_W.md`. 이 문서는 CRUD 축.)

## §0 배경 — 무엇이 있고 무엇이 없나 (조사 확정)

- 현재 "관계망"(`supporter/network/NetworkGraphClient.tsx`+`egoGraph.ts`, cytoscape)은 **읽기전용**.
  노드·엣지는 물리 테이블이 아니라 FK를 뷰(`v_seoul_graph_nodes`/`v_seoul_graph_edges`,
  `05_seoul_graph.sql`)로 투영 — 편집 없음. 그리는 것도 제도 워크플로(사정→계획→예산→지출→정산→평가)지
  **사회적 관계망 아님**.
- **OWL 추론기 없음**(`05` §6 명시). RDF/OWL 파일(`Plan&Source/ontology/*.rdf`)은 설계 산출물, 앱이 안 읽음.
- 타깃 `NetworkEntity`(사회 관계망 4분면)는 `pcp_ontology.rdf`에 **설계만·미구현**. `network_entities`/
  `relation_category` 테이블·컬럼은 `supabase/` 어디에도 없음(grep 확인). **그린필드**.

## §1 데이터 모델 (B1) — 신규 `public.seoul_network_entities`

`pcp_ontology.rdf`의 NetworkEntity 스펙 + `seoul_needs_assessment`(09) 테이블/RLS 패턴 복제.

| 컬럼 | 타입 | 스펙 근거(pcp_ontology.rdf) |
|---|---|---|
| `id` | UUID PK | |
| `participant_id` | UUID NOT NULL FK participants ON DELETE CASCADE | 관계망 소유 당사자 |
| `relation_category` | TEXT NOT NULL CHECK IN (`family`,`friend`,`paid_support`,`community`) | **4분면**(고립 신호 판독) |
| `entity_name` | TEXT NOT NULL | `#entityName` 이름 |
| `relation_type` | TEXT | `#relationType`(엄마·이웃·동료…자유텍스트) |
| `closeness` | INT CHECK (BETWEEN 1 AND 4) | `#closeness` 동심원 거리(1=최근접) |
| `contact_frequency` | TEXT | `#contactFrequency`(주 1회…) |
| `last_contact_date` | DATE | `#lastContactDate`(고립위험 입력) |
| `linked_profile_id` | UUID FK profiles ON DELETE SET NULL | 유급지원자↔직원 계정(paid_support 프로즈 스펙) |
| `created_by` | UUID FK profiles | 기록자(needs_assessment.assessed_by 관습) |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

인덱스: `(participant_id)`, `(participant_id, relation_category)`.

★정확성 메모: `linked_profile_id`·`relation_category`는 OWL 프로퍼티가 아니라 **프로즈 스펙** → 평범한
컬럼으로 설계(온톨로지 엣지로 매핑 안 함). enum 은 `community`(NOT `community_member`).

**RLS(사용자 결정 = 실무자 전용)**: SELECT·INSERT·UPDATE·DELETE **전부 `seoul_is_staff_for(participant_id)`**.
근거: 친밀도 1~4 평가·고립 신호 등 사정성 정보라 우선 실무자만 열람. 당사자 노출은 표시를 당사자-친화적
으로 설계한 뒤 후속 확대(needs_assessment 는 can_access 지만 이 축은 더 보수적으로). 헬퍼는
`seoul_is_staff_for`(admin OR 담당) — `01_core.sql` SECURITY DEFINER.

**실행/멱등**: seoul 빌드는 번호순 **수동 실행**(대시보드 SQL Editor). 최근 파일 `12_audit_log` → B1 =
`13_network_entities.sql`. 전부 재실행 가능(`CREATE TABLE/INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`
→ 재생성). **Manual-Ops Gate**: CI db-verify green 후 사용자가 대시보드에서 13 실행.

## §2 슬라이스 계획 (각 = 계약(W) → 신선 서브에이전트 구현 → W 독립검증 1 PR)

### B1 — 테이블 + RLS 【ACTIVE】
- **빌드(U)**: `supabase/seoul/13_network_entities.sql`(§1 테이블+RLS+인덱스, 멱등) + `README.md` 실행순서
  + `.github/workflows/db-verify.yml` 에 `verify_network_entities` 등록.
- **계약(W)**: `Plan&Source/ontology/seoul/verify_network_entities.sql` — T0 테이블·컬럼, T1 FK CASCADE·
  relation_category CHECK·closeness 1~4 CHECK, S staff CRUD 가능 / self·타인 SELECT·write 차단(staff-only).
- **검증**: 로컬 docker postgres:17(00-auth-stub+00+01+13) RED(13 없이 T0 ❌)→GREEN(13 적용 전부 ✅) +
  CI db-verify. **타입 재생성은 Manual-Ops 실행 후**(테이블이 살아야 gen types) — B2 는 손타입으로 선행 가능.
- **Manual-Ops 브리핑**: CI green 후 — 적용 파일 `13_network_entities.sql`, 순서(12 다음), 목적, 멱등·롤백.

### B2 — 서버 액션 `src/app/actions/networkEntities.ts`
- `needsAssessment.ts` 템플릿: `assertStaff` → 순수 검증 util(`validateNetworkEntityInput`) → insert/update/
  delete(`.select('id').maybeSingle()`·0행=권한없음 메시지) → `friendlyDbError` → `revalidatePath('/supporter/
  ${participantId}/network')` → `{success,id}|{error}`. create/**update**/delete/get(needs_assessment UI엔 편집
  없지만 B3는 편집 배선). 손타입 인터페이스(테이블 라이브 전 선행 가능).
- **계약(W)**: `networkEntities.mutate.test.ts`(supabase 모킹) — CRUD 성공·검증거부·미인가.

### B3 — 편집 UI `/supporter/[participantId]/network`
- `AssessmentClient` 템플릿(requireStaff·useTransition+router.refresh·inline `role="alert"`·44px). 4분면 그룹
  목록 + 추가/**수정**/삭제. ★기존 읽기전용 `/supporter/network`(분석 그래프)와 **다른 라우트**(참여자 스코프).
- **계약(W)**: 렌더 + CRUD 배선 + 4분면 그룹.

### B4 — 그래프 오버레이 + provenance 【ACTIVE·Track B 마지막】
- **방식 정련(덜 침습적)**: 05 의 31개 브랜치·bidir·graph_walk 를 **건드리지 않는다**. 대신 신규
  `14_network_graph_overlay.sql` 에 **큐레이션 뷰** 2개(멱등 `CREATE OR REPLACE VIEW`, `security_invoker`):
  - `v_seoul_graph_nodes_curated` = `v_seoul_graph_nodes` ∪ `seoul_network_entities`(node_type='NetworkEntity',
    label=entity_name).
  - `v_seoul_graph_edges_curated` = `v_seoul_graph_edges`(+`'derived' AS source`) ∪ `seoul_network_entities`
    (Participant→NetworkEntity, predicate='hasNetworkEntity', predicate_ko=COALESCE(relation_type,'관계'),
    `'manual' AS source`).
  - 앱은 기존 flat 뷰만 읽으므로 bidir/graph_walk(미사용) 무관. security_invoker 라 base(각 RLS)+
    network_entities(staff-only) 인가 유지 — 유출 없음.
- 클라: `egoGraph.ts` `GraphEdge` 에 `source?: 'derived'|'manual'` 가산(spread 로 EgoEdge 전파) + `NODE_GROUP`
  에 `NetworkEntity`(→'person') + `network/page.tsx` 가 **큐레이션 뷰** 읽고 `source` 매핑 + `NetworkGraphClient`
  가 source='manual' 엣지 큐레이션 스타일(점선). **Manual-Ops**(14 대시보드 실행).
- **계약(W)**: `verify_network_graph_overlay.sql`(큐레이션 뷰 존재·수동엣지 source='manual'·파생 source='derived'·
  staff 열람/타인 차단) + `egoGraph.overlay.test.ts`(source 전파·NetworkEntity 그룹).

### (B5) — Ontology-Playground식 비주얼 에디터 폴리시 — 선택·후순위.

## §3 공통 원칙
- **구현≠검증**: 계약·설계=W(이 문서·verify·golden) · 구현=신선 서브에이전트 · 재검증=W(로컬 docker/vitest+빌드).
- **Manual-Ops Gate**(B1·B4): CI db-verify green 후 브리핑 → **사용자가** 대시보드 실행. 데모 UUID 불변.
- **RLS**: staff-only(`seoul_is_staff_for`). 화면 금액/표시는 정본 MoneyText(해당 시).
- **main 직접 push 금지** — PR·CI 경유. 머지는 사람.

## §4 상태 (2026-09-10)
- B1 완료(#137 + 대시보드 13). B2 완료(#138). B3 완료(#139 편집 UI, 진입점 '관계망 편집'로 리라벨해 기존
  '관계망' 분석그래프와 key 충돌 해소). B4 ACTIVE(이 PR·Track B 마지막). (B5 비주얼에디터=선택).
- B4 큐레이션 뷰 = 신규 `14_network_graph_overlay.sql`(05 무변경). Manual-Ops: 14 대시보드 실행.
- RLS=staff-only(사용자 결정). 클라이언트는 `<Database>` 제네릭 미사용(untyped) → B2 손타입으로 선행,
  `database.ts` 재생성은 비차단 hygiene 후속. 데모 관계망 시드는 08 루프 패턴으로 후속.
