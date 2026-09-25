-- =====================================================================
-- 검증 — 월별 평가 (seoul_evaluations · seoul_plan_item_evaluations) 스키마 + RLS + 무결성 계약
--
-- 설계출처: supabase/seoul/20_evaluations.sql 헤더 (사용자 결정 2026-09-25:
--           당사자 직접 평가 = 실무자 대필 · 계획 이행 정도 = 계획 항목별)
-- 모델: 평가(당사자×월) + 항목 평가(평가×신청서비스). 열람 = 본인·담당·관리자(seoul_can_access),
--       쓰기 = 담당·관리자(seoul_is_staff_for). 당사자 본인 작성 없음(대필).
--       ★무결성 트리거: 항목의 신청서비스는 '같은 당사자' 계획 소속이어야 함(역할 무관).
--
-- 확인 항목
--   T0.  두 테이블·핵심 컬럼 존재 (구현 전이면 RED)
--   T1.  RLS 활성(두 테이블) · updated_at 트리거 · 무결성 트리거 존재
--   W1.  담당 실무자(S1)가 배정 당사자(P1) 평가 작성 → 성공
--   W2.  ★미배정 실무자(S2)가 P1 평가 작성 → 차단
--   W3.  ★당사자 본인(P1)이 자기 평가 작성 → 차단 (대필 결정: 쓰기=담당·관리자)
--   W4.  ★잘못된 period('2026-13') → CHECK 차단
--   W5.  (당사자,월) 중복 작성 → UNIQUE 차단(1건 유지)
--   R1.  S1 은 P1 평가만 본다 (P2 평가 격리)
--   R2.  당사자 본인(P1)은 자기 평가를 본다
--   R3.  ★다른 당사자(P2 로그인)는 P1 평가·항목을 못 본다
--   R4.  관리자는 전량 본다
--   U1.  ★당사자 본인·미배정 실무자의 UPDATE 는 효과 없음(내용 불변)
--   I1.  S1 이 P1 평가에 P1 계획 항목 이행도 작성 → 성공
--   I2.  ★S1 이 P1 평가에 P2 계획 항목을 붙이기 → 무결성 트리거 차단
--   I3.  ★superuser(RLS 우회)라도 교차 항목 → 트리거 차단(역할 무관)
--   I4.  ★S2(미배정)가 P1 평가에 항목 작성 → RLS 차단
--   I5.  ★항목 UPDATE 로 남의 계획 항목으로 갈아끼우기 → 트리거 차단
--   I6.  잘못된 achievement → CHECK 차단
--   W6.  ★authored_by 를 다른 실무자로 위장 → RLS WITH CHECK 차단
--   I7.  ★평가의 당사자 변경(관리자·superuser 포함) → 잠금 트리거 차단(부모 이동 우회로)
--   D1.  ★평가가 달린 계획 항목 삭제 → FK RESTRICT 차단(평가 기록 보호)
--   C1.  평가 삭제 시 항목 CASCADE
--
-- ID 접두: 'ec' (hex·다른 verify_*.sql 과 겹치지 않게).
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00~05,07 … → 20_evaluations.sql → 이 파일.
-- CI: .github/workflows/db-verify.yml 의 build 배열(20) · verify 배열(verify_evaluations) 등록.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;

-- ── 픽스처 ────────────────────────────────────────────────────────────
-- 로그인 id(auth.uid) = profiles.id. 참여자 내부 키(ec1..)는 로그인과 분리(auth_user_id 로 연결).
INSERT INTO auth.users (id, email) VALUES
  ('ec000000-0000-0000-0000-0000000000a1','ev-s1@test.local'),     -- 실무자 S1 (P1 담당)
  ('ec000000-0000-0000-0000-0000000000a2','ev-s2@test.local'),     -- 실무자 S2 (P2 담당, P1 미배정)
  ('ec000000-0000-0000-0000-0000000000ad','ev-admin@test.local'),  -- 관리자
  ('ec000000-0000-0000-0000-0000000000b1','ev-p1@test.local'),     -- 당사자 P1 로그인
  ('ec000000-0000-0000-0000-0000000000b2','ev-p2@test.local')      -- 당사자 P2 로그인
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('ec000000-0000-0000-0000-0000000000a1','supporter','평가실무자하나'),
  ('ec000000-0000-0000-0000-0000000000a2','supporter','평가실무자둘'),
  ('ec000000-0000-0000-0000-0000000000ad','admin','평가관리자'),
  ('ec000000-0000-0000-0000-0000000000b1','participant','평가당사자가'),
  ('ec000000-0000-0000-0000-0000000000b2','participant','평가당사자나')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('ec100000-0000-0000-0000-000000000001','평가당사자가','ec000000-0000-0000-0000-0000000000b1','ec000000-0000-0000-0000-0000000000a1'),
  ('ec100000-0000-0000-0000-000000000002','평가당사자나','ec000000-0000-0000-0000-0000000000b2','ec000000-0000-0000-0000-0000000000a2')
ON CONFLICT (id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id, assigned_supporter_id = EXCLUDED.assigned_supporter_id;

INSERT INTO public.seoul_cohorts
  (id, code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed, appeal_due_days, starts_on, ends_on)
VALUES
  ('ec900000-0000-0000-0000-000000000001','test_eval_verify','평가 검증용 차수',6,400000,2400000,FALSE,14,'2026-07-01','2026-12-31')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number, status) VALUES
  ('ec200000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001','ec900000-0000-0000-0000-000000000001','EV-001','selected'),
  ('ec200000-0000-0000-0000-000000000002','ec100000-0000-0000-0000-000000000002','ec900000-0000-0000-0000-000000000001','EV-002','selected')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status, plan_period_start, plan_period_end) VALUES
  ('ec300000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001','ec200000-0000-0000-0000-000000000001','ec900000-0000-0000-0000-000000000001','approved','2026-07-01','2026-12-31'),
  ('ec300000-0000-0000-0000-000000000002','ec100000-0000-0000-0000-000000000002','ec200000-0000-0000-0000-000000000002','ec900000-0000-0000-0000-000000000001','approved','2026-07-01','2026-12-31')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_requested_services (id, plan_id, priority, service_name, approved_for_service) VALUES
  ('ec400000-0000-0000-0000-000000000001','ec300000-0000-0000-0000-000000000001',1,'미술 활동',TRUE),   -- P1 계획 항목
  ('ec400000-0000-0000-0000-000000000002','ec300000-0000-0000-0000-000000000002',1,'수영 강습',TRUE)    -- P2 계획 항목
ON CONFLICT (id) DO NOTHING;

-- 기준선: P2 의 평가 1건(superuser, RLS 우회) — 격리 확인용.
INSERT INTO public.seoul_evaluations (id, participant_id, period, overall_note) VALUES
  ('ec500000-0000-0000-0000-000000000002','ec100000-0000-0000-0000-000000000002','2026-08','P2 기준선 평가')
ON CONFLICT (id) DO NOTHING;

\echo '=== T0. 스키마 계약 (구현 전이면 RED) ==='
SELECT '   T0a. seoul_evaluations 존재: ' ||
       CASE WHEN to_regclass('public.seoul_evaluations') IS NOT NULL THEN '✅' ELSE '❌ 없음(구현 대기)' END;
SELECT '   T0b. seoul_plan_item_evaluations 존재: ' ||
       CASE WHEN to_regclass('public.seoul_plan_item_evaluations') IS NOT NULL THEN '✅' ELSE '❌ 없음(구현 대기)' END;
SELECT '   T0c. 평가 핵심 컬럼 6개: ' ||
       CASE WHEN (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='seoul_evaluations'
                    AND column_name IN ('participant_id','period','budget_usage_note','participant_opinion','overall_note','authored_by')) = 6
            THEN '✅' ELSE '❌ 누락' END;
SELECT '   T0d. 항목 핵심 컬럼 4개: ' ||
       CASE WHEN (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='seoul_plan_item_evaluations'
                    AND column_name IN ('evaluation_id','requested_service_id','achievement','note')) = 4
            THEN '✅' ELSE '❌ 누락' END;

\echo ''
\echo '=== T1. RLS·트리거 계약 ==='
SELECT '   T1a. RLS 활성(평가): ' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname='seoul_evaluations' AND relrowsecurity) THEN '✅' ELSE '❌ RLS 꺼짐' END;
SELECT '   T1b. RLS 활성(항목): ' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname='seoul_plan_item_evaluations' AND relrowsecurity) THEN '✅' ELSE '❌ RLS 꺼짐' END;
SELECT '   T1c. 무결성 트리거 존재: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_seoul_check_plan_item_eval_owner' AND NOT tgisinternal) THEN '✅' ELSE '❌ 없음' END;
SELECT '   T1d. updated_at 트리거(평가): ' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_seoul_evaluations_updated_at' AND NOT tgisinternal) THEN '✅' ELSE '❌ 없음' END;

\echo ''
\echo '=== 담당 실무자 S1 — 되어야 하는 것 / 막혀야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'ec000000-0000-0000-0000-0000000000a1';
\echo '── W1. S1 이 배정 당사자 P1 의 2026-09 평가 작성'
INSERT INTO public.seoul_evaluations (id, participant_id, period, budget_usage_note, participant_opinion, overall_note, authored_by) VALUES
  ('ec500000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000001','2026-09',
   '계획대로 미술 재료 구입','재미있었어요','잘 진행됨','ec000000-0000-0000-0000-0000000000a1');
\echo '── W4. ★잘못된 period(2026-13) 작성 시도 → CHECK 차단'
INSERT INTO public.seoul_evaluations (id, participant_id, period) VALUES
  ('ec500000-0000-0000-0000-0000000000e4','ec100000-0000-0000-0000-000000000001','2026-13');
\echo '── W5. (P1, 2026-09) 중복 작성 시도 → UNIQUE 차단'
INSERT INTO public.seoul_evaluations (id, participant_id, period) VALUES
  ('ec500000-0000-0000-0000-0000000000e5','ec100000-0000-0000-0000-000000000001','2026-09');
\echo '── I1. S1 이 P1 평가에 P1 계획 항목 이행도 작성'
INSERT INTO public.seoul_plan_item_evaluations (id, evaluation_id, requested_service_id, achievement, note) VALUES
  ('ec600000-0000-0000-0000-000000000001','ec500000-0000-0000-0000-000000000001','ec400000-0000-0000-0000-000000000001','achieved','매주 참여');
\echo '── I2. ★S1 이 P1 평가에 P2 계획 항목(수영)을 붙이기 → 무결성 트리거 차단'
INSERT INTO public.seoul_plan_item_evaluations (id, evaluation_id, requested_service_id, achievement) VALUES
  ('ec600000-0000-0000-0000-0000000000e2','ec500000-0000-0000-0000-000000000001','ec400000-0000-0000-0000-000000000002','partial');
\echo '── I5. ★항목 UPDATE 로 남의 계획 항목으로 갈아끼우기 → 트리거 차단'
UPDATE public.seoul_plan_item_evaluations
   SET requested_service_id = 'ec400000-0000-0000-0000-000000000002'
 WHERE id = 'ec600000-0000-0000-0000-000000000001';
\echo '── W6. ★authored_by 를 S2 로 위장해 작성 시도 → RLS WITH CHECK 차단'
INSERT INTO public.seoul_evaluations (id, participant_id, period, overall_note, authored_by) VALUES
  ('ec500000-0000-0000-0000-0000000000e6','ec100000-0000-0000-0000-000000000001','2026-06','위장','ec000000-0000-0000-0000-0000000000a2');
\echo '── I6. ★잘못된 achievement → CHECK 차단'
INSERT INTO public.seoul_plan_item_evaluations (id, evaluation_id, requested_service_id, achievement) VALUES
  ('ec600000-0000-0000-0000-0000000000e6','ec500000-0000-0000-0000-000000000001','ec400000-0000-0000-0000-000000000001','maybe');
\echo '── R1. S1 은 P1 평가만 본다'
SELECT '   R1a. S1 이 본 평가 = P1 것만: ' || count(*) ||
       CASE WHEN count(*)>=1 AND bool_and(participant_id='ec100000-0000-0000-0000-000000000001') THEN '  ✅' ELSE '  ❌' END
  FROM public.seoul_evaluations WHERE id IN ('ec500000-0000-0000-0000-000000000001','ec500000-0000-0000-0000-000000000002');
SELECT '   R1b. ★S1 에게 P2 평가 격리: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 유출' END
  FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-000000000002';
RESET ROLE;

SELECT '   W1 S1 평가 작성 성공: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 담당 실무자가 막힘' END
  FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-000000000001';
SELECT '   W4 잘못된 period 저장 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ CHECK 방어' ELSE '  ❌ 뚫림' END
  FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-0000000000e4';
SELECT '   W5 (P1,2026-09) 평가 건수: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅ UNIQUE 유지' ELSE '  ❌ 중복 허용' END
  FROM public.seoul_evaluations WHERE participant_id='ec100000-0000-0000-0000-000000000001' AND period='2026-09';
SELECT '   I1 항목 이행도 작성 성공: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 막힘' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-000000000001';
SELECT '   I2 교차 항목 저장 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 트리거 방어' ELSE '  ❌ 교차 오염 뚫림' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-0000000000e2';
SELECT '   I5 항목의 신청서비스 = 여전히 P1 항목: ' ||
       CASE WHEN (SELECT requested_service_id FROM public.seoul_plan_item_evaluations
                   WHERE id='ec600000-0000-0000-0000-000000000001') = 'ec400000-0000-0000-0000-000000000001'
            THEN '✅ 트리거 방어' ELSE '❌ 갈아끼우기 뚫림' END;
SELECT '   W6 위장 작성 저장 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ authored_by 위장 방어' ELSE '  ❌ 위장 뚫림' END
  FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-0000000000e6';
SELECT '   I6 잘못된 achievement 저장 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ CHECK 방어' ELSE '  ❌ 뚫림' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-0000000000e6';

\echo ''
\echo '=== 미배정 실무자 S2 — 반드시 막혀야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'ec000000-0000-0000-0000-0000000000a2';
\echo '── W2. ★S2 가 미배정 P1 평가 작성 시도'
INSERT INTO public.seoul_evaluations (id, participant_id, period) VALUES
  ('ec500000-0000-0000-0000-0000000000e2','ec100000-0000-0000-0000-000000000001','2026-10');
\echo '── I4. ★S2 가 P1 평가에 항목 작성 시도'
INSERT INTO public.seoul_plan_item_evaluations (id, evaluation_id, requested_service_id, achievement) VALUES
  ('ec600000-0000-0000-0000-0000000000e4','ec500000-0000-0000-0000-000000000001','ec400000-0000-0000-0000-000000000001','not_achieved');
\echo '── U1a. ★S2 가 P1 평가 UPDATE 시도'
UPDATE public.seoul_evaluations SET overall_note = 'S2 가 덮어씀'
 WHERE id = 'ec500000-0000-0000-0000-000000000001';
SELECT '   S2 에게 P1 평가 보임: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 유출' END
  FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT '   W2 S2 의 P1 평가 저장 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 미배정 작성 뚫림' END
  FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-0000000000e2';
SELECT '   I4 S2 의 항목 저장 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-0000000000e4';

\echo ''
\echo '=== 당사자 본인 P1 — 열람은 되고 작성·수정은 막혀야 함(대필 결정) ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'ec000000-0000-0000-0000-0000000000b1';
\echo '── W3. ★P1 본인이 자기 평가 작성 시도'
INSERT INTO public.seoul_evaluations (id, participant_id, period) VALUES
  ('ec500000-0000-0000-0000-0000000000e3','ec100000-0000-0000-0000-000000000001','2026-11');
\echo '── U1b. ★P1 본인이 자기 평가 UPDATE 시도'
UPDATE public.seoul_evaluations SET overall_note = '본인이 고침'
 WHERE id = 'ec500000-0000-0000-0000-000000000001';
SELECT '   R2. 본인이 본 자기 평가: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 본인이 못 봄' END
  FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-000000000001';
SELECT '   R2b. 본인이 본 자기 항목 평가: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 본인이 못 봄' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT '   W3 본인 작성 저장 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨(대필 결정)' ELSE '  ❌ 본인 작성 뚫림' END
  FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-0000000000e3';
SELECT '   U1 P1 평가 종합 소견 불변: ' ||
       CASE WHEN (SELECT overall_note FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-000000000001') = '잘 진행됨'
            THEN '✅ 방어됨' ELSE '❌ 권한 밖 UPDATE 뚫림' END;

\echo ''
\echo '=== 다른 당사자 P2 로그인 — 반드시 막혀야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'ec000000-0000-0000-0000-0000000000b2';
SELECT '   R3a. ★P2 가 본 P1 평가: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 유출' END
  FROM public.seoul_evaluations WHERE participant_id='ec100000-0000-0000-0000-000000000001';
SELECT '   R3b. ★P2 가 본 P1 항목 평가: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 유출' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-000000000001';
RESET ROLE;

\echo ''
\echo '=== 관리자 — 전량 열람 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'ec000000-0000-0000-0000-0000000000ad';
SELECT '   R4. 관리자가 본 평가(P1·P2): ' || count(*) ||
       CASE WHEN count(*)=2 THEN '  ✅' ELSE '  ❌ 관리자가 못 봄' END
  FROM public.seoul_evaluations WHERE id IN ('ec500000-0000-0000-0000-000000000001','ec500000-0000-0000-0000-000000000002');
\echo '── I7a. ★관리자(두 당사자 모두 담당 권한)가 P1 평가를 P2 로 옮기기 시도 → 잠금 트리거 차단'
UPDATE public.seoul_evaluations SET participant_id = 'ec100000-0000-0000-0000-000000000002'
 WHERE id = 'ec500000-0000-0000-0000-000000000001';
RESET ROLE;

\echo ''
\echo '=== superuser(RLS 우회) — 무결성 트리거는 역할 무관 ==='
\echo '── I3. ★superuser 가 P1 평가에 P2 계획 항목 붙이기 → 트리거 차단'
INSERT INTO public.seoul_plan_item_evaluations (id, evaluation_id, requested_service_id, achievement) VALUES
  ('ec600000-0000-0000-0000-0000000000e3','ec500000-0000-0000-0000-000000000001','ec400000-0000-0000-0000-000000000002','achieved');
SELECT '   I3 superuser 교차 항목 저장 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 트리거 방어(역할 무관)' ELSE '  ❌ superuser 경로 뚫림' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-0000000000e3';
\echo '── I7b. ★superuser 도 평가의 당사자 변경 → 잠금 트리거 차단'
UPDATE public.seoul_evaluations SET participant_id = 'ec100000-0000-0000-0000-000000000002'
 WHERE id = 'ec500000-0000-0000-0000-000000000001';
SELECT '   I7 P1 평가의 당사자 = 여전히 P1: ' ||
       CASE WHEN (SELECT participant_id FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-000000000001')
                 = 'ec100000-0000-0000-0000-000000000001'
            THEN '✅ 잠금 트리거 방어(관리자·superuser)' ELSE '❌ 당사자 이동 뚫림(교차 오염 우회로)' END;
\echo '── D1. ★평가가 달린 계획 항목(미술 활동) 삭제 → FK RESTRICT 차단'
DELETE FROM public.seoul_requested_services WHERE id = 'ec400000-0000-0000-0000-000000000001';
SELECT '   D1 평가 달린 계획 항목 잔존: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅ RESTRICT 로 평가 기록 보호' ELSE '  ❌ 항목 삭제로 평가가 사라짐' END
  FROM public.seoul_requested_services WHERE id='ec400000-0000-0000-0000-000000000001';

\echo ''
\echo '── C1. 평가 삭제 시 항목 CASCADE'
INSERT INTO public.seoul_evaluations (id, participant_id, period) VALUES
  ('ec500000-0000-0000-0000-0000000000c1','ec100000-0000-0000-0000-000000000001','2026-07')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_plan_item_evaluations (id, evaluation_id, requested_service_id, achievement) VALUES
  ('ec600000-0000-0000-0000-0000000000c1','ec500000-0000-0000-0000-0000000000c1','ec400000-0000-0000-0000-000000000001','partial')
ON CONFLICT (id) DO NOTHING;
DELETE FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-0000000000c1';
SELECT '   삭제된 평가의 항목 잔여: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ CASCADE' ELSE '  ❌ 안 지워짐' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-0000000000c1';

\echo ''
\echo '=== 월별 평가(seoul_evaluations) 계약 검증 끝 ==='
