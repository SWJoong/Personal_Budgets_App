-- =====================================================================
-- 03. 서울형 스키마 — 26 테이블 / 5 트리거 / 7 뷰 / 14 인덱스
--
-- 원본: Plan&Source/ontology/seoul/seoul_schema_draft.sql (§1~§13, §15)
-- 대응 온톨로지: Plan&Source/ontology/seoul/seoul_ontology.rdf
-- 설계 근거: Plan&Source/서울형_온톨로지_설계_v1.md
--
-- 이 파일은 재실행 가능합니다(CREATE TABLE/INDEX IF NOT EXISTS, 트리거는
-- DROP 후 재생성, 시드는 ON CONFLICT DO NOTHING). RLS는 02_core_rls.sql 이
-- 정의한 seoul_is_admin()/seoul_can_access()/seoul_is_staff_for() 를 04_seoul_rls.sql
-- 에서 참조합니다 — 이 파일 자체에는 RLS 정책이 없습니다.
--
-- 설계 전제 세 가지
-- 1. 프로그램 모듈 분리 — 모든 테이블에 seoul_ 접두어. 공유하는 것은
--    profiles / participants 둘뿐이다 (01_core.sql).
-- 2. 제도 파라미터는 상수가 아니라 데이터 — seoul_cohorts 행으로 둔다.
-- 3. 잔액은 저장하지 않는다 — 항상 뷰(§13)에서 계산한다.
-- =====================================================================


-- =====================================================================
-- §1. 차수와 제도 파라미터
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_cohorts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL UNIQUE,          -- '2024_1', '2025_2', '2026_3'
  name                 TEXT NOT NULL,
  period_months        INT  NOT NULL,                 -- 확인된 자료: 6
  monthly_ceiling      NUMERIC(12,2) NOT NULL,        -- 확인된 자료: 400,000 (2025년 40~50만)
  total_ceiling        NUMERIC(12,2) NOT NULL,        -- 확인된 자료: 2,400,000
  -- 월 미사용액 이월 — 3차(2026) 모집 안내문 기준으로 TRUE 가 제도와 맞는다.
  --   근거 ①: 안내문이 한도를 "총 240만원 한도 내에서"로만 적고 월 상한을 쓰지 않는다.
  --   근거 ②: 같은 안내문 Q3 — "개인예산은 참여자에게 현금으로 지급되지 않습니다.
  --           수행기관인 한국장애인재단에서 서비스 제공기관(인)에 비용을 대신 지급합니다."
  --           월별로 지급되는 돈이 없으므로 "이번 달 미사용액을 다음 달로 넘긴다"는
  --           개념 자체가 성립하지 않는다. 총액 한도를 차감해 나가는 구조다.
  --   따라서 "월 40만원 × 6개월"(2차 언론보도)은 총액 산정 산식이지 집행 상한이 아니다.
  --    TRUE  = 총액만 강제, 월 초과는 경고만  (3차 기준 기본값)
  --    FALSE = 월 한도도 하드 차단 (월별 지급 방식으로 바뀌는 차수가 생기면 사용)
  carry_over_allowed   BOOLEAN NOT NULL DEFAULT TRUE,
  -- 본인부담금 — 3차(2026)에 신설. 1·2차에는 없었으므로 기본값 0 이다.
  --   3차 안내문: "기초생활수급자·차상위계층 본인부담금 없음(0원) /
  --                그 외 참여자 지원액의 10%(최대 24만 원)"
  --   승인금액(allocated_amount)에 rate 를 곱하고 max 로 자른다. 산정은
  --   seoul_set_copay() 트리거가 하며 결과는 배정 행에 고정된다(§9 참조).
  copay_rate           NUMERIC(5,4)  NOT NULL DEFAULT 0,   -- 3차: 0.10
  copay_max            NUMERIC(12,2),                      -- 3차: 240000. NULL = 상한 없음
  appeal_due_days      INT  NOT NULL DEFAULT 14,      -- ⚠️ 서울형 적용 여부 확인 필요
  starts_on            DATE,
  ends_on              DATE,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 이미 배포된 DB 를 위한 추가 (재실행 안전)
ALTER TABLE public.seoul_cohorts ADD COLUMN IF NOT EXISTS copay_rate NUMERIC(5,4) NOT NULL DEFAULT 0;
ALTER TABLE public.seoul_cohorts ADD COLUMN IF NOT EXISTS copay_max  NUMERIC(12,2);

COMMENT ON TABLE  public.seoul_cohorts IS '시범사업 차수별 제도 파라미터. 금액·기간·기한을 코드가 아닌 데이터로 둔다.';
COMMENT ON COLUMN public.seoul_cohorts.carry_over_allowed IS
  '3차 안내문 기준 TRUE 가 제도와 일치(현금 월별 지급이 아니라 총액 차감 구조). 월별 지급 차수가 생기면 FALSE.';
COMMENT ON COLUMN public.seoul_cohorts.copay_rate IS '본인부담률. 3차 0.10, 1·2차 0(제도에 없었음).';
COMMENT ON COLUMN public.seoul_cohorts.copay_max  IS '본인부담금 상한. 3차 240000. NULL 이면 상한 없음.';


-- =====================================================================
-- §2. 서비스 영역 (제도가 확정한 6종)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_service_domains (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  description  TEXT,
  sort_order   INT  NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.seoul_service_domains IS
  '서울형이 정한 6개 지원 영역. pcp 모듈은 기관마다 분류가 달라 taxonomy+crosswalk 로 풀었지만 서울형은 제도가 확정했으므로 코드 테이블로 고정한다.';

INSERT INTO public.seoul_service_domains (code, label, description, sort_order) VALUES
  ('daily_living',     '일상생활',     '장애로 인해 겪는 일상생활의 어려움을 보완하거나 자립을 지원하는 서비스 또는 물품', 1),
  ('social_life',      '사회생활',     '사회적 관계를 넓히고 지역사회 참여를 촉진하기 위한 서비스',                        2),
  ('employment',       '취·창업활동',  '당사자의 경험과 연계하여 고용 및 소득 창출의 실현 가능성이 있는 서비스',           3),
  ('self_development', '자기개발',     '역량 강화를 위한 학습 및 성장 지원 서비스',                                      4),
  ('health_safety',    '건강·안전',    '신체적·정신적 건강 유지 및 위험 예방을 위한 서비스',                              5),
  ('housing',          '주거환경개선', '주거공간의 장애 맞춤형 환경 조성을 위한 서비스',                                  6)
ON CONFLICT (code) DO NOTHING;


-- =====================================================================
-- §3. 지출 규칙 — 금지(차단) vs 요건(사람 판단)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_spending_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id     UUID REFERENCES public.seoul_cohorts(id) ON DELETE CASCADE,  -- NULL = 전 차수 공통
  code          TEXT NOT NULL,
  label         TEXT NOT NULL,
  -- ★ 자동화 경계선. 이 한 컬럼이 "시스템이 막을 것"과 "사람이 판단할 것"을 가른다.
  kind          TEXT NOT NULL CHECK (kind IN ('prohibition','criterion')),
  enforcement   TEXT NOT NULL CHECK (enforcement IN ('block','warn','flag')),
  domain_id     UUID REFERENCES public.seoul_service_domains(id) ON DELETE SET NULL, -- NULL = 전역
  keywords      TEXT[],          -- 단순 키워드 매칭용. 정교한 판정은 사람 몫.
  source_note   TEXT,            -- 어느 지침에서 온 규칙인가 — 근거 없는 규칙은 이의신청에서 무너진다
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (cohort_id, code)
);
COMMENT ON TABLE public.seoul_spending_rules IS
  '금지 항목은 제도가 정한 것이므로 차단한다. 반면 장애 연관성·목표 연관성 같은 요건은 판단이 필요하므로 플래그만 세운다. 요건까지 자동 차단하면 말로 설명하기 어려운 당사자가 가장 불리해진다.';

INSERT INTO public.seoul_spending_rules (code, label, kind, enforcement, keywords, source_note) VALUES
  ('no_alcohol_tobacco_lottery', '주류·담배·복권 구입 불가', 'prohibition', 'block',
     ARRAY['주류','술','담배','전자담배','복권','로또'], '서울형 시범사업 지원 불가 항목'),
  ('no_tax_utility',            '세금·공과금 불가',        'prohibition', 'block',
     ARRAY['세금','국세','지방세','공과금','과태료','범칙금'], '서울형 시범사업 지원 불가 항목'),
  ('no_saving_debt',            '저축·부채상환 불가',      'prohibition', 'block',
     ARRAY['저축','적금','예금','대출','상환','이자'], '서울형 시범사업 지원 불가 항목'),
  ('must_relate_to_disability', '장애 연관성이 있어야 함', 'criterion',   'flag',  NULL,
     '이용 제한 요건 — 담당자·심의 판단 사항'),
  ('must_relate_to_goal',       '목표 연관성이 있어야 함', 'criterion',   'flag',  NULL,
     '이용 제한 요건 — 담당자·심의 판단 사항'),
  ('must_be_in_plan',           '이용계획에 포함되어야 함','criterion',   'warn',  NULL,
     '이용 제한 요건. 활동지원·발달장애인 긴급돌봄은 미포함이어도 이용 가능하다는 예외가 있음 — 기관 확인 필요')
ON CONFLICT (cohort_id, code) DO NOTHING;


-- =====================================================================
-- §4. 기관과 담당자
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_administering_bodies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  body_role  TEXT NOT NULL CHECK (body_role IN ('city','district','foundation')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seoul_executing_agencies (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  designated_by_id     UUID REFERENCES public.seoul_administering_bodies(id) ON DELETE SET NULL,
  contact              TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.seoul_executing_agencies IS
  '신청 접수·계획수립 지원·모니터링을 맡는 복지관. 동의서에 열거된 8개 기관이 여기 해당하며 아름드리꿈터도 이 위치에 선다.';

CREATE TABLE IF NOT EXISTS public.seoul_review_committees (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  administering_body_id UUID REFERENCES public.seoul_administering_bodies(id) ON DELETE SET NULL,
  -- ⚠️ 서울형의 심의 주체·구성·의결정족수는 공개 자료로 확인되지 않았다. 기관 확인 항목.
  composition_note     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- §5. 참여자 자격 정보
--     participants / profiles 는 기존 테이블을 그대로 쓴다 (프로그램 공유 지점)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_disability_profiles (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id            UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  primary_disability_type   TEXT,
  -- ★ 서울형은 중증(severe)만 대상
  disability_severity       TEXT CHECK (disability_severity IN ('severe','mild')),
  secondary_disability_type TEXT,
  acquired_disability_age   TEXT CHECK (acquired_disability_age IN
                              ('none','under20','20s','30s','40s','50s','60s')),
  recorded_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participant_id)
);

CREATE TABLE IF NOT EXISTS public.seoul_benefit_status (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id                 UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  public_assistance              TEXT CHECK (public_assistance IN ('basic_livelihood','near_poor','none')),
  uses_activity_support          BOOLEAN NOT NULL DEFAULT FALSE,
  uses_seoul_additional_support  BOOLEAN NOT NULL DEFAULT FALSE,
  -- ★ 배타 규칙의 입력값. 신청서에 "보건복지부 시범사업 참여자의 경우 서울형 참여 불가" 명시.
  participates_in_mohw_pilot     BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participant_id)
);

CREATE TABLE IF NOT EXISTS public.seoul_proxies (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id           UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  proxy_name               TEXT NOT NULL,
  relation_to_participant  TEXT NOT NULL,
  contact                  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.seoul_proxies IS
  '대리 서명 사실 자체를 기록한다. 자기결정권이 핵심인 제도에서 누가 서명했는지가 사라지면 안 된다.';


-- =====================================================================
-- §6. 신청 · 동의 · 선정
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id      UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  cohort_id           UUID NOT NULL REFERENCES public.seoul_cohorts(id) ON DELETE RESTRICT,
  receipt_number      TEXT,
  application_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by_id      UUID REFERENCES public.seoul_executing_agencies(id) ON DELETE SET NULL,
  proxy_id            UUID REFERENCES public.seoul_proxies(id) ON DELETE SET NULL,
  applicant_signature TEXT,          -- 서명 이미지 경로 또는 전자서명 값
  status              TEXT NOT NULL DEFAULT 'received'
                        CHECK (status IN ('draft','received','screening','selected','not_selected','withdrawn')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participant_id, cohort_id),          -- 한 차수에 한 번만 신청
  UNIQUE (cohort_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.seoul_consent_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID NOT NULL REFERENCES public.seoul_applications(id) ON DELETE CASCADE,
  participant_id        UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  consent_type          TEXT NOT NULL CHECK (consent_type IN ('general','unique_id')),
  is_agreed             BOOLEAN NOT NULL,
  consent_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  -- ★ 본인이 동의했는지 대리인이 대신했는지
  signed_by_proxy       BOOLEAN NOT NULL DEFAULT FALSE,
  retention_period_note TEXT DEFAULT '서울형 장애인 개인예산제 시범사업 및 성과평가에 필요한 기간',
  withdrawn_at          TIMESTAMPTZ,   -- 개인정보보호법상 철회권
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, consent_type)
);
COMMENT ON TABLE public.seoul_consent_records IS
  '동의는 부가정보가 아니라 참여의 전제다. 서식에 "동의 거부 시 사업 참여 불가"가 명시되어 있으므로 1급 개체로 둔다.';

CREATE TABLE IF NOT EXISTS public.seoul_selection_decisions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   UUID NOT NULL REFERENCES public.seoul_applications(id) ON DELETE CASCADE,
  is_selected      BOOLEAN NOT NULL,
  selection_reason TEXT,
  selection_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  decided_by_id    UUID REFERENCES public.seoul_administering_bodies(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id)
);


-- =====================================================================
-- §7. 이용계획
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_utilization_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id        UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  application_id        UUID NOT NULL REFERENCES public.seoul_applications(id) ON DELETE CASCADE,
  cohort_id             UUID NOT NULL REFERENCES public.seoul_cohorts(id) ON DELETE RESTRICT,
  -- ★ 계획의 저자는 참여자다. 담당자는 돕는 사람.
  assisted_by_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  authored_with_support TEXT NOT NULL DEFAULT 'with_support'
                          CHECK (authored_with_support IN ('self','with_support','by_supporter')),
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','submitted','under_review','approved',
                                            'conditional','rejected','under_appeal')),
  plan_period_start     DATE,
  plan_period_end       DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (plan_period_end IS NULL OR plan_period_start IS NULL OR plan_period_end >= plan_period_start)
);

CREATE TABLE IF NOT EXISTS public.seoul_self_narratives (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id                 UUID NOT NULL REFERENCES public.seoul_utilization_plans(id) ON DELETE CASCADE,
  -- 서식의 "나의 상황" 5항목. 5칸 고정이므로 행이 아니라 컬럼으로 둔다.
  strengths_talents       TEXT,   -- 나의 재능, 강점, 기술
  social_barriers         TEXT,   -- 장애로 인해 겪는 사회적 제한, 삶에서의 어려움
  desired_change          TEXT,   -- 내가 원하는 변화와 지원
  desired_life            TEXT,   -- 내가 원하는 삶의 모습
  goal_to_try             TEXT,   -- 시도하고 싶은 것 (1~2년 내 목표)
  -- ★ 서식은 "나의 ~"인데 실제로는 3인칭 대필이 흔하다. 취지가 지켜졌는지 나중에 점검할 수 있게 남긴다.
  written_in_first_person BOOLEAN,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id)
);

CREATE TABLE IF NOT EXISTS public.seoul_requested_services (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id              UUID NOT NULL REFERENCES public.seoul_utilization_plans(id) ON DELETE CASCADE,
  priority             INT  NOT NULL CHECK (priority >= 1),   -- 서식의 구분 1·2·3
  service_name         TEXT NOT NULL,
  domain_id            UUID REFERENCES public.seoul_service_domains(id) ON DELETE SET NULL,
  estimated_cost       NUMERIC(12,2),
  -- 항목 단위 승인 (조건부승인 시 일부만 승인되는 경우)
  approved_for_service BOOLEAN,
  review_note          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, priority)
);


-- =====================================================================
-- §8. 심의 · 통지 · 이의신청
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_plan_reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        UUID NOT NULL REFERENCES public.seoul_utilization_plans(id) ON DELETE CASCADE,
  committee_id   UUID REFERENCES public.seoul_review_committees(id) ON DELETE SET NULL,
  decision       TEXT NOT NULL CHECK (decision IN ('approved','conditional','rejected')),
  -- ★ 사유 없는 부결은 이의신청을 불가능하게 만든다
  reason         TEXT,
  review_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (decision = 'approved' OR (reason IS NOT NULL AND length(trim(reason)) > 0))
);

CREATE TABLE IF NOT EXISTS public.seoul_notifications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id              UUID NOT NULL REFERENCES public.seoul_plan_reviews(id) ON DELETE CASCADE,
  participant_id         UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  -- ★ 이의신청 기한의 기산점
  notified_on            DATE NOT NULL DEFAULT CURRENT_DATE,
  method                 TEXT CHECK (method IN ('mail','sms','in_person','app')),
  -- 발송했다고 전달된 것은 아니다. 발달장애인 대상이면 확인 여부까지 봐야 한다.
  is_read_by_participant BOOLEAN NOT NULL DEFAULT FALSE,
  read_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seoul_appeals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id   UUID NOT NULL REFERENCES public.seoul_notifications(id) ON DELETE CASCADE,
  participant_id    UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  committee_id      UUID REFERENCES public.seoul_review_committees(id) ON DELETE SET NULL,
  filed_on          DATE NOT NULL DEFAULT CURRENT_DATE,
  ground            TEXT NOT NULL,
  -- ★ 본인이 냈는지 대리로 냈는지. 실무자만 넣을 수 있다면 권리구제가 아니다.
  filed_by_self     BOOLEAN NOT NULL DEFAULT TRUE,
  due_on            DATE,          -- 트리거가 cohort.appeal_due_days 로 채운다
  outcome           TEXT NOT NULL DEFAULT 'pending'
                      CHECK (outcome IN ('pending','upheld','partially_upheld','dismissed')),
  outcome_reason    TEXT,
  decided_on        DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- §9. 예산 배정 · 집행
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_budget_allocations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id     UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  plan_id            UUID NOT NULL REFERENCES public.seoul_utilization_plans(id) ON DELETE CASCADE,
  review_id          UUID REFERENCES public.seoul_plan_reviews(id) ON DELETE SET NULL,
  cohort_id          UUID NOT NULL REFERENCES public.seoul_cohorts(id) ON DELETE RESTRICT,
  funded_by_id       UUID REFERENCES public.seoul_administering_bodies(id) ON DELETE SET NULL,
  -- 차수 기본값을 복사해 오되 개별 조정이 가능하도록 행에 둔다
  monthly_ceiling    NUMERIC(12,2) NOT NULL,
  total_ceiling      NUMERIC(12,2) NOT NULL,
  period_months      INT NOT NULL,
  carry_over_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  allocated_amount   NUMERIC(12,2) NOT NULL,   -- 승인금액. 본인부담금 산정 기준이 된다.
  -- 본인부담금 — seoul_set_copay() 트리거가 채운다. 직접 넣은 값은 덮어쓰인다.
  --   잔액(remaining)처럼 계속 변하는 값이 아니라 승인 시점에 확정되는 값이라
  --   뷰로 계산하지 않고 행에 고정한다. 나중에 수급 자격이 바뀌어도 이미 승인된
  --   배정의 부담금은 그대로여야 하기 때문이다.
  copay_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- 금액만 두면 "0원"이 면제인지 제도 자체가 없는 차수인지 구분되지 않는다.
  --   unverified = 수급 구분을 아직 못 받은 상태. 면제 대상일 수도 있으므로
  --   금액은 부과 기준으로 계산해 두되 화면에서 "확인 전"임을 반드시 알린다.
  copay_status       TEXT NOT NULL DEFAULT 'not_applicable'
                       CHECK (copay_status IN ('not_applicable','exempt_basic_livelihood',
                                               'exempt_near_poor','charged','unverified')),
  starts_on          DATE NOT NULL,
  ends_on            DATE NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id),
  CHECK (ends_on >= starts_on),
  CHECK (allocated_amount <= total_ceiling)
);

-- 이미 배포된 DB 를 위한 추가 (재실행 안전)
ALTER TABLE public.seoul_budget_allocations
  ADD COLUMN IF NOT EXISTS copay_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.seoul_budget_allocations
  ADD COLUMN IF NOT EXISTS copay_status TEXT NOT NULL DEFAULT 'not_applicable';
DO $$ BEGIN
  ALTER TABLE public.seoul_budget_allocations ADD CONSTRAINT seoul_budget_allocations_copay_status_check
    CHECK (copay_status IN ('not_applicable','exempt_basic_livelihood','exempt_near_poor','charged','unverified'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE public.seoul_budget_allocations IS
  '월 한도와 총 한도를 함께 저장한다. 월 한도만 보면 총액을 넘고, 총액만 보면 한 달에 몰아 쓸 수 있다.';
COMMENT ON COLUMN public.seoul_budget_allocations.copay_amount IS
  '승인 시점에 확정되는 본인부담금. seoul_set_copay() 가 산정하며 수기 입력은 덮어쓰인다.';

CREATE TABLE IF NOT EXISTS public.seoul_service_providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  business_number TEXT,
  category        TEXT,
  address         TEXT,
  -- 카카오 장소검색(searchPlaces, src/app/actions/geocode.ts) 결과를 그대로 저장한다.
  -- Phase 3 지도 화면이 이 좌표로 마커를 찍는다 — 없으면 지도에 못 나온다.
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.seoul_service_providers ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.seoul_service_providers ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS public.seoul_service_usages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id        UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  allocation_id         UUID NOT NULL REFERENCES public.seoul_budget_allocations(id) ON DELETE CASCADE,
  -- ★ 이 연결이 비어 있으면 "계획에 없던 지출" — 검토 대상이 된다 (자동 거절 아님)
  requested_service_id  UUID REFERENCES public.seoul_requested_services(id) ON DELETE SET NULL,
  domain_id             UUID REFERENCES public.seoul_service_domains(id) ON DELETE SET NULL,
  provider_id           UUID REFERENCES public.seoul_service_providers(id) ON DELETE SET NULL,
  usage_date            DATE NOT NULL,
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description           TEXT,
  -- 입력자와 결정자를 구분한다. 실무자가 대신 입력한 것과 대신 결정한 것은 전혀 다르다.
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_by            TEXT NOT NULL DEFAULT 'self'
                          CHECK (decided_by IN ('self','self_with_support','suggested_accepted','by_supporter')),
  settlement_status     TEXT NOT NULL DEFAULT 'pending'
                          CHECK (settlement_status IN ('pending','accepted','rejected','recovered')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seoul_receipts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_id       UUID NOT NULL REFERENCES public.seoul_service_usages(id) ON DELETE CASCADE,
  provider_id    UUID REFERENCES public.seoul_service_providers(id) ON DELETE SET NULL,
  -- private 버킷 경로만 저장. 조회 시 signed URL 생성 (CLAUDE.md Storage 규칙)
  storage_path   TEXT NOT NULL,
  issued_on      DATE,
  amount         NUMERIC(12,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN public.seoul_receipts.storage_path IS
  'receipts 버킷의 경로. 공개 URL 을 저장하지 않는다 — 버킷이 private 이므로 항상 signed URL 로 변환해 노출한다.';


-- =====================================================================
-- §10. 규칙 검증 결과 (감사 흔적)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_rule_checks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_id              UUID NOT NULL REFERENCES public.seoul_service_usages(id) ON DELETE CASCADE,
  rule_id               UUID NOT NULL REFERENCES public.seoul_spending_rules(id) ON DELETE CASCADE,
  check_result          TEXT NOT NULL CHECK (check_result IN ('pass','blocked','needs_review')),
  -- ★ 시스템 판정과 사람 판단을 다른 컬럼에 둔다. 같은 칸에 쓰면 누가 정했는지 사라진다.
  human_decision        TEXT CHECK (human_decision IN ('accepted','rejected','pending')),
  human_decision_reason TEXT,
  decided_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usage_id, rule_id)
);


-- =====================================================================
-- §11. 정산 · 모니터링
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.seoul_settlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id    UUID NOT NULL REFERENCES public.seoul_budget_allocations(id) ON DELETE CASCADE,
  verified_by_id   UUID REFERENCES public.seoul_executing_agencies(id) ON DELETE SET NULL,
  settled_period   TEXT NOT NULL,          -- '2025-03' 또는 '2025-01~2025-06'
  accepted_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  rejected_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  recovered_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  unused_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  note             TEXT,
  settled_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (allocation_id, settled_period)
);
COMMENT ON COLUMN public.seoul_settlements.unused_amount IS
  '미사용은 실패가 아니다. 다만 "쓸 곳을 못 찾아서"인지 "필요가 없어서"인지는 다르므로 모니터링 기록과 함께 읽어야 한다.';

CREATE TABLE IF NOT EXISTS public.seoul_monitoring_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id    UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  allocation_id     UUID REFERENCES public.seoul_budget_allocations(id) ON DELETE SET NULL,
  caseworker_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  monitoring_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  method            TEXT CHECK (method IN ('visit','phone','app','document')),
  -- ★ 서울형에는 4+1 같은 정형 평가가 없다. 성과평가에 쓸 변화 기록은 사실상 여기뿐이다.
  observed_change   TEXT,
  -- 실무자의 관찰과 당사자 본인의 말을 다른 칸에 적는다
  participant_voice TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 모니터링에서 확인한 개별 이용 건 (다대다)
CREATE TABLE IF NOT EXISTS public.seoul_monitoring_usages (
  monitoring_id UUID NOT NULL REFERENCES public.seoul_monitoring_records(id) ON DELETE CASCADE,
  usage_id      UUID NOT NULL REFERENCES public.seoul_service_usages(id) ON DELETE CASCADE,
  PRIMARY KEY (monitoring_id, usage_id)
);


-- =====================================================================
-- §12. 제약 강제 — 트리거
-- =====================================================================

-- (1) 배타 규칙: 복지부 시범사업 참여자는 서울형 선정 불가
--     테이블을 넘나드는 조건이라 CHECK 로는 표현할 수 없어 트리거로 둔다.
CREATE OR REPLACE FUNCTION public.seoul_enforce_mohw_exclusivity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant_id UUID;
  v_in_mohw        BOOLEAN;
BEGIN
  IF NEW.is_selected IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT a.participant_id INTO v_participant_id
    FROM public.seoul_applications a WHERE a.id = NEW.application_id;

  SELECT bs.participates_in_mohw_pilot INTO v_in_mohw
    FROM public.seoul_benefit_status bs WHERE bs.participant_id = v_participant_id;

  IF COALESCE(v_in_mohw, FALSE) THEN
    RAISE EXCEPTION
      '보건복지부 개인예산제 시범사업 참여자는 서울형 시범사업에 참여할 수 없습니다. (신청서 명시 사항)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seoul_mohw_exclusivity ON public.seoul_selection_decisions;
CREATE TRIGGER trg_seoul_mohw_exclusivity
  BEFORE INSERT OR UPDATE ON public.seoul_selection_decisions
  FOR EACH ROW EXECUTE FUNCTION public.seoul_enforce_mohw_exclusivity();


-- (2) 동의 전제: 두 종류 동의가 모두 있어야 선정 가능
CREATE OR REPLACE FUNCTION public.seoul_enforce_consent_precondition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_agreed_count INT;
BEGIN
  IF NEW.is_selected IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_agreed_count
    FROM public.seoul_consent_records c
   WHERE c.application_id = NEW.application_id
     AND c.is_agreed IS TRUE
     AND c.withdrawn_at IS NULL;

  IF v_agreed_count < 2 THEN
    RAISE EXCEPTION
      '개인정보 수집·이용 동의와 고유식별정보 별도 동의가 모두 있어야 선정할 수 있습니다. (현재 %건)', v_agreed_count;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seoul_consent_precondition ON public.seoul_selection_decisions;
CREATE TRIGGER trg_seoul_consent_precondition
  BEFORE INSERT OR UPDATE ON public.seoul_selection_decisions
  FOR EACH ROW EXECUTE FUNCTION public.seoul_enforce_consent_precondition();


-- (3) 이의신청 기한 자동 계산 (통지일 + 차수별 일수)
CREATE OR REPLACE FUNCTION public.seoul_set_appeal_due()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notified_on DATE;
  v_due_days    INT;
BEGIN
  IF NEW.due_on IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT n.notified_on, c.appeal_due_days
    INTO v_notified_on, v_due_days
    FROM public.seoul_notifications n
    JOIN public.seoul_plan_reviews      r ON r.id = n.review_id
    JOIN public.seoul_utilization_plans p ON p.id = r.plan_id
    JOIN public.seoul_cohorts           c ON c.id = p.cohort_id
   WHERE n.id = NEW.notification_id;

  NEW.due_on := v_notified_on + COALESCE(v_due_days, 14);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seoul_appeal_due ON public.seoul_appeals;
CREATE TRIGGER trg_seoul_appeal_due
  BEFORE INSERT ON public.seoul_appeals
  FOR EACH ROW EXECUTE FUNCTION public.seoul_set_appeal_due();


-- (4) 지출 한도와 금지 규칙
--     ⚠️ 설계 원칙: 금지(prohibition)는 막고, 요건(criterion)은 기록만 한다.
--        요건까지 자동 차단하면 말로 설명하기 어려운 당사자가 가장 불리해진다.
CREATE OR REPLACE FUNCTION public.seoul_check_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alloc        RECORD;
  v_month_spent  NUMERIC;
  v_total_spent  NUMERIC;
  v_rule         RECORD;
  v_haystack     TEXT;
BEGIN
  SELECT * INTO v_alloc
    FROM public.seoul_budget_allocations WHERE id = NEW.allocation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '예산 배정을 찾을 수 없습니다.';
  END IF;

  -- ★ 소유권 검사. RLS 가 가려 주는 것에 기대면 안 된다 —
  --   두 참여자를 함께 담당하는 실무자에게는 양쪽 배정이 모두 보이므로
  --   이 검사가 없으면 A 의 지출을 B 의 예산에서 차감할 수 있다.
  IF v_alloc.participant_id <> NEW.participant_id THEN
    -- 이 예산 배정은 다른 참여자의 것이다 — 두 참여자를 함께 담당하는 실무자가
    -- 화면에서 참여자를 잘못 고르면 여기서 걸린다. 원문 UUID는 사람이 읽어도
    -- 아무 의미가 없으므로 메시지에 넣지 않는다.
    RAISE EXCEPTION '이 예산 배정은 다른 참여자의 것이라 지출을 기록할 수 없습니다.';
  END IF;

  -- 이용일이 배정 기간 안에 있는지
  IF NEW.usage_date < v_alloc.starts_on OR NEW.usage_date > v_alloc.ends_on THEN
    RAISE EXCEPTION '이용일(%)이 예산 지원 기간(% ~ %) 밖입니다.',
      NEW.usage_date, v_alloc.starts_on, v_alloc.ends_on;
  END IF;

  -- 총 한도 (환수된 건은 제외)
  SELECT COALESCE(sum(u.amount), 0) INTO v_total_spent
    FROM public.seoul_service_usages u
   WHERE u.allocation_id = NEW.allocation_id
     AND u.settlement_status <> 'recovered'
     AND (TG_OP = 'INSERT' OR u.id <> NEW.id);

  -- 기준은 승인금액이다 — 차수 상한(total_ceiling)이 아니라 이 사람에게 실제로
  -- 승인된 금액까지만 쓸 수 있다. v_seoul_budget_balance.remaining 과 같은 축.
  IF v_total_spent + NEW.amount > v_alloc.allocated_amount THEN
    -- 트리거 예외 메시지는 그대로 화면에 노출된다(friendlyDbError 는 이 메시지를
    -- 사람이 이미 쓴 것으로 보고 통과시킨다) — 그래서 천단위 구분과 소수점 정리를
    -- 여기서 직접 한다. to_char 없이 NUMERIC 을 그대로 넣으면 "2400000.00원"처럼 나온다.
    RAISE EXCEPTION '승인된 금액을 초과합니다. (승인 %원 / 기사용 %원 / 이번 %원)',
      to_char(v_alloc.allocated_amount, 'FM999,999,999,999'),
      to_char(v_total_spent, 'FM999,999,999,999'),
      to_char(NEW.amount, 'FM999,999,999,999');
  END IF;

  -- 월 한도 — 이월 불가일 때만 차단, 이월 허용이면 통과(총 한도로만 관리)
  IF NOT v_alloc.carry_over_allowed THEN
    SELECT COALESCE(sum(u.amount), 0) INTO v_month_spent
      FROM public.seoul_service_usages u
     WHERE u.allocation_id = NEW.allocation_id
       AND u.settlement_status <> 'recovered'
       AND date_trunc('month', u.usage_date) = date_trunc('month', NEW.usage_date)
       AND (TG_OP = 'INSERT' OR u.id <> NEW.id);

    IF v_month_spent + NEW.amount > v_alloc.monthly_ceiling THEN
      RAISE EXCEPTION '월 한도를 초과합니다. (한도 %원 / 이번 달 사용 %원 / 이번 %원)',
        to_char(v_alloc.monthly_ceiling, 'FM999,999,999,999'),
        to_char(v_month_spent, 'FM999,999,999,999'),
        to_char(NEW.amount, 'FM999,999,999,999');
    END IF;
  END IF;

  -- 금지 항목 키워드 검사 → block 만 차단
  v_haystack := lower(coalesce(NEW.description, ''));
  FOR v_rule IN
    SELECT * FROM public.seoul_spending_rules
     WHERE is_active
       AND kind = 'prohibition'
       AND enforcement = 'block'
       AND (cohort_id IS NULL OR cohort_id = v_alloc.cohort_id)
  LOOP
    IF v_rule.keywords IS NOT NULL
       AND EXISTS (SELECT 1 FROM unnest(v_rule.keywords) k WHERE v_haystack LIKE '%' || lower(k) || '%')
    THEN
      RAISE EXCEPTION '지원 불가 항목입니다: % (근거: %)', v_rule.label, coalesce(v_rule.source_note, '-');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seoul_check_usage ON public.seoul_service_usages;
CREATE TRIGGER trg_seoul_check_usage
  BEFORE INSERT OR UPDATE ON public.seoul_service_usages
  FOR EACH ROW EXECUTE FUNCTION public.seoul_check_usage();


-- (5) 요건(criterion) 위반은 차단하지 않고 검토 목록에 남긴다
--
-- ★ SECURITY DEFINER 인 이유: 이 트리거는 시스템이 남기는 감사 기록이다.
--   INVOKER 로 두면 seoul_rule_checks 의 쓰기 정책(담당자·관리자만)에 걸려
--   당사자가 계획에 없는 지출을 기록하는 순간 지출 자체가 실패한다.
--   플래그를 남기지 못한다고 당사자의 기록을 막는 것은 앞뒤가 바뀐 것이다.
--   DEFINER 로 두어도 당사자가 이 표를 직접 고칠 수는 없다 — 정책은 그대로 유효하다.
CREATE OR REPLACE FUNCTION public.seoul_flag_criteria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cohort_id UUID;
BEGIN
  SELECT cohort_id INTO v_cohort_id
    FROM public.seoul_budget_allocations WHERE id = NEW.allocation_id;

  -- 계획에 없는 지출 → must_be_in_plan 요건 플래그
  IF NEW.requested_service_id IS NULL THEN
    INSERT INTO public.seoul_rule_checks (usage_id, rule_id, check_result, human_decision)
    SELECT NEW.id, r.id, 'needs_review', 'pending'
      FROM public.seoul_spending_rules r
     WHERE r.is_active
       AND r.code = 'must_be_in_plan'
       AND (r.cohort_id IS NULL OR r.cohort_id = v_cohort_id)
    ON CONFLICT (usage_id, rule_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seoul_flag_criteria ON public.seoul_service_usages;
CREATE TRIGGER trg_seoul_flag_criteria
  AFTER INSERT ON public.seoul_service_usages
  FOR EACH ROW EXECUTE FUNCTION public.seoul_flag_criteria();


-- (6) 본인부담금 산정 — 승인금액 × 차수 부담률, 상한 적용, 수급자·차상위 면제
--
-- ★ 앱이 아니라 DB 에서 계산하는 이유: 배정 행은 심의 승인(planReview.ts)뿐 아니라
--   시드·수기 보정으로도 만들어진다. 산식을 앱에 두면 경로마다 값이 달라지고,
--   그 차이는 당사자가 실제로 내야 하는 돈의 차이가 된다.
--
-- ★ SECURITY DEFINER 인 이유: 면제 판정에 seoul_benefit_status 를 읽어야 하는데,
--   이 표의 조회 정책은 담당 실무자·관리자로 제한된다. INVOKER 로 두면 조회에
--   실패해도 예외 없이 그냥 "행 없음"으로 보여 면제 대상자가 조용히 부과 대상이
--   되어 버린다. 읽기만 하고 쓰지 않으므로 권한 확대는 아니다.
CREATE OR REPLACE FUNCTION public.seoul_set_copay()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rate      NUMERIC;
  v_max       NUMERIC;
  v_assist    TEXT;
  v_has_row   BOOLEAN;
BEGIN
  SELECT c.copay_rate, c.copay_max INTO v_rate, v_max
    FROM public.seoul_cohorts c WHERE c.id = NEW.cohort_id;

  -- 부담률이 없는 차수(1·2차)는 제도 자체가 없다 — 0원이지만 '면제'와는 다르다.
  IF COALESCE(v_rate, 0) = 0 THEN
    NEW.copay_amount := 0;
    NEW.copay_status := 'not_applicable';
    RETURN NEW;
  END IF;

  SELECT bs.public_assistance, TRUE INTO v_assist, v_has_row
    FROM public.seoul_benefit_status bs
   WHERE bs.participant_id = NEW.participant_id;

  IF v_assist = 'basic_livelihood' THEN
    NEW.copay_amount := 0;
    NEW.copay_status := 'exempt_basic_livelihood';
    RETURN NEW;
  ELSIF v_assist = 'near_poor' THEN
    NEW.copay_amount := 0;
    NEW.copay_status := 'exempt_near_poor';
    RETURN NEW;
  END IF;

  -- LEAST 는 NULL 을 건너뛰므로 copay_max 가 NULL 이면 상한 없이 동작한다.
  -- 원 단위로 반올림한다 — 소수점이 붙은 청구액은 당사자에게 설명할 수 없다.
  NEW.copay_amount := LEAST(ROUND(NEW.allocated_amount * v_rate), v_max);

  -- 수급 구분을 아직 못 받았으면 면제 대상일 수도 있다. 0원으로 두면 나중에
  -- 갑자기 청구되고, 면제인데 부과로 확정하면 쓸 수 있는 돈을 과소평가하게 된다.
  -- 그래서 금액은 부과 기준으로 두되 '확인 전'임을 상태로 남겨 화면이 알리게 한다.
  NEW.copay_status := CASE WHEN COALESCE(v_has_row, FALSE) AND v_assist IS NOT NULL
                           THEN 'charged' ELSE 'unverified' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seoul_set_copay ON public.seoul_budget_allocations;
CREATE TRIGGER trg_seoul_set_copay
  BEFORE INSERT OR UPDATE OF allocated_amount, cohort_id, participant_id
  ON public.seoul_budget_allocations
  FOR EACH ROW EXECUTE FUNCTION public.seoul_set_copay();


-- (7) 수급 구분이 뒤늦게 입력되면 '확인 전'으로 남아 있던 배정을 다시 산정한다
--
-- 실무 순서가 늘 깔끔하지 않다 — 수급현황을 확인하기 전에 심의가 먼저 끝나기도 한다.
-- 그 경우 배정은 'unverified'(부과 기준 금액 + 확인 전 표시)로 남는데, 나중에
-- 기초생활수급으로 확인되어도 아무도 다시 계산해 주지 않으면 면제 대상자가
-- 24만원을 그대로 청구받는다.
--
-- ★ 'unverified' 인 배정만 고친다. 이미 면제/부과로 확정된 배정은 건드리지 않는다 —
--   승인 시점에 확정된 금액을 나중의 자격 변동으로 소급해 바꾸면 당사자가 이미
--   들은 금액과 달라진다. 확인 전이었던 것을 확인해 주는 것과, 확정된 것을
--   뒤집는 것은 다른 일이다.
CREATE OR REPLACE FUNCTION public.seoul_recheck_copay()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.public_assistance IS NULL THEN
    RETURN NEW;
  END IF;

  -- allocated_amount 를 제자리에 다시 써서 trg_seoul_set_copay 를 재실행시킨다.
  UPDATE public.seoul_budget_allocations
     SET allocated_amount = allocated_amount
   WHERE participant_id = NEW.participant_id
     AND copay_status = 'unverified';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seoul_recheck_copay ON public.seoul_benefit_status;
CREATE TRIGGER trg_seoul_recheck_copay
  AFTER INSERT OR UPDATE OF public_assistance ON public.seoul_benefit_status
  FOR EACH ROW EXECUTE FUNCTION public.seoul_recheck_copay();


-- =====================================================================
-- §13. 뷰 — 잔액은 저장하지 않고 항상 계산한다
-- =====================================================================

CREATE OR REPLACE VIEW public.v_seoul_budget_balance
  WITH (security_invoker = true) AS
SELECT
  a.id                AS allocation_id,
  a.participant_id,
  a.cohort_id,
  a.total_ceiling,
  a.monthly_ceiling,
  a.carry_over_allowed,
  a.allocated_amount,
  -- 본인부담금은 잔액과 다른 축이다. remaining 에서 빼지 않는다 —
  -- 당사자가 쓸 수 있는 서비스 금액은 승인금액 그대로이고, 부담금은 그와 별도로
  -- 발생하는 청구다(3차 안내문: 수행기관이 제공기관에 대신 지급하는 구조).
  a.copay_amount,
  a.copay_status,
  a.starts_on,
  a.ends_on,
  COALESCE(sum(u.amount) FILTER (WHERE u.settlement_status <> 'recovered'), 0) AS spent,
  -- ★ 기준은 total_ceiling 이 아니라 allocated_amount(승인금액)다.
  --   total_ceiling 은 차수가 정한 상한이고, 실제로 쓸 수 있는 돈은 심의가 승인한
  --   금액이다(CHECK: allocated_amount <= total_ceiling). 240만 한도인 차수에서
  --   150만만 승인된 참여자에게 total_ceiling 기준 잔액을 보여주면 90만원을 더
  --   쓸 수 있다고 잘못 알려주게 된다. 본인부담금도 승인금액 기준이므로 축을 맞춘다.
  a.allocated_amount
    - COALESCE(sum(u.amount) FILTER (WHERE u.settlement_status <> 'recovered'), 0) AS remaining,
  count(u.id)                                                    AS usage_count,
  count(u.id) FILTER (WHERE u.requested_service_id IS NULL)       AS unplanned_count
FROM public.seoul_budget_allocations a
LEFT JOIN public.seoul_service_usages u ON u.allocation_id = a.id
GROUP BY a.id;

COMMENT ON VIEW public.v_seoul_budget_balance IS
  '잔액을 컬럼으로 복제하지 않는 이유: 트리거와 수동 보정이 공존하면 이중 반영이 생긴다. 느리면 인덱스를 걸지 값을 복제하지 않는다.';


-- 월별 소진 현황 (이월 허용 여부와 무관하게 실무자가 보는 화면)
CREATE OR REPLACE VIEW public.v_seoul_monthly_usage
  WITH (security_invoker = true) AS
SELECT
  a.id                                   AS allocation_id,
  a.participant_id,
  date_trunc('month', u.usage_date)::date AS month,
  a.monthly_ceiling,
  sum(u.amount) FILTER (WHERE u.settlement_status <> 'recovered') AS month_spent,
  (sum(u.amount) FILTER (WHERE u.settlement_status <> 'recovered') > a.monthly_ceiling)
                                          AS exceeds_monthly_ceiling
FROM public.seoul_budget_allocations a
JOIN public.seoul_service_usages u ON u.allocation_id = a.id
GROUP BY a.id, date_trunc('month', u.usage_date);


-- 계획에 없던 지출 — ⚠️ "물어볼 목록"이지 "거절 목록"이 아니다
CREATE OR REPLACE VIEW public.v_seoul_unplanned_usages
  WITH (security_invoker = true) AS
SELECT
  u.id            AS usage_id,
  u.participant_id,
  u.usage_date,
  u.amount,
  u.description,
  d.label         AS domain_label,
  rc.human_decision,
  rc.human_decision_reason
FROM public.seoul_service_usages u
LEFT JOIN public.seoul_service_domains d ON d.id = u.domain_id
LEFT JOIN public.seoul_rule_checks rc
       ON rc.usage_id = u.id
      AND rc.rule_id = (SELECT id FROM public.seoul_spending_rules WHERE code = 'must_be_in_plan' LIMIT 1)
WHERE u.requested_service_id IS NULL;

COMMENT ON VIEW public.v_seoul_unplanned_usages IS
  '⚠️ 계획에 없다는 이유만으로 자동 반려하지 않는다. 계획을 세울 때 예상하지 못한 좋은 기회가 생길 수 있고, 그것을 잡는 것이 개인예산제의 취지다. 이 뷰는 담당자가 물어보기 위한 목록이다.';


-- 이의신청 기한 임박 — 권리구제가 기한 도과로 사라지지 않게
CREATE OR REPLACE VIEW public.v_seoul_appeal_status
  WITH (security_invoker = true) AS
SELECT
  ap.id            AS appeal_id,
  ap.participant_id,
  ap.filed_on,
  ap.due_on,
  ap.outcome,
  (ap.due_on - CURRENT_DATE) AS days_left,
  (ap.outcome = 'pending' AND ap.due_on < CURRENT_DATE) AS is_overdue
FROM public.seoul_appeals ap;


-- 아직 이의신청이 가능한 부결·조건부 통지 (당사자 화면 안내용)
CREATE OR REPLACE VIEW public.v_seoul_appealable_notifications
  WITH (security_invoker = true) AS
SELECT
  n.id                       AS notification_id,
  n.participant_id,
  n.notified_on,
  r.decision,
  r.reason,
  (n.notified_on + c.appeal_due_days) AS appeal_deadline,
  ((n.notified_on + c.appeal_due_days) >= CURRENT_DATE) AS still_appealable
FROM public.seoul_notifications n
JOIN public.seoul_plan_reviews      r ON r.id = n.review_id
JOIN public.seoul_utilization_plans p ON p.id = r.plan_id
JOIN public.seoul_cohorts           c ON c.id = p.cohort_id
WHERE r.decision IN ('rejected','conditional')
  AND NOT EXISTS (SELECT 1 FROM public.seoul_appeals a WHERE a.notification_id = n.id);


-- 주도성 지표 — 성과평가용. ⚠️ 당사자 화면에는 절대 비율로 표시하지 않는다.
CREATE OR REPLACE VIEW public.v_seoul_self_direction
  WITH (security_invoker = true) AS
SELECT
  a.participant_id,
  a.id AS allocation_id,
  p.authored_with_support                                            AS plan_authorship,
  count(u.id)                                                        AS total_usages,
  count(u.id) FILTER (WHERE u.decided_by = 'self')                   AS self_decided,
  count(u.id) FILTER (WHERE u.decided_by = 'self_with_support')      AS self_with_support,
  ROUND(
    100.0 * count(u.id) FILTER (WHERE u.decided_by IN ('self','self_with_support'))
    / NULLIF(count(u.id), 0), 1)                                     AS self_direction_pct
FROM public.seoul_budget_allocations a
JOIN public.seoul_utilization_plans  p ON p.id = a.plan_id
LEFT JOIN public.seoul_service_usages u ON u.allocation_id = a.id
GROUP BY a.participant_id, a.id, p.authored_with_support;

COMMENT ON VIEW public.v_seoul_self_direction IS
  '실무자 진단용 지표이지 당사자 점수가 아니다. 당사자 화면에는 비율이 아니라 "내가 고른 것 N개"처럼 보여준다.';


-- 절차 진행 현황 한 줄 요약
CREATE OR REPLACE VIEW public.v_seoul_pipeline
  WITH (security_invoker = true) AS
SELECT
  ap.participant_id,
  ap.cohort_id,
  ap.id                                  AS application_id,
  ap.status                              AS application_status,
  sd.is_selected,
  pl.id                                  AS plan_id,
  pl.status                              AS plan_status,
  pr.decision                            AS review_decision,
  n.notified_on,
  al.id                                  AS allocation_id,
  bal.spent,
  bal.remaining
FROM public.seoul_applications ap
LEFT JOIN public.seoul_selection_decisions sd ON sd.application_id = ap.id
LEFT JOIN public.seoul_utilization_plans   pl ON pl.application_id = ap.id
LEFT JOIN public.seoul_plan_reviews        pr ON pr.plan_id = pl.id
LEFT JOIN public.seoul_notifications        n ON n.review_id = pr.id
LEFT JOIN public.seoul_budget_allocations  al ON al.plan_id = pl.id
LEFT JOIN public.v_seoul_budget_balance   bal ON bal.allocation_id = al.id;


-- =====================================================================
-- §15. 인덱스
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_seoul_app_participant      ON public.seoul_applications (participant_id, cohort_id);
CREATE INDEX IF NOT EXISTS idx_seoul_plan_participant     ON public.seoul_utilization_plans (participant_id, status);
CREATE INDEX IF NOT EXISTS idx_seoul_plan_application     ON public.seoul_utilization_plans (application_id);
CREATE INDEX IF NOT EXISTS idx_seoul_reqsvc_plan          ON public.seoul_requested_services (plan_id);
CREATE INDEX IF NOT EXISTS idx_seoul_alloc_participant    ON public.seoul_budget_allocations (participant_id);
-- 잔액 뷰가 매번 도는 집계라 이 인덱스가 사실상의 성능 보증이다
CREATE INDEX IF NOT EXISTS idx_seoul_usage_alloc_date     ON public.seoul_service_usages (allocation_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_seoul_usage_participant    ON public.seoul_service_usages (participant_id, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_seoul_usage_unplanned      ON public.seoul_service_usages (allocation_id)
                                             WHERE requested_service_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_seoul_receipt_usage        ON public.seoul_receipts (usage_id);
CREATE INDEX IF NOT EXISTS idx_seoul_rulecheck_usage      ON public.seoul_rule_checks (usage_id);
CREATE INDEX IF NOT EXISTS idx_seoul_rulecheck_pending    ON public.seoul_rule_checks (human_decision)
                                             WHERE human_decision = 'pending';
CREATE INDEX IF NOT EXISTS idx_seoul_notif_participant    ON public.seoul_notifications (participant_id, notified_on DESC);
CREATE INDEX IF NOT EXISTS idx_seoul_appeal_pending       ON public.seoul_appeals (due_on) WHERE outcome = 'pending';
CREATE INDEX IF NOT EXISTS idx_seoul_monitor_participant  ON public.seoul_monitoring_records (participant_id, monitoring_date DESC);
