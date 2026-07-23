-- ============================================================================
-- 온톨로지 기반 사례관리 확장 — SQL 스키마 초안 (검토용)
--
-- ⚠️ 이 파일은 검토·논의용 초안입니다. 그대로 실행하지 마세요.
--    확정 후 기관 관례에 따라 supabase/migrations/NN_*.sql 로 분할·번호 부여하여
--    Supabase 대시보드 > SQL Editor 에서 순서대로 수동 실행합니다.
--    (권장 분할: 33_service_resources / 34_restriction_rules / 35_value_nodes /
--     36_graph_edges / 37_budget_cycles / 38_network_entities)
--
-- 설계 원칙
--   1. 전부 추가형(additive) — 기존 테이블·화면·잔액 트리거를 깨지 않는다.
--   2. FK로 표현 가능한 관계는 graph_edges 에 물리 저장하지 않는다.
--      그래프 "읽기"는 v_graph_edges 파생 뷰가 정본 (이중 기록 금지).
--   3. 모든 신규 테이블에 RLS + easy_description/easy_image_url (Easy Read 관례).
--   4. 룰 엔진은 자동 거절이 아니라 "실무자 검토 플래그" — 자기결정권 존중.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. service_resources — 서비스 자원·용처 (Service_Resource 클래스)
--    transactions.place_name TEXT 의 엔티티 승격
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.service_resources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category         TEXT,                            -- '카페','수영장','병원','교통' ...
  kakao_place_id   TEXT,                            -- 카카오 로컬 API 장소 ID (중복 병합 키)
  address          TEXT,
  lat              NUMERIC(10,7),
  lng              NUMERIC(10,7),
  phone            TEXT,
  is_verified      BOOLEAN NOT NULL DEFAULT FALSE,  -- 실무자 확인 여부
  risk_tags        TEXT[] NOT NULL DEFAULT '{}',    -- '주류','사행성' 등 → 룰 엔진 참조
  easy_description TEXT,
  easy_image_url   TEXT,
  creator_id       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at       TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE NULLS NOT DISTINCT (kakao_place_id)
);

ALTER TABLE public.transactions      ADD COLUMN service_resource_id UUID REFERENCES public.service_resources(id) ON DELETE SET NULL;
ALTER TABLE public.monthly_plans     ADD COLUMN service_resource_id UUID REFERENCES public.service_resources(id) ON DELETE SET NULL;
ALTER TABLE public.budget_line_items ADD COLUMN service_resource_id UUID REFERENCES public.service_resources(id) ON DELETE SET NULL;

CREATE INDEX idx_tx_service_resource ON public.transactions (service_resource_id);

-- 백필(초안): 기존 place_name 을 자원으로 승격 후 역연결
--   1) INSERT INTO service_resources (name, lat, lng)
--        SELECT DISTINCT place_name, place_lat, place_lng FROM transactions WHERE place_name IS NOT NULL;
--   2) UPDATE transactions t SET service_resource_id = sr.id
--        FROM service_resources sr WHERE sr.name = t.place_name;
--   검증: SELECT count(*) FROM transactions WHERE place_name IS NOT NULL AND service_resource_id IS NULL; -- 0 이어야 함


-- ────────────────────────────────────────────────────────────────────────────
-- 2. value_nodes — 가치·욕구 노드 (Value_Node 클래스, To/For 하위클래스)
--    support_goals.is_to_goal / is_for_whom 불리언의 독립 엔티티 승격
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.value_nodes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id   UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('important_to','important_for')),
  label            TEXT NOT NULL,                   -- 예: "수영을 계속하고 싶다"
  description      TEXT,
  weight           NUMERIC NOT NULL DEFAULT 1 CHECK (weight BETWEEN 0 AND 5),
  source           TEXT NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual','support_goal_backfill','interview','ai_suggested')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  easy_description TEXT,
  easy_image_url   TEXT,
  creator_id       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at       TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.support_goals ADD COLUMN value_node_id UUID REFERENCES public.value_nodes(id) ON DELETE SET NULL;

CREATE INDEX idx_value_nodes_participant ON public.value_nodes (participant_id, kind) WHERE status = 'active';

-- 백필(초안): is_to_goal → kind='important_to' 1행, is_for_whom → 'important_for' 1행,
--   둘 다 체크면 2행 생성(label=support_area 동일), 생성 id 를 support_goals.value_node_id 에 역기록.
--   검증: value_nodes 행 수 = SUM(is_to_goal::int + is_for_whom::int) (28번 마이그레이션 DO 블록 관례)


-- ────────────────────────────────────────────────────────────────────────────
-- 3. network_entities — 지역사회 관계망 (Network_Entity 클래스)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.network_entities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id    UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  relation_type     TEXT NOT NULL,                  -- '가족','이웃','친구','동료','기타'
  contact           TEXT,
  linked_profile_id UUID REFERENCES public.profiles(id),  -- 향후 계정 연결 대비
  notes             TEXT,
  easy_image_url    TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_network_entities_participant ON public.network_entities (participant_id) WHERE is_active;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. restriction_rules + rule_violations — 제한 규칙과 룰 엔진 (Restriction_Rule)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.restriction_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope          TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global','participant')),
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,  -- scope='participant'일 때만
  name           TEXT NOT NULL,
  rule_type      TEXT NOT NULL CHECK (rule_type IN
                   ('keyword_block',          -- {"keywords":["주점","복권"],"fields":["activity_name","place_name","memo"]}
                    'category_block',         -- {"categories":["유흥"]}
                    'amount_limit_per_tx',    -- {"max_amount":100000}
                    'monthly_category_limit', -- {"category":"간식","max_total":50000}
                    'resource_risk_tag',      -- {"tags":["주류","사행성"]}
                    'frequency_limit')),      -- {"category":"게임","max_count_per_month":4}
  params         JSONB NOT NULL DEFAULT '{}',
  severity       TEXT NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','block')),
  easy_message   TEXT,                             -- 당사자용 비낙인 문구: "이 지출은 선생님과 같이 확인해요"
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from     DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to       DATE,
  creator_id     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE public.rule_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  rule_id         UUID NOT NULL REFERENCES public.restriction_rules(id) ON DELETE CASCADE,
  matched_detail  TEXT,                            -- 어떤 키워드·한도가 걸렸는지
  severity        TEXT NOT NULL,                   -- 평가 시점 severity 스냅샷
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','upheld')),
  resolved_by     UUID REFERENCES public.profiles(id),
  resolution_note TEXT,                            -- 기각·확정 사유 (감사 추적)
  created_at      TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (transaction_id, rule_id)
);

CREATE INDEX idx_rule_violations_open ON public.rule_violations (transaction_id) WHERE status = 'open';

-- 룰 엔진 골격(초안): 단일 정본 함수 + 트리거(모든 유입 경로 커버) + RPC(등록 폼 사전 경고)
CREATE OR REPLACE FUNCTION public.f_check_transaction_rules(p_tx_id UUID)
RETURNS SETOF public.rule_violations AS $$
BEGIN
  -- 초안: rule_type 별 판정 로직 구현 지점
  --   keyword_block          : activity_name/place_name/memo ILIKE ANY(keywords)
  --   category_block         : category = ANY(categories)
  --   amount_limit_per_tx    : amount > max_amount
  --   monthly_category_limit : 당월 (pending+confirmed) 합산 > max_total
  --   resource_risk_tag      : service_resources.risk_tags && tags
  --   frequency_limit        : 당월 건수 > max_count_per_month
  -- 매칭 시 rule_violations UPSERT 후 반환
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거(초안): AFTER INSERT OR UPDATE ON transactions → f_check_transaction_rules 호출
-- 이름 관례: trg_20_rules (기존 잔액 트리거는 trg_10_balance 로 개명해 실행 순서 명시)
-- confirm 게이트(초안): BEFORE UPDATE 에서 status pending→confirmed 전이 시
--   severity='block' AND status='open' 인 위반이 있으면 RAISE EXCEPTION
--   (실무자가 dismissed 처리하면 승인 가능 — 자동 거절 없음)


-- ────────────────────────────────────────────────────────────────────────────
-- 5. graph_edges — 물리 엣지 (FK로 표현 불가능한 관계 전용)
--    예: Network_Entity 접촉 기록, AI 추천 관계, 실험적 관계 유형
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.graph_edges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL,
  subject_id   UUID NOT NULL,
  predicate    TEXT NOT NULL,
  object_type  TEXT NOT NULL,
  object_id    UUID NOT NULL,
  weight       NUMERIC NOT NULL DEFAULT 1,
  props        JSONB NOT NULL DEFAULT '{}',
  source       TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','system','ai')),
  valid_from   DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to     DATE,                               -- 삭제 대신 종료(soft close) — 관계 소멸 이력 보존
  creator_id   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  CHECK (subject_type IN ('person','supporter','value_node','network_entity',
                          'service_resource','budget_plan','transaction','restriction_rule')),
  CHECK (object_type  IN ('person','supporter','value_node','network_entity',
                          'service_resource','budget_plan','transaction','restriction_rule'))
);

CREATE INDEX idx_edges_subject ON public.graph_edges (subject_type, subject_id, predicate) WHERE valid_to IS NULL;
CREATE INDEX idx_edges_object  ON public.graph_edges (object_type, object_id, predicate)  WHERE valid_to IS NULL;
-- 폴리모픽 무결성(초안): endpoint 존재 검증 트리거 + 각 엔티티 삭제 시 valid_to 마감 트리거


-- ────────────────────────────────────────────────────────────────────────────
-- 6. v_graph_edges — 그래프 읽기 정본 (파생 뷰: 이중 기록 금지 원칙)
--    리서치 보고서의 트리플 표 9개 관계를 전부 제공
-- ────────────────────────────────────────────────────────────────────────────
CREATE VIEW public.v_graph_edges AS
  -- 물리 엣지 (reports_status_of, AI 추천 등)
  SELECT subject_type, subject_id, predicate, object_type, object_id, weight, props
  FROM public.graph_edges WHERE valid_to IS NULL
UNION ALL  -- Person → Value (has_important_to / requires_important_for)
  SELECT 'person', vn.participant_id,
         CASE vn.kind WHEN 'important_to' THEN 'has_important_to' ELSE 'requires_important_for' END,
         'value_node', vn.id, vn.weight, '{}'::jsonb
  FROM public.value_nodes vn WHERE vn.status = 'active'
UNION ALL  -- Value → Budget_Plan (is_addressed_by)
  SELECT 'value_node', sg.value_node_id, 'is_addressed_by', 'budget_plan', sg.care_plan_id,
         1, jsonb_build_object('support_goal_id', sg.id)
  FROM public.support_goals sg WHERE sg.value_node_id IS NOT NULL AND sg.is_active
UNION ALL  -- Budget_Plan → Service_Resource (allocates_funds_to, 배정액이 가중치)
  SELECT 'budget_plan', bli.care_plan_id, 'allocates_funds_to', 'service_resource',
         bli.service_resource_id, bli.total_amount, jsonb_build_object('line_item_id', bli.id)
  FROM public.budget_line_items bli WHERE bli.service_resource_id IS NOT NULL
UNION ALL  -- Person → Transaction (makes_transaction)
  SELECT 'person', t.participant_id, 'makes_transaction', 'transaction', t.id,
         t.amount, jsonb_build_object('status', t.status, 'date', t.date)
  FROM public.transactions t
UNION ALL  -- Transaction → Service_Resource (is_spent_at)
  SELECT 'transaction', t.id, 'is_spent_at', 'service_resource', t.service_resource_id,
         t.amount, '{}'::jsonb
  FROM public.transactions t WHERE t.service_resource_id IS NOT NULL
UNION ALL  -- Transaction → Restriction_Rule (violates_rule, 조건부)
  SELECT 'transaction', rv.transaction_id, 'violates_rule', 'restriction_rule', rv.rule_id,
         1, jsonb_build_object('status', rv.status)
  FROM public.rule_violations rv WHERE rv.status <> 'dismissed'
UNION ALL  -- Supporter → Person (facilitates_plan_for)
  SELECT 'supporter', p.assigned_supporter_id, 'facilitates_plan_for', 'person', p.id, 1, '{}'::jsonb
  FROM public.participants p WHERE p.assigned_supporter_id IS NOT NULL
UNION ALL  -- Network_Entity → Person (reports_status_of)
  SELECT 'network_entity', ne.id, 'reports_status_of', 'person', ne.participant_id, 1, '{}'::jsonb
  FROM public.network_entities ne WHERE ne.is_active;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. v_to_for_balance — To/For 균형 추적 (2층위: 가치 선언 + 예산 배분)
-- ────────────────────────────────────────────────────────────────────────────
CREATE VIEW public.v_to_for_balance AS
SELECT
  p.id AS participant_id,
  COUNT(vn.id) FILTER (WHERE vn.kind = 'important_to')  AS to_count,
  COUNT(vn.id) FILTER (WHERE vn.kind = 'important_for') AS for_count,
  COALESCE(SUM(vn.weight) FILTER (WHERE vn.kind = 'important_to'), 0)  AS to_weight,
  COALESCE(SUM(vn.weight) FILTER (WHERE vn.kind = 'important_for'), 0) AS for_weight,
  -- 배분 층위: 가치 → 목표 → 예산세목 배정액 합 (선언은 균형이어도 돈이 전부 For로 갈 수 있음)
  COALESCE(SUM(bli.total_amount) FILTER (WHERE vn.kind = 'important_to'), 0)  AS to_allocated,
  COALESCE(SUM(bli.total_amount) FILTER (WHERE vn.kind = 'important_for'), 0) AS for_allocated,
  -- 균형지수: -1(전부 For) ~ +1(전부 To)
  CASE WHEN SUM(vn.weight) > 0
       THEN ROUND((SUM(vn.weight) FILTER (WHERE vn.kind = 'important_to')
                 - SUM(vn.weight) FILTER (WHERE vn.kind = 'important_for'))
                 / SUM(vn.weight), 2) END AS balance_index,
  COUNT(vn.id) FILTER (WHERE sg.id IS NULL) AS unaddressed_count   -- 계획 미연결 가치 수
FROM public.participants p
LEFT JOIN public.value_nodes vn  ON vn.participant_id = p.id AND vn.status = 'active'
LEFT JOIN public.support_goals sg ON sg.value_node_id = vn.id AND sg.is_active
LEFT JOIN public.budget_line_items bli ON bli.support_goal_id = sg.id
GROUP BY p.id;

-- 알림 판정(초안): (to_count+for_count) >= 4 AND |balance_index| > 0.4 → 불균형 알림
--                 unaddressed_count > 0 → "계획에 연결되지 않은 가치" 알림


-- ────────────────────────────────────────────────────────────────────────────
-- 8. budget_cycles + budget_cycle_events — 개인예산제 7단계 워크플로
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.budget_cycles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id   UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  cycle_year       INTEGER NOT NULL,
  stage            TEXT NOT NULL DEFAULT 'application' CHECK (stage IN
                     ('application',            -- 1. 신청·접수
                      'needs_assessment',       -- 2. 지원 욕구 상담 (To/For 도출)
                      'planning',               -- 3. 개인예산 계획서 작성
                      'review_approval',        -- 4. 심의·승인
                      'disbursement',           -- 5. 예산 지급
                      'execution_monitoring',   -- 6. 집행·모니터링
                      'settlement_evaluation')),-- 7. 정산·성과 평가
  care_plan_id     UUID REFERENCES public.care_plans(id) ON DELETE SET NULL,
  stage_updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  created_at       TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (participant_id, cycle_year)
);

CREATE TABLE public.budget_cycle_events (        -- 상태 전이 이력 = 감사 추적
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id    UUID NOT NULL REFERENCES public.budget_cycles(id) ON DELETE CASCADE,
  from_stage  TEXT,
  to_stage    TEXT NOT NULL,
  actor_id    UUID REFERENCES public.profiles(id),
  note        TEXT,                              -- 심의 의견·반려 사유
  occurred_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 전이 규칙(초안): 순방향 1단계 + 반려 역행(review_approval→planning,
--   settlement_evaluation→execution_monitoring)만 허용 — BEFORE UPDATE 트리거로 강제
-- 백필(초안): 당사자×연도별 care_plans 존재 시 사이클 생성,
--   현재 연도+confirmed 거래 있음 → execution_monitoring / 과거 연도 → settlement_evaluation


-- ────────────────────────────────────────────────────────────────────────────
-- 9. RLS 정책 (초안 — 전 신규 테이블 공통 패턴)
--    헬퍼 3종으로 통일해 기존 정책의 EXISTS 서브쿼리 반복·신구 이원화를 정리
-- ────────────────────────────────────────────────────────────────────────────
-- CREATE FUNCTION public.is_staff() RETURNS BOOLEAN            -- admin/supporter 여부
--   LANGUAGE sql STABLE SECURITY DEFINER;
-- CREATE FUNCTION public.is_self(pid UUID) RETURNS BOOLEAN     -- 당사자 본인 여부
-- CREATE FUNCTION public.is_assigned(pid UUID) RETURNS BOOLEAN -- 담당 실무자 여부 (서브그래프 제어)
--
-- 공통 패턴:
--   SELECT: is_self(participant_id) OR is_staff()
--     (2차 고도화: is_staff() → is_assigned(participant_id) OR is_admin() 로 좁혀
--      리서치 7.1의 "담당자 서브그래프 접근 제어" 충족)
--   INSERT/UPDATE/DELETE: is_staff() (당사자 쓰기 필요 화면은 개별 정책 추가)
--   restriction_rules(global 행): SELECT 는 인증 사용자 전체, 쓰기는 admin 만
--
-- ⚠️ 데모 모드(NEXT_PUBLIC_DEMO_MODE=true)는 service-role 클라이언트로 RLS를 우회하므로
--    위 정책은 실모드에서만 유효 — 검증은 반드시 실모드에서 수행


-- ────────────────────────────────────────────────────────────────────────────
-- 10. (야간 배치) mv_graph_metrics — SNA·고립 위험 지표 (초안)
-- ────────────────────────────────────────────────────────────────────────────
-- CREATE MATERIALIZED VIEW public.mv_graph_metrics AS
--   SELECT participant_id,
--          활성 network_entities 수, 최근 90일 접촉 엣지 수,
--          최근 90일 거래-자원 다양도(방문 자원 distinct 수),
--          직전 90일 대비 감소율 ...
--   FROM v_graph_edges ...;
-- pg_cron 으로 야간 REFRESH — 그래프 연산이 화면 응답에 개입하지 않도록 분리
