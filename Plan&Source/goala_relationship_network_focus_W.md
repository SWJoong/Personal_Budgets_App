# 관계망 "관계·활동 중심" 뷰 + provenance 강조 — 설계권위 (W)

> 관리자 QA #5. Track B([[goala_relationship_network_crud_W]]) B4 그래프 오버레이 **확장**.
> 사용자 방향 확정(2026-09-11): **provenance 강조 + 지역사회/활동 중심**. 4분면 정확 구분(사용자 선택).
> 기존 데이터 모델 유지 — 시계열 변화 추적(새 데이터모델) 아님.

## 0. 문제

현 관계망 그래프(`supporter/network`)는 **제도 워크플로**(신청→계획→심의→예산→지출→정산→평가·대리인)가
노드 수의 대부분을 차지해 시각적으로 지배한다. 실무자가 직접 얹은 **사회 관계망**(가족/친구/유급지원/지역사회)은
얇은 점선 오버레이로 묻힌다. QA 발견:

> "노드 간 연결 표시는 지역사회 관계망과 활동 위주로. 노드 간 관계 자체를 지우는 게 아니라 실제로 어떤
> 변화가 이뤄졌는지를 핵심으로."

해석: (a) 제도 절차를 **지우지 말고**(관계 보존) **흐리게**, 사람의 관계·활동을 **전면**으로. (b) "실제 변화"
= 실무자가 수동 큐레이션한 것(provenance=manual) — 자동 파생(derived)과 구분해 **핵심으로** 드러낸다.

## 1. 데이터 (B4 뷰 확장 — CREATE OR REPLACE, 멱등)

`v_seoul_graph_edges_curated`(14)의 manual 브랜치에 두 컬럼을 **끝에 추가**한다(파생 브랜치는 NULL).
CREATE OR REPLACE VIEW 는 기존 컬럼 순서·이름·타입 불변 + 말미 추가만 허용 → 안전.

| 컬럼(신규·말미) | derived 행 | manual 행 |
|---|---|---|
| `relation_category` TEXT | `NULL` | `seoul_network_entities.relation_category` (family/friend/paid_support/community) |
| `closeness` INT | `NULL` | `seoul_network_entities.closeness` (1~4, nullable) |

- 노드뷰(`v_seoul_graph_nodes_curated`)는 **무변경**. NetworkEntity 노드의 분면은 그 노드로 들어오는
  유일한 manual 엣지(Participant→NetworkEntity)에서 클라가 도출한다(1:1).
- `security_invoker=true` 유지 → base·network_entities RLS 그대로. 유출 경로 없음.
- 기존 page.tsx select 은 컬럼 추가에 무영향(추가 컬럼만 더 읽음). database.ts 재생성 불필요(untyped 뷰).
- **Manual-Ops**: 대시보드에서 `14_network_graph_overlay.sql` **1회 재실행**(05·13 라이브 전제, 멱등·view-only·안전).

## 2. 순수 로직 (`egoGraph.ts`)

`GraphEdge`·`EgoEdge` 에 선택 필드 가산(파생 호출부 비파괴):
```ts
export type RelationCategory = 'family' | 'friend' | 'paid_support' | 'community'
interface GraphEdge { …; relation_category?: RelationCategory; closeness?: number }
```
`buildEgoGraph` 는 두 필드를 EgoEdge 로 **그대로 전파**(source 전파와 동일 패턴). 그룹 매핑·정렬 골든 불변.

## 3. 화면 (`NetworkGraphClient.tsx`)

### 3-1. "🫂 관계·활동 중심" 토글 (신규, 헤드라인)
- 버튼 `aria-pressed`. 켜면 **제도 절차 그룹을 디밍**(삭제 아님 — cy `.dimmed`, 기존 순환토글 패턴 재사용):
  - **디밍** = `cycle`(신청·계획·심의) · `eval`(모니터링·점검) · `for`(대리·담당).
  - **유지(밝게)** = `person`(당사자+사회관계) · `asset`(제공기관·영역=활동처) · `money`(예산·지출=활동).
- 기존 "순환 고리만" 토글과 상호배타 아님(둘 다 cy 클래스 오버레이). 켠 상태 캡션으로 안내.

### 3-2. provenance 강조
- **manual 엣지 시각 승격**: 기존 점선(width 2)을 **실선·굵게(width 3)·보라 유지**로 올려 파생(회색 얇은)
  대비 "직접 얹은 관계"가 핵심으로 읽히게. (파생 = 회색 유지.)
- **지역사회 강조**: `relation_category='community'` 인 manual 엣지·상대 노드에 구분 색(청록 계열)·링.

### 3-3. provenance 요약 (신규, DOM·항상 표시 — 텍스트 대안 겸)
그래프 위/아래 요약 블록:
- `실무자가 직접 얹은 관계 {manual}개 · 자동 연결 {derived}개` (manual=source==='manual', derived=나머지).
- **4분면 칩**: manual 엣지의 relation_category 별 개수 — 존재하는 분면만 `가족 {n}` `친구 {n}`
  `유급지원 {n}` `지역사회 {n}`(라벨 매핑 고정). 이것이 "실제 어떤 변화가(=큐레이션)"의 텍스트 핵심.

### 3-4. 범례
- manual 승격 선(실선 보라 = 직접 얹은 관계) + community 색 항목 추가. 기존 그룹·방향 범례 유지.

## 4. 계약 (RED, W 저작)

| 파일 | 추가 단언 |
|---|---|
| `verify_network_graph_overlay.sql`(확장) | S5 manual 가족 엣지 `relation_category='family'`+`closeness` 노출 · S6 community 엣지 `relation_category='community'` · S7 derived 엣지 `relation_category IS NULL AND closeness IS NULL` |
| `egoGraph.overlay.test.ts`(확장) | GraphEdge 의 relation_category/closeness 가 EgoEdge 로 전파(community 3·derived undefined) |
| `NetworkGraphClient.test.tsx`(확장) | "관계·활동 중심" 토글 `aria-pressed` 존재 · provenance 요약(직접 얹은 N·자동 M 정확) · 4분면 칩(지역사회 포함) · 회귀(기존 토글·목록 유지) |

cy 스타일(디밍·승격·링)은 스텁이 삼켜 단위불가 → **라이브 QA**(4분면 색·절차 디밍·community 강조 육안).

## 5. 게이트
tsc0·lint0·vitest(신규 계약 포함 회귀0)·build0 + docker 전체체인(00~05,13,14) verify GREEN + 라이브 QA.
Manual-Ops(14 재실행)는 CI db-verify green 후 사용자 브리핑.
