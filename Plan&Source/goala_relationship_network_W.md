# 관계망 시각화 — UX·계약 설계 (W → U)

> 대상 구현(U-lane): `src/utils/egoGraph.ts`(신설, 순수 추출 로직) · `(supporter)/supporter/network/`(신설 화면) ·
> 그래프 렌더 컴포넌트(라이브러리 사용). 데이터 소스는 **이미 존재**(`v_seoul_graph_nodes`·`v_seoul_graph_edges`).
> 계약: `src/utils/egoGraph.test.ts`(test-first 골든) → **U 초록화**. 목업: 아티팩트 "관계망 지도".

---

## 1. 목적·범위

개인예산 데이터는 표가 아니라 **관계망**이다. 한 사람을 중심으로 **사정→계획→예산→지출→정산→평가**가
하나의 **순환 고리**로 이어지고, 제공기관·재원·대리인·담당자가 연결된다. 이 화면은 그 관계를 그려
"노트북을 샀다"가 아니라 "웹툰 작가가 되고 싶다 → 그림 배우기 → 태블릿"으로 읽히게 한다
(`v_seoul_intent_to_spending` 의 값어치). PCT 의 **순환 고리**·**To/For 균형**을 시각으로 드러낸다.

**대상**: 담당자·관리자 분석 도구(전체 그래프). 당사자용은 순환 고리만 쉬운 말로 축약(후속).

---

## 2. 데이터 소스 — 이미 존재 (스키마 변경 불필요)

- **`v_seoul_graph_nodes`**: `node_type`·`id`·`label`. 24종(Participant·Application·UtilizationPlan·SelfNarrative·
  RequestedService·PlanReview·BudgetAllocation·ServiceUsage·Settlement·MonitoringRecord·ServiceProvider·
  Proxy·AdministeringBody·Caseworker·…).
- **`v_seoul_graph_edges`**: `from_type`·`from_id`·`edge_type`·`edge_label`(한글)·`to_type`·`to_id`.
- 두 뷰는 `security_invoker=true` → **RLS 가 그대로 적용**(보는 사람이 접근 가능한 행만). 그래프 RLS 는
  기존 `verify_03_graph.sql` 로 검증됨.

### ★ 스코프 원칙 (보안)
buildEgoGraph 는 **준 것만 잇는다**. 교차 참여자 유입 방지는 **입력을 보는 사용자 권한으로 조회**해서
(RLS 스코프) 달성한다 — 서버컴포넌트가 `v_seoul_graph_*` 를 그 사용자로 SELECT → 접근 가능한 노드·엣지만
들어옴 → buildEgoGraph 가 rootId(당사자) 연결 성분만 추출. 별도 provider 같은 공유 노드는 읽히되, 남의
지출·계획은 RLS 로 애초에 안 들어와 BFS 가 남에게 못 건너간다. (maxDepth 로 추가 경계.)

---

## 3. 순수 추출 계약 — `egoGraph.ts` (골든)

`src/utils/egoGraph.ts`(U 구현), 골든 `egoGraph.test.ts`(W, RED→green).

```ts
export interface GraphNode { node_type: string; id: string; label: string }        // v_seoul_graph_nodes 행
export interface GraphEdge { from_type: string; from_id: string; edge_type: string; edge_label: string; to_type: string; to_id: string }
export type NodeGroup = 'person'|'cycle'|'money'|'eval'|'asset'|'for'|'other'  // 색 그룹
export type EdgeDirection = 'by'|'for'|'neutral'                               // To/For(주도성)
export interface EgoNode extends GraphNode { depth: number; group: NodeGroup }
export interface EgoEdge extends GraphEdge { direction: EdgeDirection }
export interface EgoGraph { rootId: string; nodes: EgoNode[]; edges: EgoEdge[] }

export function nodeGroup(nodeType: string): NodeGroup
export function edgeDirection(edgeType: string): EdgeDirection
export function buildEgoGraph(nodes: GraphNode[], edges: GraphEdge[], rootId: string, maxDepth?: number): EgoGraph // maxDepth 기본 4
```

**골든이 못박는 불변식**:
1. rootId 미존재 → 빈 그래프(방어). 2. **무향 BFS** 로 도달 가능한 노드만·깊이 부여, 끊긴 성분 제외.
3. maxDepth 경계(기본 4). 4. 고아 엣지(끝점 노드 없음)·서브그래프 밖 엣지 제외(결과 엣지는 양 끝점 모두 추출됨).
5. `nodeGroup`(색)·`edgeDirection`(To/For) 순수 매핑. 6. 결정적 정렬(노드 depth→id / 엣지 from→to).

**매핑 정의**(골든 고정):
- `nodeGroup`: person=Participant / cycle=UtilizationPlan·SelfNarrative·RequestedService·Application·PlanReview·… /
  money=BudgetAllocation·ServiceUsage·Receipt·Settlement·AdministeringBody / eval=MonitoringRecord·RuleCheck·SpendingRule /
  asset=ServiceProvider·ServiceDomain / for=Proxy·Caseworker·ExecutingAgency / other=기타.
- `edgeDirection`: by=submits·grants(당사자가 함) / for=actsFor·cosigns·decidedBy(남이 대신) / neutral=구조적.

---

## 4. 화면·렌더 (U-lane)

- 위치: `(supporter)/supporter/network`(또는 당사자 상세에서 "관계망 보기"). 진입점: 지원자 대시보드/당사자 행.
- 흐름: 당사자 선택 → 서버컴포넌트가 `v_seoul_graph_*` 를 사용자 권한으로 SELECT → `buildEgoGraph(nodes, edges, participantId)` → 렌더.
- **렌더**: 앱은 아티팩트와 달리 **CSP 제약 없음** → 그래프 라이브러리 사용 가능(**cytoscape.js** 또는 **react-force-graph**).
  노드=`group` 색, 엣지=`edge_label`(한글)·`direction` 스타일(for=점선·강조색). **순환 고리**·**To/For** 토글로 강조/디밍.
  노드 클릭 → 상세(그 레코드 화면으로 이동). 성능: 노드 많으면 depth 제한·클러스터.
- 목업(아티팩트 "관계망 지도")에 IA·토글·범례·색 규칙 확정 — 그대로 구현.

---

## 5. 당사자 노출 (후속)
담당자·관리자는 전체 ego-그래프. 당사자용은 **순환 고리만** 쉬운 말로 축약(사정→계획→예산→지출→평가,
큰 아이콘·짧은 라벨). To/For 같은 분석 관점은 담당자 전용. RLS 는 어차피 본인 데이터로 한정.

---

## 6. 착수 순서 (U-lane)
1. `src/utils/egoGraph.ts` 구현(§3) → 골든 green.
2. `(supporter)/supporter/network` 화면 + 서버 로드(`v_seoul_graph_*` 사용자 권한 SELECT) → `buildEgoGraph`.
3. 그래프 렌더 컴포넌트(cytoscape/react-force-graph) — 목업의 색·토글·범례.
4. 진입점(지원자 대시보드/당사자 상세 "관계망 보기").
5. (후속) 당사자용 순환 고리 축약 뷰.
- 재사용: `v_seoul_graph_nodes/edges`·`verify_03_graph`(그래프 RLS 검증). 새 SQL 불필요.
