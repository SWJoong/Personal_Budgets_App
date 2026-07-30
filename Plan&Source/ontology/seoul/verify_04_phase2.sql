-- =====================================================================
-- 검증 04 — Phase 2 백엔드 (신청·동의·선정·계획·심의·통지)
--
-- src/app/actions/{application,selection,utilizationPlan,planReview}.ts 가
-- 실제로 의존하는 DB 동작(트리거·RLS·신규 RPC mark_notification_read)을
-- 직접 SQL로 재현해 확인한다. 서버 액션 자체(TypeScript)는 이 파일이 검증하지
-- 않는다 — 여기서는 그 액션들이 올라선 DB 바닥이 실제로 그렇게 동작하는지만 본다.
--
-- ID 는 다른 세 검증 파일과 겹치지 않게 7-접두 UUID 를 쓴다.
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00~05 →
--           verify_01_behaviour.sql → verify_02_rls.sql → verify_03_graph.sql → 이 파일
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- ── 픽스처 ────────────────────────────────────────────────────────────
-- admin·supporter 는 다른 검증 파일과 공유(00..01/00..02) — 이미 있으면 그대로 둔다.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001','admin@test.local'),
  ('00000000-0000-0000-0000-000000000002','supporter@test.local'),
  ('70000000-0000-0000-0000-000000000001','participant-c-login@test.local'),
  ('70000000-0000-0000-0000-000000000002','participant-d-login@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('00000000-0000-0000-0000-000000000001','admin','관리자'),
  ('00000000-0000-0000-0000-000000000002','supporter','실무자'),
  ('70000000-0000-0000-0000-000000000001','participant','참여자C(로그인)'),
  ('70000000-0000-0000-0000-000000000002','participant','참여자D(로그인)')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('71111111-1111-1111-1111-111111111111','참여자C','70000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002'),
  ('72222222-2222-2222-2222-222222222222','참여자D','70000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000002');

INSERT INTO public.seoul_cohorts
  (id, code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed, appeal_due_days, starts_on, ends_on)
VALUES
  ('73333333-0000-0000-0000-000000000001','test_2025_phase2','검증용 2차수(Phase2)',6,400000,2400000,FALSE,14,'2025-01-01','2025-06-30')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.seoul_benefit_status (participant_id, participates_in_mohw_pilot) VALUES
  ('71111111-1111-1111-1111-111111111111', FALSE);


\echo '=== 담당 실무자(00..02) — 신청·동의 접수 ==='
SET ROLE alice;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

\echo '── P1. 신청서 접수'
INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number)
VALUES ('74444444-0000-0000-0000-000000000001','71111111-1111-1111-1111-111111111111',
        '73333333-0000-0000-0000-000000000001','P2-001');
SELECT '   신청서: ' || count(*) || '건' FROM public.seoul_applications
 WHERE id = '74444444-0000-0000-0000-000000000001';

\echo '── P2. 동의 없이 선정 시도 → 차단되어야 함 (트리거)'
INSERT INTO public.seoul_selection_decisions (application_id, is_selected)
VALUES ('74444444-0000-0000-0000-000000000001', TRUE);
SELECT '   동의 없는 선정: ' || count(*) || '건' ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨(트리거)' ELSE '  ❌ 뚫림' END
  FROM public.seoul_selection_decisions WHERE application_id='74444444-0000-0000-0000-000000000001';

\echo '── P3. 동의 2종 기록'
INSERT INTO public.seoul_consent_records (application_id, participant_id, consent_type, is_agreed) VALUES
  ('74444444-0000-0000-0000-000000000001','71111111-1111-1111-1111-111111111111','general','t'),
  ('74444444-0000-0000-0000-000000000001','71111111-1111-1111-1111-111111111111','unique_id','t');
SELECT '   동의 기록: ' || count(*) || '건 (기대 2)' FROM public.seoul_consent_records
 WHERE application_id='74444444-0000-0000-0000-000000000001' AND is_agreed;
RESET ROLE;


\echo ''
\echo '=== 관리자(00..01) — 선정 결정 ==='
SET ROLE alice;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

\echo '── P4. 동의 완료 후 선정 → 성공해야 함'
INSERT INTO public.seoul_selection_decisions (application_id, is_selected, selection_reason)
VALUES ('74444444-0000-0000-0000-000000000001', TRUE, '지원요건 충족');
SELECT '   선정 결과: ' || is_selected::text ||
       CASE WHEN is_selected THEN '  ✅' ELSE '  ❌' END
  FROM public.seoul_selection_decisions WHERE application_id='74444444-0000-0000-0000-000000000001';
UPDATE public.seoul_applications SET status='selected' WHERE id='74444444-0000-0000-0000-000000000001';
RESET ROLE;


\echo ''
\echo '=== 참여자C 본인 로그인 — 계획 작성 ==='
SET ROLE alice;
SET request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';

\echo '── P5. 본인이 이용계획 생성 (draft)'
INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, authored_with_support)
VALUES ('75555555-0000-0000-0000-000000000001','71111111-1111-1111-1111-111111111111',
        '74444444-0000-0000-0000-000000000001','73333333-0000-0000-0000-000000000001','self');
SELECT '   계획 생성: ' || count(*) || '건  ' ||
       CASE WHEN count(*)=1 THEN '✅' ELSE '❌' END
  FROM public.seoul_utilization_plans WHERE id='75555555-0000-0000-0000-000000000001';

\echo '── P6. 본인이 나의 상황(self_narrative) 작성'
INSERT INTO public.seoul_self_narratives (plan_id, strengths_talents, desired_life)
VALUES ('75555555-0000-0000-0000-000000000001','그림 그리기','웹툰 작가가 되고 싶어요');
SELECT '   나의 상황: ' || count(*) || '건  ' ||
       CASE WHEN count(*)=1 THEN '✅' ELSE '❌' END
  FROM public.seoul_self_narratives WHERE plan_id='75555555-0000-0000-0000-000000000001';

\echo '── P7. 본인이 요청 서비스 1순위 작성'
INSERT INTO public.seoul_requested_services (plan_id, priority, service_name, estimated_cost)
VALUES ('75555555-0000-0000-0000-000000000001', 1, '웹툰 학원 수강', 300000);
SELECT '   요청 서비스: ' || count(*) || '건  ' ||
       CASE WHEN count(*)=1 THEN '✅' ELSE '❌' END
  FROM public.seoul_requested_services WHERE plan_id='75555555-0000-0000-0000-000000000001';

\echo '── P8. 본인이 제출(draft→submitted)'
UPDATE public.seoul_utilization_plans SET status='submitted' WHERE id='75555555-0000-0000-0000-000000000001';
SELECT '   상태: ' || status || CASE WHEN status='submitted' THEN '  ✅' ELSE '  ❌' END
  FROM public.seoul_utilization_plans WHERE id='75555555-0000-0000-0000-000000000001';

\echo '── P9. 본인이 스스로 승인(approved)으로 바꾸는 시도 → 차단되어야 함'
UPDATE public.seoul_utilization_plans SET status='approved' WHERE id='75555555-0000-0000-0000-000000000001';
SELECT '   상태: ' || status || CASE WHEN status<>'approved' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_utilization_plans WHERE id='75555555-0000-0000-0000-000000000001';
RESET ROLE;


\echo ''
\echo '=== 관리자(00..01) — 심의 · 실무자(00..02) — 통지 ==='
SET ROLE alice;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

\echo '── P10. 심의 승인 등록'
INSERT INTO public.seoul_plan_reviews (id, plan_id, decision)
VALUES ('76666666-0000-0000-0000-000000000001','75555555-0000-0000-0000-000000000001','approved');
UPDATE public.seoul_utilization_plans SET status='approved' WHERE id='75555555-0000-0000-0000-000000000001';
SELECT '   계획 상태: ' || status || CASE WHEN status='approved' THEN '  ✅' ELSE '  ❌' END
  FROM public.seoul_utilization_plans WHERE id='75555555-0000-0000-0000-000000000001';
RESET ROLE;

SET ROLE alice;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
\echo '── P11. 통지 발송 기록'
INSERT INTO public.seoul_notifications (id, review_id, participant_id, method)
VALUES ('77777777-0000-0000-0000-000000000001','76666666-0000-0000-0000-000000000001',
        '71111111-1111-1111-1111-111111111111','app');
SELECT '   통지: ' || count(*) || '건  ' || CASE WHEN count(*)=1 THEN '✅' ELSE '❌' END
  FROM public.seoul_notifications WHERE id='77777777-0000-0000-0000-000000000001';
RESET ROLE;


\echo ''
\echo '=== mark_notification_read RPC 경계 확인 ==='

\echo '── P12. 참여자C 본인이 자기 통지를 확인 처리 → 성공해야 함'
SET ROLE alice;
SET request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';
SELECT '   RPC 반환값: ' || public.mark_notification_read('77777777-0000-0000-0000-000000000001')::text;
RESET ROLE;
SELECT '   is_read_by_participant: ' || is_read_by_participant::text ||
       CASE WHEN is_read_by_participant THEN '  ✅' ELSE '  ❌' END,
       '   read_at 설정됨: ' || (read_at IS NOT NULL)::text ||
       CASE WHEN read_at IS NOT NULL THEN '  ✅' ELSE '  ❌' END
  FROM public.seoul_notifications WHERE id='77777777-0000-0000-0000-000000000001';

\echo '── P13. 참여자D(무관한 사람)가 참여자C 의 통지를 확인 처리 시도 → 실패해야 함'
-- 확인 처리 전 상태로 되돌려 재현 가능하게 한다
UPDATE public.seoul_notifications SET is_read_by_participant=FALSE, read_at=NULL
 WHERE id='77777777-0000-0000-0000-000000000001';
SET ROLE alice;
SET request.jwt.claim.sub = '70000000-0000-0000-0000-000000000002';
SELECT '   RPC 반환값(참여자D): ' || r::text ||
       CASE WHEN r = FALSE THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.mark_notification_read('77777777-0000-0000-0000-000000000001') AS r;
RESET ROLE;
SELECT '   남의 확인 시도 후 상태 — is_read_by_participant: ' || is_read_by_participant::text ||
       CASE WHEN is_read_by_participant = FALSE THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_notifications WHERE id='77777777-0000-0000-0000-000000000001';

\echo '── P14. 참여자C 본인이 RPC 를 거치지 않고 통지를 직접 UPDATE 시도 → 차단되어야 함'
--       (그룹 A 정책이 그대로 유효한지 — RPC 가 유일한 통로인지 확인)
SET ROLE alice;
SET request.jwt.claim.sub = '70000000-0000-0000-0000-000000000001';
UPDATE public.seoul_notifications SET method='mail' WHERE id='77777777-0000-0000-0000-000000000001';
SELECT '   method: ' || method || CASE WHEN method='app' THEN '  ✅ 방어됨(직접 수정 불가)' ELSE '  ❌ 뚫림' END
  FROM public.seoul_notifications WHERE id='77777777-0000-0000-0000-000000000001';
RESET ROLE;
