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
--   I4.  ★S2(미배정)가 P1 평가에 항목 작성 → 항목 쓰기 RLS 차단(구조 트리거는 SECURITY DEFINER 라 통과)
--   T1.  ★당사자 본인(P1)이 자기 평가에 항목 작성·수정·삭제 → 항목 쓰기 RLS 차단
--        (P1 은 자기 평가·계획 항목을 볼 수 있어 트리거는 통과 — RLS 만 단독으로 검증되는 경로)
--   I5.  ★항목 UPDATE 로 남의 계획 항목으로 갈아끼우기 → 트리거 차단
--   I6.  잘못된 achievement → CHECK 차단
--   W6.  ★authored_by 를 다른 실무자로 위장 → RLS WITH CHECK 차단
--   I7.  ★평가의 당사자 변경(관리자·superuser 포함) → 잠금 트리거 차단(부모 이동 우회로)
--   D1.  ★평가가 달린 계획 항목 삭제 → FK RESTRICT 차단(평가 기록 보호)
--   I8.  ★평가가 달린 계획 항목을 다른 계획으로 옮기기(관리자·superuser) → 부모 이동 잠금 차단
--   I9.  ★평가가 달린 계획의 당사자 변경(관리자·superuser) → 부모 이동 잠금 차단
--   I10. 평가가 없는 계획 항목 이동은 기존대로 허용(잠금은 평가가 달린 경우에만)
--   T2.  담당 실무자의 재저장(ON CONFLICT DO UPDATE — 앱 upsert 경로) → 평가·항목 갱신 성공
--   V1.  목록용 뷰 v_seoul_latest_evaluation 존재·security_invoker · S1 은 P1 만, P2 로그인은 P1 못 봄
--   V2.  빈 평가(서술·항목 없음)는 뷰에서 제외 — 이행도를 모두 지운 달이 '최근 평가'로 보이지 않음
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
  ('ec400000-0000-0000-0000-000000000002','ec300000-0000-0000-0000-000000000002',1,'수영 강습',TRUE),   -- P2 계획 항목
  ('ec400000-0000-0000-0000-000000000003','ec300000-0000-0000-0000-000000000001',2,'공예 활동',TRUE),   -- P1 계획 항목(평가 없음 — I4·I10 용)
  ('ec400000-0000-0000-0000-000000000004','ec300000-0000-0000-0000-000000000001',3,'음악 활동',TRUE)    -- P1 계획 항목(평가 없음 — T1a 용, I4 와 분리)
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
SELECT '   T1e. 부모 이동 잠금 트리거 2종(신청서비스·계획): ' ||
       CASE WHEN (SELECT count(*) FROM pg_trigger
                   WHERE tgname IN ('trg_seoul_guard_evaluated_service_move','trg_seoul_guard_evaluated_plan_owner')
                     AND NOT tgisinternal) = 2 THEN '✅' ELSE '❌ 없음' END;
SELECT '   V1a. 목록용 뷰 존재 + security_invoker: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_class c WHERE c.relname='v_seoul_latest_evaluation' AND c.relkind='v'
                          AND array_to_string(c.reloptions, ',') LIKE '%security_invoker=true%')
            THEN '✅' ELSE '❌ 없음/invoker 아님' END;

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
\echo '── I4. ★S2 가 P1 평가에 (아직 평가 안 된) P1 계획 항목(공예) 이행도 작성 시도 → 항목 쓰기 RLS 차단'
\echo '        (UNIQUE 에 걸리지 않는 조합이라 RLS 만 단독으로 막는 경로 — 공허한 단언 방지)'
INSERT INTO public.seoul_plan_item_evaluations (id, evaluation_id, requested_service_id, achievement) VALUES
  ('ec600000-0000-0000-0000-0000000000e4','ec500000-0000-0000-0000-000000000001','ec400000-0000-0000-0000-000000000003','not_achieved');
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
\echo '── T1a. ★P1 본인이 자기 평가에 자기 계획 항목(음악) 이행도 작성 시도 → 트리거 통과·항목 쓰기 RLS 차단'
INSERT INTO public.seoul_plan_item_evaluations (id, evaluation_id, requested_service_id, achievement) VALUES
  ('ec600000-0000-0000-0000-0000000000f1','ec500000-0000-0000-0000-000000000001','ec400000-0000-0000-0000-000000000004','achieved');
\echo '── T1b. ★P1 본인이 실무자가 쓴 항목 이행도를 UPDATE 시도'
UPDATE public.seoul_plan_item_evaluations SET achievement = 'exceeded'
 WHERE id = 'ec600000-0000-0000-0000-000000000001';
\echo '── T1c. ★P1 본인이 실무자가 쓴 항목을 DELETE 시도'
DELETE FROM public.seoul_plan_item_evaluations WHERE id = 'ec600000-0000-0000-0000-000000000001';
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
SELECT '   T1a 본인 항목 작성 저장 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 항목 쓰기 RLS 방어' ELSE '  ❌ 본인이 항목 작성(대필 결정 위반)' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-0000000000f1';
SELECT '   T1b 실무자 항목 이행도 불변: ' ||
       CASE WHEN (SELECT achievement FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-000000000001') = 'achieved'
            THEN '✅ 항목 쓰기 RLS 방어' ELSE '❌ 본인이 실무자 기록 수정' END;
SELECT '   T1c 실무자 항목 잔존: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅ 항목 쓰기 RLS 방어' ELSE '  ❌ 본인이 실무자 기록 삭제' END
  FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-000000000001';

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
\echo '=== 부모 이동 잠금 — 평가가 달린 신청서비스·계획은 옮길 수 없다(역할 무관) ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'ec000000-0000-0000-0000-0000000000ad';
\echo '── I8a. ★관리자가 평가 달린 신청서비스(미술)를 P2 계획으로 옮기기 시도'
UPDATE public.seoul_requested_services SET plan_id = 'ec300000-0000-0000-0000-000000000002', priority = 5
 WHERE id = 'ec400000-0000-0000-0000-000000000001';
\echo '── I9a. ★관리자가 평가 달린 P1 계획의 당사자를 P2 로 바꾸기 시도'
UPDATE public.seoul_utilization_plans SET participant_id = 'ec100000-0000-0000-0000-000000000002'
 WHERE id = 'ec300000-0000-0000-0000-000000000001';
RESET ROLE;
\echo '── I8b·I9b. ★superuser(RLS 우회)도 같은 시도'
UPDATE public.seoul_requested_services SET plan_id = 'ec300000-0000-0000-0000-000000000002', priority = 5
 WHERE id = 'ec400000-0000-0000-0000-000000000001';
UPDATE public.seoul_utilization_plans SET participant_id = 'ec100000-0000-0000-0000-000000000002'
 WHERE id = 'ec300000-0000-0000-0000-000000000001';
SELECT '   I8 평가 달린 신청서비스의 계획 = 여전히 P1 계획: ' ||
       CASE WHEN (SELECT plan_id FROM public.seoul_requested_services WHERE id='ec400000-0000-0000-0000-000000000001')
                 = 'ec300000-0000-0000-0000-000000000001'
            THEN '✅ 부모 이동 잠금(관리자·superuser)' ELSE '❌ 신청서비스 이동으로 교차 오염' END;
SELECT '   I9 평가 달린 계획의 당사자 = 여전히 P1: ' ||
       CASE WHEN (SELECT participant_id FROM public.seoul_utilization_plans WHERE id='ec300000-0000-0000-0000-000000000001')
                 = 'ec100000-0000-0000-0000-000000000001'
            THEN '✅ 부모 이동 잠금(관리자·superuser)' ELSE '❌ 계획 당사자 변경으로 교차 오염' END;
SELECT '   불변식 — 평가 당사자 ≠ 항목 계획 당사자인 행: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅' ELSE '  ❌ 교차 오염 존재' END
  FROM public.seoul_plan_item_evaluations i
  JOIN public.seoul_evaluations e ON e.id = i.evaluation_id
  JOIN public.seoul_requested_services rs ON rs.id = i.requested_service_id
  JOIN public.seoul_utilization_plans p ON p.id = rs.plan_id
 WHERE p.participant_id <> e.participant_id;
\echo '── I10. 평가가 없는 신청서비스(공예)의 이동은 기존대로 허용(잠금 범위 확인)'
UPDATE public.seoul_requested_services SET plan_id = 'ec300000-0000-0000-0000-000000000002', priority = 3
 WHERE id = 'ec400000-0000-0000-0000-000000000003';
SELECT '   I10 평가 없는 항목 이동: ' ||
       CASE WHEN (SELECT plan_id FROM public.seoul_requested_services WHERE id='ec400000-0000-0000-0000-000000000003')
                 = 'ec300000-0000-0000-0000-000000000002'
            THEN '✅ 허용(잠금은 평가 달린 경우만)' ELSE '❌ 평가 없는 항목까지 막힘' END;

-- V2 픽스처: P1 의 빈 평가(2026-10, 서술·항목 없음, superuser) — 뷰에서 제외돼야 한다.
INSERT INTO public.seoul_evaluations (id, participant_id, period) VALUES
  ('ec500000-0000-0000-0000-0000000000a0','ec100000-0000-0000-0000-000000000001','2026-10')
ON CONFLICT (id) DO NOTHING;

\echo ''
\echo '=== 담당 실무자 S1 — 재저장(앱 upsert 경로) ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'ec000000-0000-0000-0000-0000000000a1';
\echo '── T2. S1 이 같은 달 평가·항목을 ON CONFLICT DO UPDATE 로 다시 저장'
INSERT INTO public.seoul_evaluations (participant_id, period, overall_note, authored_by) VALUES
  ('ec100000-0000-0000-0000-000000000001','2026-09','다시 저장함','ec000000-0000-0000-0000-0000000000a1')
ON CONFLICT (participant_id, period) DO UPDATE
  SET overall_note = EXCLUDED.overall_note, authored_by = EXCLUDED.authored_by;
INSERT INTO public.seoul_plan_item_evaluations (evaluation_id, requested_service_id, achievement, note) VALUES
  ('ec500000-0000-0000-0000-000000000001','ec400000-0000-0000-0000-000000000001','exceeded','목표보다 더 참여')
ON CONFLICT (evaluation_id, requested_service_id) DO UPDATE
  SET achievement = EXCLUDED.achievement, note = EXCLUDED.note;
\echo '── V1b·V2. S1 이 목록용 뷰에서 보는 당사자 = P1 만, 최신 = 2026-09(빈 2026-10 은 제외)'
SELECT '   V1b. 뷰 행 = P1 1건(최신 2026-09): ' || count(*) ||
       CASE WHEN count(*)=1 AND bool_and(participant_id='ec100000-0000-0000-0000-000000000001' AND period='2026-09')
            THEN '  ✅' ELSE '  ❌' END
  FROM public.v_seoul_latest_evaluation
 WHERE participant_id IN ('ec100000-0000-0000-0000-000000000001','ec100000-0000-0000-0000-000000000002');
RESET ROLE;
SELECT '   T2 재저장 반영(평가): ' ||
       CASE WHEN (SELECT overall_note FROM public.seoul_evaluations WHERE id='ec500000-0000-0000-0000-000000000001') = '다시 저장함'
            THEN '✅ upsert 갱신' ELSE '❌ 담당 실무자 재저장 실패' END;
SELECT '   T2 재저장 반영(항목): ' ||
       CASE WHEN (SELECT achievement FROM public.seoul_plan_item_evaluations WHERE id='ec600000-0000-0000-0000-000000000001') = 'exceeded'
            THEN '✅ upsert 갱신' ELSE '❌ 담당 실무자 항목 재저장 실패' END;

SET ROLE alice;
SET request.jwt.claim.sub = 'ec000000-0000-0000-0000-0000000000b2';
SELECT '   V1c. ★P2 로그인이 뷰에서 본 P1 행: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨(security_invoker)' ELSE '  ❌ 뷰로 유출' END
  FROM public.v_seoul_latest_evaluation WHERE participant_id='ec100000-0000-0000-0000-000000000001';
RESET ROLE;

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
