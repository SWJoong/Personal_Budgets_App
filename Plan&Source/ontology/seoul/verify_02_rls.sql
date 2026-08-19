-- =====================================================================
-- 검증 02 — 보안 RLS (신원 모델 재작성판)
--
-- 이전 버전은 "SET request.jwt.claim.sub = 참여자 UUID" 를 그대로
-- participants.id 로 취급했다. 그 참여자 UUID 를 만든 스텁(verify_00_stubs.sql)이
-- participants.id 를 profiles.id 참조로 정의해 두었기 때문에 우연히 통과했을 뿐,
-- 실제 앱의 participants.id 는 로그인 계정과 무관한 내부 키다.
-- 그래서 아래 픽스처는 참여자A 의 "로그인 id(auth.users)"와 "내부 키(participants.id)"를
-- 고의로 다른 값으로 둔다 — 우연히 같아서 결함이 가려지는 일을 막기 위해서다.
--
-- ID 는 verify_01_behaviour.sql / verify_03_graph.sql 과 겹치지 않게 5-접두 UUID 를 쓴다.
-- (README 재현 절차는 세 파일을 같은 DB 에서 순서대로 실행하므로, 겹치는 id 에
--  다른 의미를 주면 나중 INSERT 가 조용히 실패하고 그 차이가 사라진다.)
--
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00~05 → 이 파일
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;

-- ── 픽스처 ────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001','admin@test.local'),
  ('00000000-0000-0000-0000-000000000002','supporter@test.local'),
  ('aaaa1111-1111-1111-1111-111111111111','participant-a-login@test.local'), -- 참여자A 로그인 id
  ('e0000000-0000-0000-0000-00000000000e','unlinked-login@test.local')      -- 아직 어떤 참여자에도 안 붙은 로그인 (S16)
ON CONFLICT (id) DO NOTHING;

-- auth.users 삽입이 handle_new_user() 트리거를 태워 이미 기본 role(participant)로
-- profiles 행을 만들어 두었으므로, 여기서는 의도한 role/name 으로 덮어쓴다.
-- (DO NOTHING 이면 관리자·실무자 테스트 계정이 role='participant' 로 남아
--  seoul_is_admin() 이 항상 거짓이 되는 것을 놓칠 뻔했다.)
INSERT INTO public.profiles (id, role, name) VALUES
  ('00000000-0000-0000-0000-000000000001','admin','관리자'),
  ('00000000-0000-0000-0000-000000000002','supporter','실무자'),
  ('aaaa1111-1111-1111-1111-111111111111','participant','참여자A(로그인)'),
  ('e0000000-0000-0000-0000-00000000000e','participant','미연결 로그인')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- 참여자A: participants.id(내부 키) ≠ auth_user_id(로그인 id) — 이게 이번 수정의 핵심.
-- 참여자B: 대조군. 로그인 계정 자체가 없다(auth_user_id NULL) — "남의 데이터" 테스트용.
INSERT INTO public.participants (id, name, email, auth_user_id, assigned_supporter_id) VALUES
  ('51111111-1111-1111-1111-111111111111','참여자A','shared-recycled@test.local',
     'aaaa1111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000002'),
  ('52222222-2222-2222-2222-222222222222','참여자B', NULL,
     NULL,                                  '00000000-0000-0000-0000-000000000002');

INSERT INTO public.seoul_cohorts
  (id, code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed, appeal_due_days, starts_on, ends_on)
VALUES
  ('c9999999-0000-0000-0000-000000000001','test_2025_rls','검증용 차수',6,400000,2400000,FALSE,14,'2025-01-01','2025-06-30')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.seoul_benefit_status (participant_id, participates_in_mohw_pilot) VALUES
  ('51111111-1111-1111-1111-111111111111', FALSE);

INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number, status) VALUES
  ('5a5a0000-0000-0000-0000-000000000001','51111111-1111-1111-1111-111111111111',
     'c9999999-0000-0000-0000-000000000001','RLS-001','received'),
  ('5a5a0000-0000-0000-0000-000000000002','52222222-2222-2222-2222-222222222222',
     'c9999999-0000-0000-0000-000000000001','RLS-002','received');

-- status='submitted' — 아직 심의 전. S13 은 "본인이 스스로 approved 로 바꾸려는 시도"를 재현한다.
-- 계획 작성 주체가 담당자로 확정되면서(기관 확인 2026-07-31) 당사자는 계획에 UPDATE 권한이
-- 아예 없다 — 예전보다 더 강하게 막힌다. 이 픽스처는 테이블 소유자로 넣으므로 RLS 를 우회한다.
INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status)
VALUES ('5b5b0000-0000-0000-0000-000000000001','51111111-1111-1111-1111-111111111111',
        '5a5a0000-0000-0000-0000-000000000001','c9999999-0000-0000-0000-000000000001','submitted');

INSERT INTO public.seoul_plan_reviews (id, plan_id, decision, reason)
VALUES ('5d5d0000-0000-0000-0000-000000000001','5b5b0000-0000-0000-0000-000000000001','approved',NULL);

INSERT INTO public.seoul_budget_allocations
  (id, participant_id, plan_id, review_id, cohort_id, monthly_ceiling, total_ceiling, period_months,
   carry_over_allowed, allocated_amount, starts_on, ends_on)
VALUES ('5e5e0000-0000-0000-0000-000000000001','51111111-1111-1111-1111-111111111111',
        '5b5b0000-0000-0000-0000-000000000001','5d5d0000-0000-0000-0000-000000000001',
        'c9999999-0000-0000-0000-000000000001',400000,2400000,6,FALSE,2400000,'2025-01-01','2025-06-30');

INSERT INTO public.seoul_notifications (id, review_id, participant_id, notified_on, method)
VALUES ('5f5f0000-0000-0000-0000-000000000001','5d5d0000-0000-0000-0000-000000000001',
        '51111111-1111-1111-1111-111111111111','2025-03-03','sms');

-- S20 픽스처: 관리자만 봐야 하는 실제 초대 행 (비관리자에게 안 보여야 의미가 있다).
INSERT INTO public.user_invitations (id, email, role, invited_by) VALUES
  ('5c5c0000-0000-0000-0000-000000000001','future-supporter@test.local','supporter',
   '00000000-0000-0000-0000-000000000001');


\echo '=== 참여자A 로그인 — 반드시 되어야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'aaaa1111-1111-1111-1111-111111111111';  -- ★ 로그인 id (participants.id 아님)

\echo '── S1. 자기 부결 사유 읽기 (이의신청의 전제)'
SELECT '   심의 결과 조회: ' || count(*) || '건' FROM public.seoul_plan_reviews;
\echo '── S2. 자기 예산 잔액 확인'
SELECT '   내 잔액: ' || remaining FROM public.v_seoul_budget_balance
 WHERE allocation_id = '5e5e0000-0000-0000-0000-000000000001';
\echo '── S3. 이의신청 스스로 제기'
INSERT INTO public.seoul_appeals (notification_id, participant_id, ground)
VALUES ('5f5f0000-0000-0000-0000-000000000001','51111111-1111-1111-1111-111111111111','본인 제기');
SELECT '   → 이의신청 ' || count(*) || '건' FROM public.seoul_appeals
 WHERE notification_id = '5f5f0000-0000-0000-0000-000000000001';
\echo '── S4. 지출 스스로 기록 (계획에 없는 건 → 플래그 트리거 동반)'
INSERT INTO public.seoul_service_usages (participant_id, allocation_id, usage_date, amount, description)
VALUES ('51111111-1111-1111-1111-111111111111','5e5e0000-0000-0000-0000-000000000001','2025-03-08',50000,'도서 구입');
SELECT '   → 내 지출 ' || count(*) || '건' FROM public.seoul_service_usages
 WHERE participant_id = '51111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 반드시 막혀야 하는 것 ==='
\echo '── S5. 예산 한도 상향'
UPDATE public.seoul_budget_allocations SET total_ceiling = 99999999;
SELECT '   총한도: ' || total_ceiling || CASE WHEN total_ceiling=2400000 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_budget_allocations WHERE participant_id='51111111-1111-1111-1111-111111111111';
\echo '── S6. 이의신청 결과를 스스로 인용으로'
UPDATE public.seoul_appeals SET outcome = 'upheld' WHERE notification_id='5f5f0000-0000-0000-0000-000000000001';
SELECT '   결과: ' || outcome || CASE WHEN outcome='pending' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_appeals WHERE notification_id='5f5f0000-0000-0000-0000-000000000001';
\echo '── S7. 통지일 조작으로 기한 연장'
UPDATE public.seoul_notifications SET notified_on = '2030-01-01';
SELECT '   통지일: ' || notified_on || CASE WHEN notified_on='2025-03-03' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_notifications WHERE id='5f5f0000-0000-0000-0000-000000000001';
\echo '── S8. 신청 상태를 선정으로'
UPDATE public.seoul_applications SET status = 'selected';
SELECT '   상태: ' || status || CASE WHEN status='received' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_applications WHERE participant_id='51111111-1111-1111-1111-111111111111';
\echo '── S9. 복지부 중복 참여 사실 은폐'
UPDATE public.seoul_benefit_status SET participates_in_mohw_pilot = TRUE;
SELECT '   복지부 참여 플래그: ' || participates_in_mohw_pilot ||
       CASE WHEN participates_in_mohw_pilot=FALSE THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_benefit_status WHERE participant_id='51111111-1111-1111-1111-111111111111';
\echo '── S10. 규칙 판정 뒤집기 (S4 지출이 계획 밖이라 자동 생성된 플래그)'
UPDATE public.seoul_rule_checks SET human_decision='accepted';
SELECT '   accepted 로 바뀐 행: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_rule_checks WHERE human_decision='accepted';
\echo '── S11. 자기 지출을 정산 인정으로'
UPDATE public.seoul_service_usages SET settlement_status='accepted';
SELECT '   accepted 건수: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_service_usages WHERE settlement_status='accepted';
\echo '── S12. 남의 데이터 열람 (참여자B — 로그인 계정조차 없는 대조군)'
SELECT '   참여자B 신청서: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_applications WHERE participant_id='52222222-2222-2222-2222-222222222222';
\echo '── S13. 자기 계획을 스스로 승인으로 (submitted → approved 시도)'
UPDATE public.seoul_utilization_plans SET status='approved';
SELECT '   계획 상태: ' || status || CASE WHEN status<>'approved' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_utilization_plans WHERE participant_id='51111111-1111-1111-1111-111111111111';
\echo '── S18. 자기 담당 실무자·이름을 스스로 변경 (protect_participant_fields 트리거, 01_core.sql 아님 — 02_core_rls.sql §)'
UPDATE public.participants
   SET assigned_supporter_id = '00000000-0000-0000-0000-000000000001', -- 관리자로 바꿔치기 시도
       name = '이름해킹시도'
 WHERE id = '51111111-1111-1111-1111-111111111111';
SELECT '   담당자: ' || assigned_supporter_id::text ||
       CASE WHEN assigned_supporter_id = '00000000-0000-0000-0000-000000000002' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.participants WHERE id = '51111111-1111-1111-1111-111111111111';
SELECT '   이름: ' || name || CASE WHEN name = '참여자A' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.participants WHERE id = '51111111-1111-1111-1111-111111111111';
\echo '── S19. 자기 profiles.role/is_super_admin 을 스스로 admin 으로 (protect_profile_role 트리거)'
UPDATE public.profiles SET role = 'admin', is_super_admin = TRUE
 WHERE id = 'aaaa1111-1111-1111-1111-111111111111';
SELECT '   role: ' || role || CASE WHEN role = 'participant' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.profiles WHERE id = 'aaaa1111-1111-1111-1111-111111111111';
SELECT '   is_super_admin: ' || is_super_admin::text ||
       CASE WHEN is_super_admin = FALSE THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.profiles WHERE id = 'aaaa1111-1111-1111-1111-111111111111';
\echo '── S20. 비관리자가 초대 목록을 읽거나 몰래 써넣기 (user_invitations_admin_all 정책)'
SELECT '   보이는 초대 건수: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨(실제로는 1건 존재)' ELSE '  ❌ 뚫림' END
  FROM public.user_invitations;
INSERT INTO public.user_invitations (email, role) VALUES ('sneaky-admin@test.local','admin');
SELECT '   몰래 넣은 초대 성공 건수: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.user_invitations WHERE email='sneaky-admin@test.local';
RESET ROLE;

\echo ''
\echo '=== S16. 미연결 로그인 — 참여자 행이 하나도 연결 안 된 계정 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
SELECT '   S16a. 아무 신청서도 못 봄: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_applications;
SELECT '   S16b. 아무 잔액도 못 봄: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.v_seoul_budget_balance;
INSERT INTO public.seoul_service_usages (participant_id, allocation_id, usage_date, amount, description)
VALUES ('51111111-1111-1111-1111-111111111111','5e5e0000-0000-0000-0000-000000000001','2025-04-01',10000,'미연결 계정의 무단 기록 시도');
SELECT '   S16c. 남의 참여자 id 로 지출 기록 시도: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_service_usages WHERE description='미연결 계정의 무단 기록 시도';
RESET ROLE;

\echo ''
\echo '=== S17. 이메일 재사용 — 이미 연결된 참여자가 남의 로그인에 재연결되지 않는가 ==='
-- 참여자A 의 email(shared-recycled@test.local)과 같은 이메일로 "새로운" 로그인이 생겨도
-- link_participant_to_auth_user() 는 auth_user_id IS NULL 인 행만 찾으므로
-- 이미 연결된 참여자A 의 행은 건드리지 않아야 한다.
INSERT INTO auth.users (id, email) VALUES ('f0000000-0000-0000-0000-00000000000f','shared-recycled@test.local');
SELECT public.link_participant_to_auth_user('f0000000-0000-0000-0000-00000000000f');
SELECT '   참여자A auth_user_id: ' || auth_user_id::text ||
       CASE WHEN auth_user_id = 'aaaa1111-1111-1111-1111-111111111111' THEN '  ✅ 그대로(재연결 안 됨)'
            ELSE '  ❌ 남의 로그인에 재연결됨' END
  FROM public.participants WHERE id = '51111111-1111-1111-1111-111111111111';
SELECT '   새 로그인이 대신 연결된 참여자 수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ (일치하는 미연결 행이 없으니 아무 데도 안 붙음)' ELSE '  ❌' END
  FROM public.participants WHERE auth_user_id = 'f0000000-0000-0000-0000-00000000000f';

\echo ''
\echo '=== 담당 실무자 ==='
SET ROLE alice;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
\echo '── S14. 규칙 판정 확정'
UPDATE public.seoul_rule_checks SET human_decision='accepted', human_decision_reason='좋은 기회라 인정';
SELECT '   → 판정 ' || count(*) || '건  ' || CASE WHEN count(*)>0 THEN '✅' ELSE '❌ 실무자가 막힘' END
  FROM public.seoul_rule_checks WHERE human_decision='accepted';
\echo '── S15. 예산 한도 조정 (담당자 권한)'
UPDATE public.seoul_budget_allocations SET total_ceiling = 3000000
 WHERE participant_id='51111111-1111-1111-1111-111111111111';
SELECT '   → 총한도: ' || total_ceiling || CASE WHEN total_ceiling=3000000 THEN '  ✅' ELSE '  ❌ 담당자가 막힘' END
  FROM public.seoul_budget_allocations WHERE participant_id='51111111-1111-1111-1111-111111111111';
RESET ROLE;
