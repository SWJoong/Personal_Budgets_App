-- ============================================================================
-- 온톨로지 기반 사례관리 확장 — SQL 스키마 초안 (검토용)
--
-- ⚠️ 이 파일은 검토·논의용 초안입니다. 그대로 실행하지 마세요.
--    확정 후 기관 관례에 따라 supabase/migrations/NN_*.sql 로 분할·번호 부여하여
--    Supabase 대시보드 > SQL Editor 에서 순서대로 수동 실행합니다.
--    (권장 분할: 33_service_resources / 34_restriction_rules / 35_value_nodes /
--     36_graph_edges / 37_budget_cycles / 38_network_entities /
--     39_taxonomies / 40_form_definitions / 41_programs)
--
-- v2 (2026-07-23) 변경: 기관·사업별 서식 이질성 대응
--   · value_nodes.kind 2종 → 8종 확장 (§2)
--   · 어휘 계층 추가 — taxonomies / taxonomy_terms / term_mappings (§11)
--   · 서식 계층 추가 — form_definitions / form_responses (§12)
--   · 사업 계층 추가 — programs, funding_sources.program_id (§13)
--   설계 근거: Plan&Source/서식_이질성_해결방안_v1.md
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
  -- v2 확장: 2종 → 8종. 기관·사업별 서식의 질문이 모두 착지할 수 있어야 하므로.
  --   important_to  : 복지부 "내 삶에서 가장 원하는 것", 아름드리 "나에게 중요한 것"
  --   important_for : 복지부 "변화를 위해 필요한 지원", 아름드리 "나를 위해 중요한 것"
  --   strength      : 서울형 "나의 재능, 강점, 기술"          ← v1에서 착지할 곳이 없었음
  --   dream         : 서울형 "내가 원하는 삶의 모습", "시도하고 싶은 것"
  --   barrier       : 복지부 "가장 불편한 점", 서울형 "장애로 인한 사회적 제한"
  --   communication : ELP 요소 — 어느 공식 서식에도 없으나 발달장애인 지원에 필수
  --   what_works / what_doesnt : ELP "좋은 지원 / 피해야 할 것" (실무자 교체 시 지원 질 유지)
  kind             TEXT NOT NULL CHECK (kind IN (
                     'important_to','important_for','strength','dream',
                     'barrier','communication','what_works','what_doesnt')),
  label            TEXT NOT NULL,                   -- 예: "수영을 계속하고 싶다"
  description      TEXT,
  weight           NUMERIC NOT NULL DEFAULT 1 CHECK (weight BETWEEN 0 AND 5),
  source           TEXT NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual','support_goal_backfill','interview','form_intake','ai_suggested')),
  -- v2: 어느 기관 서식의 어느 질문에서 나왔는지 추적 (예: 'seoul_plan.talents')
  source_form_field TEXT,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  easy_description TEXT,
  easy_image_url   TEXT,
  creator_id       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at       TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.support_goals ADD COLUMN value_node_id UUID REFERENCES public.value_nodes(id) ON DELETE SET NULL;

CREATE INDEX idx_value_nodes_participant ON public.value_nodes (participant_id, kind) WHERE status = 'active';

-- 주의: To/For 균형 지표(§7 v_to_for_balance)는 important_to / important_for 2종만 집계한다.
--       strength·dream 등 나머지 kind는 균형 계산에 포함하지 않되 '삶의 그림' 시각화에는 사용.

-- 백필(초안): is_to_goal → kind='important_to' 1행, is_for_whom → 'important_for' 1행,
--   둘 다 체크면 2행 생성(label=support_area 동일), 생성 id 를 support_goals.value_node_id 에 역기록.
--   검증: value_nodes 행 수 = SUM(is_to_goal::int + is_for_whom::int) (28번 마이그레이션 DO 블록 관례)


-- ────────────────────────────────────────────────────────────────────────────
-- 3. network_entities — 관계 지도 (Relationship Map)
--    사람중심계획의 표준 도구. 4분면으로 나누는 목적은 분류 자체가 아니라
--    "관계의 균형이 깨졌는지(off balance)"를 보기 위함이다.
--    유급 지원자만 남고 무급 관계(가족·친구·지역사회)가 비면 그것이 고립 신호다.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.network_entities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id    UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  -- 관계 지도 4분면 (자유 텍스트 → 코드로 정형화. 집계·균형 지표 산출에 필요)
  relation_category TEXT NOT NULL CHECK (relation_category IN (
                      'family',        -- 가족: 부모·형제자매·조부모·친척
                      'friend',        -- 친구: 친구·이웃 등 스스로 선택한 무급 관계
                      'paid_support',  -- 유급 지원자: 활동지원사·치료사·사회복지사
                      'community')),   -- 직장·학교·지역사회: 동료·선생님·단골 가게 주인
  relation_detail   TEXT,                           -- '어머니','수영 강사','1103동 이웃' 등 구체 관계
  contact           TEXT,
  -- 유급 지원자가 기관 소속 실무자와 동일인이면 여기로 연결 (관계 지도와 계정을 잇는 고리)
  linked_profile_id UUID REFERENCES public.profiles(id),
  -- 관계 지도를 동심원으로 그릴 때 당사자로부터의 거리. 4분면(누구인가) × 동심원(얼마나 가까운가)
  closeness         SMALLINT CHECK (closeness BETWEEN 1 AND 4),
  contact_frequency TEXT,                           -- '주 1회','월 1회','연 2~3회' 등
  last_contact_date DATE,                           -- 관계 소멸 감지의 입력값
  notes             TEXT,
  easy_image_url    TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_network_entities_participant
  ON public.network_entities (participant_id, relation_category) WHERE is_active;

-- 분면 구성의 유연성에 대한 주석:
--   PCP 문헌은 4분면이 고정이 아니라 당사자에 맞게 조정 가능하다고 본다
--   (유급 지원이 없는 사람에게는 '동료·동급생' 분면이 더 적합할 수 있음).
--   초기에는 위 4종 CHECK 로 고정하고, 기관별 조정 요구가 실제로 발생하면
--   §11 어휘 계층에 'relationship_map' 분류체계로 옮긴다.


-- ────────────────────────────────────────────────────────────────────────────
-- 3-1. v_relationship_map — 관계 균형 지표
--      관계 지도의 본래 목적("off balance" 확인)을 그대로 지표화한 것
-- ────────────────────────────────────────────────────────────────────────────
CREATE VIEW public.v_relationship_map AS
SELECT
  p.id AS participant_id,
  COUNT(ne.id) FILTER (WHERE ne.relation_category = 'family')       AS family_count,
  COUNT(ne.id) FILTER (WHERE ne.relation_category = 'friend')       AS friend_count,
  COUNT(ne.id) FILTER (WHERE ne.relation_category = 'paid_support') AS paid_count,
  COUNT(ne.id) FILTER (WHERE ne.relation_category = 'community')    AS community_count,
  COUNT(ne.id)                                                      AS total_count,
  -- 무급 관계 비율: 낮을수록 "삶에 돈 받고 오는 사람만 있다" = 고립 위험
  CASE WHEN COUNT(ne.id) > 0
       THEN ROUND(COUNT(ne.id) FILTER (WHERE ne.relation_category <> 'paid_support')::NUMERIC
                  / COUNT(ne.id), 2) END                            AS unpaid_ratio,
  -- 최근 90일 내 접촉이 있었던 무급 관계 수 (살아 있는 관계)
  COUNT(ne.id) FILTER (WHERE ne.relation_category <> 'paid_support'
                         AND ne.last_contact_date >= CURRENT_DATE - 90) AS active_unpaid_count
FROM public.participants p
LEFT JOIN public.network_entities ne ON ne.participant_id = p.id AND ne.is_active
GROUP BY p.id;

-- 알림 판정(초안): friend_count = 0 → "친구 분면이 비어 있음"
--                  unpaid_ratio < 0.4 → "유급 관계 편중"
--                  active_unpaid_count 가 직전 분기 대비 감소 → "관계 소멸 진행 중"
-- ⚠️ 이 지표는 실무자에게 보여 주는 것이지 당사자를 평가하는 점수가 아니다.
--    당사자 화면에는 숫자 대신 '나의 사람들' 그림으로만 표시한다.


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


-- ============================================================================
-- [v2 추가] 기관·사업별 서식 이질성 대응 — 어휘 계층 / 서식 계층 / 사업 계층
--   배경: 보건복지부형·서울형·기관 자체 ISP의 구조와 지원영역 분류가 모두 다름.
--   원칙: 서식을 통일하지 않는다. 의미를 통일하고 서식은 그 위의 투영으로 만든다.
--   상세: Plan&Source/서식_이질성_해결방안_v1.md
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 11. 어휘 계층 — taxonomies / taxonomy_terms / term_mappings
--     국내에 사례관리 욕구분류의 단일 표준이 부재하므로
--     "표준 하나 채택"이 아니라 "복수 체계 등록 + 상호 매핑"으로 간다.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.taxonomies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,        -- 'mohw_2024' | 'sis_a' | 'gyeonggi_5' | 'org_custom'
  name       TEXT NOT NULL,
  source     TEXT,                        -- '보건복지부' | 'AAIDD' | '경기도' | '기관 자체'
  version    TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE public.taxonomy_terms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_id      UUID NOT NULL REFERENCES public.taxonomies(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,
  label            TEXT NOT NULL,
  parent_id        UUID REFERENCES public.taxonomy_terms(id) ON DELETE CASCADE,  -- 대분류→중분류
  order_index      SMALLINT DEFAULT 1,
  easy_description TEXT,
  easy_image_url   TEXT,
  UNIQUE (taxonomy_id, code)
);

CREATE INDEX idx_taxonomy_terms_parent ON public.taxonomy_terms (taxonomy_id, parent_id, order_index);

CREATE TABLE public.term_mappings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_term_id UUID NOT NULL REFERENCES public.taxonomy_terms(id) ON DELETE CASCADE,
  to_term_id   UUID NOT NULL REFERENCES public.taxonomy_terms(id) ON DELETE CASCADE,
  relation     TEXT NOT NULL CHECK (relation IN ('exact','broader','narrower','related')),
  note         TEXT,
  creator_id   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (from_term_id, to_term_id)
);

-- 기존 자유 텍스트는 원문 보존용으로 유지하고, 코드 참조를 나란히 추가 (파괴적 변경 없음)
ALTER TABLE public.support_goals     ADD COLUMN support_area_term_id UUID REFERENCES public.taxonomy_terms(id) ON DELETE SET NULL;
ALTER TABLE public.service_resources ADD COLUMN category_term_id     UUID REFERENCES public.taxonomy_terms(id) ON DELETE SET NULL;
ALTER TABLE public.budget_line_items ADD COLUMN category_term_id     UUID REFERENCES public.taxonomy_terms(id) ON DELETE SET NULL;

-- 시드 예시 (초안) ─ 보건복지부 8대분류
--   INSERT INTO taxonomies (code, name, source, version)
--     VALUES ('mohw_2024', '보건복지부 개인예산 지원영역', '보건복지부', '2024');
--   대분류: 신체적 건강 / 정신적 건강 / 주거 / 일상생활 / 일자리 /
--           법률 및 권익보장 / 문화 및 여가(사회참여) / 바우처 유연화
--   중분류 예: 신체적 건강 → 건강증진 · 재활 · 장애인보조기기 · 의료용 소모품 · 기타 건강지원 제품
--
-- 시드 예시 (초안) ─ SIS-A 8영역 (아름드리 ISP가 사용)
--   INSERT INTO taxonomies (code, name, source) VALUES ('sis_a', 'SIS-A 지원요구 영역', 'AAIDD');
--   고용 활동 / 평생학습 활동 / 가정생활 활동 / 건강 및 안전 활동 /
--   사회 활동 / 지역사회생활 활동 / 보호 및 권리주장 활동 / 행동 지원요구
--
-- crosswalk 예시 (초안)
--   sis_a:'건강 및 안전 활동'  --broader-->  mohw_2024:'신체적 건강'
--   sis_a:'건강 및 안전 활동'  --related-->  mohw_2024:'정신적 건강'
--   sis_a:'사회 활동'          --exact  -->  mohw_2024:'문화 및 여가(사회참여)'
--   sis_a:'고용 활동'          --exact  -->  mohw_2024:'일자리'
--   ⚠️ 매핑은 1:1이 아니며 손실이 발생한다. relation 으로 손실 방향을 명시하고,
--      집계·비교 시 exact 만 쓸지 broader 까지 포함할지 보고서마다 선택하게 한다.


-- ────────────────────────────────────────────────────────────────────────────
-- 12. 서식 계층 — form_definitions / form_responses
--     서식 1개 = TS 인터페이스 1개 + React 컴포넌트 1개 였던 구조를
--     서식 1개 = JSON 정의 1건 + 공용 렌더러 로 바꾼다.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.form_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL,               -- 'mohw_plan' | 'seoul_plan' | 'armdeuri_isp' ...
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('care_plan','evaluation','application','settlement')),
  version     TEXT NOT NULL DEFAULT '1',
  program_id  UUID,                        -- §13 programs (사업이 요구하는 서식)
  taxonomy_id UUID REFERENCES public.taxonomies(id) ON DELETE SET NULL,  -- matrix 필드가 참조
  schema      JSONB NOT NULL,              -- 아래 구조 참조
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (code, version)
);

-- schema JSONB 구조 (초안)
-- {
--   "sections": [
--     { "id": "s3", "number": "3", "title": "현재 일상생활",
--       "fields": [
--         { "id": "daily_routine", "type": "textarea", "label": "내가 하루를 보내는 방식은?" },
--         { "id": "life_wish",     "type": "textarea", "label": "내가 내 삶에서 가장 원하는 것은?",
--           "bind": { "target": "value_node", "kind": "important_to" } },
--         { "id": "key_people",    "type": "textarea", "label": "가장 자주 만나는 사람은?",
--           "bind": { "target": "network_entity" } },
--         { "id": "difficulty",    "type": "textarea", "label": "가장 불편한 점은?",
--           "bind": { "target": "value_node", "kind": "barrier" } }
--       ] },
--     { "id": "s4", "number": "4", "title": "개인예산 지원영역 욕구사정",
--       "fields": [
--         { "id": "needs", "type": "matrix", "taxonomy": "mohw_2024",
--           "columns": [ { "id": "limit", "label": "제한점" },
--                        { "id": "need",  "label": "욕구와 희망" } ],
--           "bind": { "target": "value_node", "kind": "important_to", "valueColumn": "need",
--                     "termFrom": "row" } }
--       ] },
--     { "id": "s5", "number": "5", "title": "개인예산 이용계획",
--       "fields": [
--         { "id": "service_plan", "type": "table",
--           "columns": [ {"id":"major","label":"대분류"}, {"id":"minor","label":"중분류"},
--                        {"id":"service","label":"서비스 내용"}, {"id":"count","label":"횟수"},
--                        {"id":"hours","label":"시간"}, {"id":"provider","label":"지원인력/기관"},
--                        {"id":"start","label":"시작일","type":"date"},
--                        {"id":"end","label":"종료일","type":"date"},
--                        {"id":"price_type","label":"가격유형"},
--                        {"id":"alloc","label":"할당예산","type":"number"},
--                        {"id":"total","label":"총예산","type":"number"} ],
--           "bind": { "target": "budget_line_item" } },
--         { "id": "deduction_rate", "type": "radio",
--           "label": "차감 이용비율", "options": ["변동없음","10%","15%","20%"] }
--           /* bind 없음 → form_responses.extras 에 원본 보존 */
--       ] }
--   ]
-- }
--
-- 필드 type: text | textarea | boolean | radio | checkbox | date | number
--            | table | matrix | signature
-- bind.target: value_node | network_entity | support_goal | budget_line_item
--              | service_resource | participant_profile
-- ⚠️ bind 가 없는 필드는 의미 계층에 착지하지 않는다 = 온톨로지를 오염시키지 않는다.
--    대신 form_responses.extras 에 원본 그대로 남겨 손실 없이 서식을 재출력할 수 있게 한다.

CREATE TABLE public.form_responses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id     UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  form_definition_id UUID NOT NULL REFERENCES public.form_definitions(id) ON DELETE RESTRICT,
  cycle_id           UUID,                 -- §8 budget_cycles
  care_plan_id       UUID REFERENCES public.care_plans(id) ON DELETE SET NULL,  -- 기존 문서와 연결
  -- 의미 계층에 매핑되지 않는 서식 고유 필드의 원본 (접수번호·동의 서명·차감비율·가족사항 표 등)
  extras             JSONB NOT NULL DEFAULT '{}',
  submitted_at       TIMESTAMPTZ,
  creator_id         UUID REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at         TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_form_responses_participant ON public.form_responses (participant_id, form_definition_id);

-- 기존 care_plans 와의 관계 (초안)
--   care_plans.plan_type TEXT ('mohw_plan'|'seoul_plan') 는 CHECK 제약이 없으므로
--   form_definitions.code 와 자연스럽게 대응된다. 이관 경로:
--     1) 기존 2개 서식을 JSON 정의로 옮겨 form_definitions 에 등록 (코드 변경 없이 병행 가능)
--     2) care_plans.content JSONB 를 bind 규칙에 따라 의미 계층 + form_responses.extras 로 분해
--     3) 출력 렌더러를 먼저 붙이고(현재 인쇄 경로 자체가 없음), 입력 화면은 그 다음에 교체


-- ────────────────────────────────────────────────────────────────────────────
-- 13. 사업 계층 — programs
--     한 당사자가 복수 사업에 동시 참여하는 것은 이미 현실이다.
--     (000 개별지원계획서: 아산사회복지재단 사업 920,000원 + 기관 예산 580,000원)
--     기존 funding_sources 가 다중 재원을 이미 지원하므로 여기에 사업을 바인딩한다.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.programs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL UNIQUE,     -- 'mohw_pilot' | 'seoul_pilot' | 'asan_grant' | 'org_own'
  name           TEXT NOT NULL,
  operator       TEXT,                     -- 보건복지부 | 서울시 | 아산사회복지재단 | 기관 자체
  taxonomy_id    UUID REFERENCES public.taxonomies(id) ON DELETE SET NULL,
  budget_ceiling NUMERIC,                  -- 예: 서울형 2,400,000 / 월 400,000
  period_start   DATE,
  period_end     DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.funding_sources    ADD COLUMN program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;
ALTER TABLE public.restriction_rules  ADD COLUMN program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;
ALTER TABLE public.form_definitions
  ADD CONSTRAINT form_definitions_program_id_fkey
  FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL;

-- 효과
--   · 사업마다 다른 용처 제한이 자동 적용된다
--     (경기 기회소득 5영역 허용 vs 복지부 주류·담배 배제 vs 재단 사업 자체 기준)
--   · 룰 엔진(§4)의 scope 가 global | participant 에 더해 사실상 program 단위로 확장된다
--     → f_check_transaction_rules() 는 거래의 funding_source_id → program_id 를 따라가
--       해당 사업 규칙만 평가한다
--   · 정산·성과 보고를 사업별로 분리 산출할 수 있다 (재원별 잔액은 이미 funding_sources 가 관리)


-- ────────────────────────────────────────────────────────────────────────────
-- 14. [v2] RLS — 신규 5개 테이블
-- ────────────────────────────────────────────────────────────────────────────
-- taxonomies / taxonomy_terms / term_mappings / form_definitions / programs
--   → 기관 공통 마스터 데이터: SELECT 는 authenticated 전원, 쓰기는 admin 만
--     (system_settings 의 20번 마이그레이션 패턴과 동일)
-- form_responses
--   → 당사자 개인 데이터: SELECT 는 is_self(participant_id) OR is_staff(),
--     쓰기는 is_staff() — §9 헬퍼 3종 재사용
