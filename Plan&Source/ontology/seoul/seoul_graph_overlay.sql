-- =====================================================================
-- 서울형 — 그래프 오버레이 (파생 우선 방식)
--
-- ⚠️ 검토용 초안. seoul_schema_draft.sql 을 먼저 적용한 뒤 실행합니다.
-- ⚠️ 뷰의 WITH (security_invoker = true) 는 PostgreSQL 15 이상이 필요합니다.
--    이 옵션이 없으면 뷰가 소유자 권한으로 실행되어 RLS 가 통째로 우회됩니다 (§6 참조).
--
-- ─────────────────────────────────────────────────────────────────────
-- 이 파일이 답하는 질문: "기존 Supabase 로도 온톨로지형 DB 가 되는가?"
--
-- 된다. 다만 그래프 DB 를 따로 두는 방식이 아니라,
-- **이미 있는 외래키를 트리플(주어-술어-목적어)로 투영하는** 방식이다.
--
-- 핵심 관찰: 외래키는 이미 엣지다.
--   seoul_service_usages.requested_service_id 라는 컬럼은
--   "이 지출이 저 계획 항목을 이행한다(fulfills)"는 관계 그 자체다.
--   따로 엣지 테이블을 만들어 복제할 필요가 없다.
--
-- 그래서 엣지를 저장하지 않고 뷰로 파생시킨다(derived-first).
--   · 이중 쓰기가 없으므로 그래프와 표가 어긋날 수 없다
--   · 트랜잭션·RLS·제약이 전부 그대로 적용된다
--   · 스키마가 바뀌면 이 뷰만 고치면 된다
--
-- 술어 이름은 seoul_ontology.rdf 의 ObjectProperty 와 1:1로 맞춘다.
-- 그림(RDF)과 데이터(SQL)가 같은 어휘를 쓰게 하는 것이 이 파일의 목적이다.
-- ─────────────────────────────────────────────────────────────────────


-- =====================================================================
-- §1. 노드 — 모든 개체를 (종류, id, 이름) 한 모양으로
-- =====================================================================

CREATE OR REPLACE VIEW public.v_seoul_graph_nodes
  WITH (security_invoker = true) AS
  SELECT 'Participant'::TEXT AS node_type, p.id,
         COALESCE(pr.name, '이름없음') AS label
    FROM public.participants p
    LEFT JOIN public.profiles pr ON pr.id = p.id
UNION ALL SELECT 'Application',      id, COALESCE(receipt_number,'접수번호미정')       FROM public.seoul_applications
UNION ALL SELECT 'ConsentRecord',    id, CASE consent_type WHEN 'general' THEN '개인정보 동의'
                                                           ELSE '고유식별정보 동의' END
                                          || CASE WHEN is_agreed THEN ' (동의)' ELSE ' (거부)' END
                                                                                       FROM public.seoul_consent_records
UNION ALL SELECT 'SelectionDecision', id, CASE WHEN is_selected THEN '선정' ELSE '미선정' END
                                                                                       FROM public.seoul_selection_decisions
UNION ALL SELECT 'UtilizationPlan',  id, '이용계획 (' || status || ')'                 FROM public.seoul_utilization_plans
UNION ALL SELECT 'SelfNarrative',    id, '나의 상황'                                   FROM public.seoul_self_narratives
UNION ALL SELECT 'RequestedService', id, priority || '순위: ' || service_name          FROM public.seoul_requested_services
UNION ALL SELECT 'ServiceDomain',    id, label                                         FROM public.seoul_service_domains
UNION ALL SELECT 'PlanReview',       id, '심의: ' || decision                          FROM public.seoul_plan_reviews
UNION ALL SELECT 'ReviewCommittee',  id, name                                          FROM public.seoul_review_committees
UNION ALL SELECT 'Notification',     id, '통지 ' || notified_on                        FROM public.seoul_notifications
UNION ALL SELECT 'Appeal',           id, '이의신청 (' || outcome || ')'                FROM public.seoul_appeals
UNION ALL SELECT 'BudgetAllocation', id, '예산 ' || to_char(allocated_amount,'FM999,999,999') || '원'
                                                                                       FROM public.seoul_budget_allocations
UNION ALL SELECT 'ServiceUsage',     id, usage_date || ' ' || COALESCE(description,'(내용없음)')
                                          || ' ' || to_char(amount,'FM999,999,999') || '원'
                                                                                       FROM public.seoul_service_usages
UNION ALL SELECT 'Receipt',          id, '영수증'                                      FROM public.seoul_receipts
UNION ALL SELECT 'ServiceProvider',  id, name                                          FROM public.seoul_service_providers
UNION ALL SELECT 'SpendingRule',     id, label                                         FROM public.seoul_spending_rules
UNION ALL SELECT 'RuleCheck',        id, '검증: ' || check_result                      FROM public.seoul_rule_checks
UNION ALL SELECT 'Settlement',       id, '정산 ' || settled_period                     FROM public.seoul_settlements
UNION ALL SELECT 'MonitoringRecord', id, '모니터링 ' || monitoring_date                FROM public.seoul_monitoring_records
UNION ALL SELECT 'AdministeringBody',id, name                                          FROM public.seoul_administering_bodies
UNION ALL SELECT 'ExecutingAgency',  id, name                                          FROM public.seoul_executing_agencies
UNION ALL SELECT 'Proxy',            id, proxy_name || ' (' || relation_to_participant || ')'
                                                                                       FROM public.seoul_proxies
UNION ALL SELECT 'Caseworker',       id, COALESCE(name,'담당자')                       FROM public.profiles WHERE role <> 'participant';

COMMENT ON VIEW public.v_seoul_graph_nodes IS
  '모든 개체를 (종류, id, 사람이 읽을 이름) 한 모양으로 투영한다. 그래프 탐색 결과를 사람이 읽을 수 있게 만드는 것이 목적.';


-- =====================================================================
-- §2. 엣지 — 외래키를 트리플로 투영
--     술어 이름은 seoul_ontology.rdf 의 ObjectProperty 와 동일
-- =====================================================================

CREATE OR REPLACE VIEW public.v_seoul_graph_edges
  WITH (security_invoker = true) AS
-- ── 참여자 자격 ──────────────────────────────────────────────────────
  SELECT 'Participant'::TEXT AS s_type, participant_id AS s_id,
         'hasDisabilityProfile'::TEXT AS predicate, '장애 정보를 가진다'::TEXT AS predicate_ko,
         'DisabilityProfile'::TEXT AS o_type, id AS o_id
    FROM public.seoul_disability_profiles
UNION ALL SELECT 'Participant', participant_id, 'hasBenefitStatus', '수급 현황을 가진다',
                 'BenefitStatus', id                            FROM public.seoul_benefit_status
UNION ALL SELECT 'Proxy', id, 'actsFor', '대리한다',
                 'Participant', participant_id                  FROM public.seoul_proxies

-- ── 신청 ─────────────────────────────────────────────────────────────
UNION ALL SELECT 'Participant', participant_id, 'submits', '신청한다',
                 'Application', id                              FROM public.seoul_applications
UNION ALL SELECT 'Application', id, 'receivedBy', '접수된다',
                 'ExecutingAgency', received_by_id              FROM public.seoul_applications
                 WHERE received_by_id IS NOT NULL
UNION ALL SELECT 'Proxy', proxy_id, 'cosigns', '대리 서명한다',
                 'Application', id                              FROM public.seoul_applications
                 WHERE proxy_id IS NOT NULL
UNION ALL SELECT 'Participant', participant_id, 'grants', '동의한다',
                 'ConsentRecord', id                            FROM public.seoul_consent_records
UNION ALL SELECT 'Application', application_id, 'includesConsent', '동의서를 포함한다',
                 'ConsentRecord', id                            FROM public.seoul_consent_records
UNION ALL SELECT 'Application', application_id, 'resultsIn', '선정 결과로 이어진다',
                 'SelectionDecision', id                        FROM public.seoul_selection_decisions
UNION ALL SELECT 'SelectionDecision', id, 'decidedBy', '결정 주체',
                 'AdministeringBody', decided_by_id             FROM public.seoul_selection_decisions
                 WHERE decided_by_id IS NOT NULL

-- ── 이용계획 ─────────────────────────────────────────────────────────
UNION ALL SELECT 'Participant', participant_id, 'authors', '계획을 세운다',
                 'UtilizationPlan', id                          FROM public.seoul_utilization_plans
UNION ALL SELECT 'UtilizationPlan', id, 'basedOn', '신청서에 근거한다',
                 'Application', application_id                  FROM public.seoul_utilization_plans
UNION ALL SELECT 'Caseworker', assisted_by_id, 'assists', '계획 수립을 돕는다',
                 'UtilizationPlan', id                          FROM public.seoul_utilization_plans
                 WHERE assisted_by_id IS NOT NULL
UNION ALL SELECT 'UtilizationPlan', plan_id, 'describes', '나의 상황을 담는다',
                 'SelfNarrative', id                            FROM public.seoul_self_narratives
UNION ALL SELECT 'UtilizationPlan', plan_id, 'requests', '서비스를 요청한다',
                 'RequestedService', id                         FROM public.seoul_requested_services
UNION ALL SELECT 'RequestedService', id, 'classifiedAs', '영역으로 분류된다',
                 'ServiceDomain', domain_id                     FROM public.seoul_requested_services
                 WHERE domain_id IS NOT NULL

-- ── 심의와 권리구제 ──────────────────────────────────────────────────
UNION ALL SELECT 'UtilizationPlan', plan_id, 'reviewedBy', '심의를 받는다',
                 'PlanReview', id                               FROM public.seoul_plan_reviews
UNION ALL SELECT 'PlanReview', id, 'conductedBy', '심의 주체',
                 'ReviewCommittee', committee_id                FROM public.seoul_plan_reviews
                 WHERE committee_id IS NOT NULL
UNION ALL SELECT 'PlanReview', review_id, 'issues', '통지를 발송한다',
                 'Notification', id                             FROM public.seoul_notifications
UNION ALL SELECT 'Notification', id, 'sentTo', '통지받는다',
                 'Participant', participant_id                  FROM public.seoul_notifications
UNION ALL SELECT 'Participant', participant_id, 'files', '이의를 제기한다',
                 'Appeal', id                                   FROM public.seoul_appeals
UNION ALL SELECT 'Appeal', id, 'contests', '통지에 이의를 단다',
                 'Notification', notification_id                FROM public.seoul_appeals

-- ── 예산과 집행 ──────────────────────────────────────────────────────
UNION ALL SELECT 'PlanReview', review_id, 'authorizes', '예산을 승인한다',
                 'BudgetAllocation', id                         FROM public.seoul_budget_allocations
                 WHERE review_id IS NOT NULL
UNION ALL SELECT 'BudgetAllocation', id, 'allocatedTo', '배정된다',
                 'Participant', participant_id                  FROM public.seoul_budget_allocations
UNION ALL SELECT 'BudgetAllocation', id, 'fundedBy', '재원을 댄다',
                 'AdministeringBody', funded_by_id              FROM public.seoul_budget_allocations
                 WHERE funded_by_id IS NOT NULL
UNION ALL SELECT 'Participant', participant_id, 'uses', '서비스를 이용한다',
                 'ServiceUsage', id                             FROM public.seoul_service_usages
UNION ALL SELECT 'ServiceUsage', id, 'drawsFrom', '예산에서 차감된다',
                 'BudgetAllocation', allocation_id              FROM public.seoul_service_usages
-- ★ 계획과 지출을 잇는 화살표. 이것이 있어야 "꿈에서 돈까지" 경로가 닫힌다.
UNION ALL SELECT 'ServiceUsage', id, 'fulfills', '계획 항목을 이행한다',
                 'RequestedService', requested_service_id       FROM public.seoul_service_usages
                 WHERE requested_service_id IS NOT NULL
UNION ALL SELECT 'ServiceUsage', id, 'providedBy', '제공처',
                 'ServiceProvider', provider_id                 FROM public.seoul_service_usages
                 WHERE provider_id IS NOT NULL
UNION ALL SELECT 'ServiceUsage', id, 'inDomain', '영역에 속한다',
                 'ServiceDomain', domain_id                     FROM public.seoul_service_usages
                 WHERE domain_id IS NOT NULL
UNION ALL SELECT 'ServiceUsage', usage_id, 'evidencedBy', '영수증으로 증빙된다',
                 'Receipt', id                                  FROM public.seoul_receipts

-- ── 규칙 검증 ────────────────────────────────────────────────────────
UNION ALL SELECT 'ServiceUsage', usage_id, 'checkedAgainst', '규칙 검증을 거친다',
                 'RuleCheck', id                                FROM public.seoul_rule_checks
UNION ALL SELECT 'RuleCheck', id, 'appliesRule', '적용된 규칙',
                 'SpendingRule', rule_id                        FROM public.seoul_rule_checks

-- ── 모니터링·정산 ────────────────────────────────────────────────────
UNION ALL SELECT 'MonitoringRecord', id, 'observes', '대상 참여자',
                 'Participant', participant_id                  FROM public.seoul_monitoring_records
UNION ALL SELECT 'MonitoringRecord', monitoring_id, 'reviewsUsage', '이용 내역을 확인한다',
                 'ServiceUsage', usage_id                       FROM public.seoul_monitoring_usages
UNION ALL SELECT 'Settlement', id, 'settles', '예산을 정산한다',
                 'BudgetAllocation', allocation_id              FROM public.seoul_settlements

-- ── 기관 구조 ────────────────────────────────────────────────────────
UNION ALL SELECT 'ExecutingAgency', id, 'designatedBy', '지정 주체',
                 'AdministeringBody', designated_by_id          FROM public.seoul_executing_agencies
                 WHERE designated_by_id IS NOT NULL
UNION ALL SELECT 'Participant', id, 'assignedTo', '담당자가 배정된다',
                 'Caseworker', assigned_supporter_id            FROM public.participants
                 WHERE assigned_supporter_id IS NOT NULL;

COMMENT ON VIEW public.v_seoul_graph_edges IS
  '외래키를 (주어-술어-목적어) 트리플로 투영한다. 엣지를 별도 테이블에 복제하지 않으므로 표와 그래프가 어긋날 수 없다. 술어 이름은 seoul_ontology.rdf 의 ObjectProperty 와 동일하다.';


-- =====================================================================
-- §3. 양방향 엣지 — 화살표를 거꾸로도 따라갈 수 있어야 한다
--
-- ★ 실제로 돌려보고 알게 된 것:
--   "이 계획 항목에 돈이 얼마나 쓰였나"를 물으면 계획 → 지출 방향으로 가야 하는데,
--   fulfills 는 지출 → 계획 방향이라 정방향 탐색으로는 0건이 나온다.
--   OWL 이라면 owl:inverseOf 로 선언할 것을, 여기서는 역방향 엣지를 만들어 둔다.
-- =====================================================================

CREATE OR REPLACE VIEW public.v_seoul_graph_edges_bidir
  WITH (security_invoker = true) AS
  SELECT s_type, s_id, predicate, predicate_ko, o_type, o_id, FALSE AS is_inverse
    FROM public.v_seoul_graph_edges
  UNION ALL
  SELECT o_type, o_id, predicate || '_of', '← ' || predicate_ko, s_type, s_id, TRUE
    FROM public.v_seoul_graph_edges;

COMMENT ON VIEW public.v_seoul_graph_edges_bidir IS
  '정방향 + 역방향. 역방향 술어는 "← 계획 항목을 이행한다" 처럼 화살표로 표시해 방향을 잃지 않게 한다.';


-- =====================================================================
-- §4. 경로 탐색 — 그래프 DB 에서 쓰려던 기능의 실체
--
-- 사람들이 그래프 DB 에서 정말로 원하는 것은 대개 "몇 단계 건너 연결된 것 찾기"다.
-- 그건 재귀 CTE 로 된다. Cypher 문법이 아닐 뿐 결과는 같다.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.seoul_graph_walk(
  p_start_id     UUID,
  p_max_depth    INT     DEFAULT 6,
  p_bidirectional BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  depth       INT,
  path_label  TEXT,
  s_type      TEXT,
  s_id        UUID,
  s_label     TEXT,
  predicate   TEXT,
  o_type      TEXT,
  o_id        UUID,
  o_label     TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER   -- ★ 함수도 뷰도 모두 invoker 여야 RLS 가 산다. 둘 중 하나만 놓쳐도 새어나간다.
SET search_path = public, pg_temp
AS $$
  WITH RECURSIVE src AS (
    SELECT e.s_type, e.s_id, e.predicate, e.predicate_ko, e.o_type, e.o_id
      FROM public.v_seoul_graph_edges_bidir e
     WHERE p_bidirectional OR NOT e.is_inverse
  ),
  walk AS (
    SELECT 1 AS depth,
           e.predicate_ko::TEXT AS path_label,
           e.s_type, e.s_id, e.predicate, e.o_type, e.o_id,
           ARRAY[e.s_id, e.o_id] AS visited
      FROM src e
     WHERE e.s_id = p_start_id

    UNION ALL

    SELECT w.depth + 1,
           w.path_label || ' → ' || e.predicate_ko,
           e.s_type, e.s_id, e.predicate, e.o_type, e.o_id,
           w.visited || e.o_id
      FROM walk w
      JOIN src e ON e.s_id = w.o_id
     WHERE w.depth < p_max_depth
       AND NOT (e.o_id = ANY(w.visited))     -- 순환 방지
  )
  SELECT w.depth, w.path_label,
         w.s_type, w.s_id, COALESCE(sn.label,'?'),
         w.predicate,
         w.o_type, w.o_id, COALESCE(onn.label,'?')
    FROM walk w
    LEFT JOIN public.v_seoul_graph_nodes sn  ON sn.id  = w.s_id AND sn.node_type = w.s_type
    LEFT JOIN public.v_seoul_graph_nodes onn ON onn.id = w.o_id AND onn.node_type = w.o_type
   ORDER BY w.depth, w.path_label;
$$;

COMMENT ON FUNCTION public.seoul_graph_walk(UUID, INT, BOOLEAN) IS
  '한 노드에서 출발해 최대 N단계까지 따라간다. SECURITY INVOKER + 뷰의 security_invoker 가 함께 걸려야 남의 서브그래프가 차단된다 — 그래프 DB 를 따로 두면 이 보호를 처음부터 다시 구현해야 한다.';


-- =====================================================================
-- §5. 실무 질문 두 개를 그래프로 답하기
-- =====================================================================

-- (1) "이 사람이 원한다고 적은 것과 실제로 쓴 돈이 이어지는가"
--     서술(나의 상황) → 요청 서비스 → 실제 지출 경로를 한 줄로 본다.
CREATE OR REPLACE VIEW public.v_seoul_intent_to_spending
  WITH (security_invoker = true) AS
SELECT
  pl.participant_id,
  sn.desired_life                                   AS 원하는_삶,
  sn.goal_to_try                                    AS 시도하고_싶은_것,
  rs.priority                                       AS 순위,
  rs.service_name                                   AS 요청한_서비스,
  d.label                                           AS 영역,
  rs.estimated_cost                                 AS 예상비용,
  COALESCE(sum(u.amount), 0)                        AS 실제_집행액,
  count(u.id)                                       AS 집행_건수,
  CASE
    WHEN count(u.id) = 0 THEN '계획했으나 아직 쓰지 않음'
    WHEN rs.estimated_cost IS NULL THEN '집행됨 (예상비용 미기재)'
    WHEN sum(u.amount) > rs.estimated_cost THEN '예상보다 초과'
    ELSE '예상 범위'
  END                                               AS 상태
FROM public.seoul_utilization_plans pl
JOIN public.seoul_self_narratives    sn ON sn.plan_id = pl.id
JOIN public.seoul_requested_services rs ON rs.plan_id = pl.id
LEFT JOIN public.seoul_service_domains d ON d.id = rs.domain_id
LEFT JOIN public.seoul_service_usages  u ON u.requested_service_id = rs.id
GROUP BY pl.participant_id, sn.desired_life, sn.goal_to_try,
         rs.id, rs.priority, rs.service_name, d.label, rs.estimated_cost;

COMMENT ON VIEW public.v_seoul_intent_to_spending IS
  '★ 이 뷰가 온톨로지의 값어치다. "노트북을 샀다"가 아니라 "웹툰 작가가 되고 싶다 → 그림 배우기 → 태블릿 구입 45만원"으로 읽힌다. 표만 있으면 금액만 보이고, 관계가 있으면 맥락이 보인다.';


-- (2) "어느 영역에 돈이 갔고, 계획에 없던 지출은 어디였나"
CREATE OR REPLACE VIEW public.v_seoul_domain_flow
  WITH (security_invoker = true) AS
SELECT
  u.participant_id,
  COALESCE(d.label, '(영역 미분류)')                        AS 영역,
  count(*)                                                  AS 건수,
  sum(u.amount)                                             AS 금액,
  count(*) FILTER (WHERE u.requested_service_id IS NULL)     AS 계획외_건수,
  sum(u.amount) FILTER (WHERE u.requested_service_id IS NULL) AS 계획외_금액
FROM public.seoul_service_usages u
LEFT JOIN public.seoul_service_domains d ON d.id = u.domain_id
GROUP BY u.participant_id, d.label;


-- =====================================================================
-- §6. 이 방식으로 안 되는 것 (정직하게)
-- =====================================================================
--
-- 1. OWL 추론(reasoner)이 없다.
--    "A가 B의 하위클래스이므로 A는 B의 속성을 상속한다" 같은 자동 추론은
--    PostgreSQL 이 해주지 않는다. 필요하면 뷰나 함수로 직접 써야 한다.
--    → 실무 영향: 낮다. 사례관리에서 필요한 것은 대개 추론이 아니라 경로 탐색이다.
--
-- 2. SPARQL 을 못 쓴다.
--    표준 RDF 질의어 대신 SQL 을 쓴다. 외부 시맨틱 웹 도구와 직접 연동은 안 된다.
--    → 필요해지면 이 뷰를 그대로 트리플로 덤프해 내보내면 된다 (§7 참조).
--
-- 3. 초대형 그래프 탐색은 전용 그래프 DB 가 빠르다.
--    수백만 노드에서 6단계 이상 도는 경우. 다만 한 기관의 사례관리 규모
--    (참여자 수십~수백 명)에서는 재귀 CTE 로 충분하다.
--
-- 4. Apache AGE(PostgreSQL 그래프 확장)는 관리형 Supabase 에서 쓸 수 없다.
--    Supabase 이미지가 Nix 로 빌드되어 런타임 확장 컴파일을 막아 두었기 때문이다.
--    pg_graphql 은 GraphQL API 계층이지 그래프 DB 가 아니다 — 혼동하기 쉬운 지점.
--
-- 5. ★ 뷰는 기본적으로 RLS 를 우회한다. 반드시 걸어야 하는 함정.
--    PostgreSQL 뷰는 기본값이 "뷰 소유자 권한으로 실행"이라, 소유자가 테이블 소유자면
--    하위 테이블의 RLS 가 통째로 무시된다.
--    실제로 이 파일 초안에서 남의 참여자가 다른 사람의 엣지 50개를 전부 조회할 수 있었다.
--    → 모든 뷰에 WITH (security_invoker = true) 를 붙여야 한다. PostgreSQL 15 이상 필요.
--    → 함수도 SECURITY INVOKER 여야 한다. 둘 중 하나만 놓쳐도 새어나간다.
--    이것은 그래프 오버레이만의 문제가 아니라 seoul_schema_draft.sql 의 잔액·정산 뷰에도
--    똑같이 해당한다 (그쪽도 함께 수정했다).
--
-- 반대로 이 방식이라서 얻는 것:
--    · RLS 가 그래프 탐색에도 걸린다 — 단 위 5번을 지켰을 때만.
--      그래도 "정책을 한 번만 쓰면 된다"는 이점은 유효하다.
--      별도 그래프 저장소를 두면 권한 모델을 처음부터 다시 구현하고 계속 동기화해야 한다.
--    · 트랜잭션 하나로 표와 그래프가 함께 커밋된다 (동기화 실패가 불가능)
--    · 백업·복구·마이그레이션이 하나뿐이다
--    · 운영 부담이 늘지 않는다 — 기관에 DBA 가 없다는 점이 결정적이다


-- =====================================================================
-- §7. 필요해지면 RDF 로 내보내기
--     외부 도구(Protégé, GraphDB, Ontology Playground)에 데이터까지 보낼 때
-- =====================================================================

CREATE OR REPLACE FUNCTION public.seoul_export_triples(p_participant_id UUID)
RETURNS TABLE (subject TEXT, predicate TEXT, object TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    'seoul:' || w.s_type || '_' || left(w.s_id::text, 8),
    'seoul:' || w.predicate,
    'seoul:' || w.o_type || '_' || left(w.o_id::text, 8)
  FROM public.seoul_graph_walk(p_participant_id, 8) w;
$$;

COMMENT ON FUNCTION public.seoul_export_triples(UUID) IS
  '한 참여자의 서브그래프를 트리플로 뽑는다. Turtle/RDF-XML 로 감싸면 표준 도구에서 열린다. 즉 "지금은 SQL 로 두고, 필요할 때 RDF 로 나간다"가 가능하다 — 지금 그래프 DB 를 도입할 이유가 없는 이유.';
