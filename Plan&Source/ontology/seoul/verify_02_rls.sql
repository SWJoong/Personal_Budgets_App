\set ON_ERROR_STOP off
\pset pager off
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;
SET ROLE alice;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo '=== 참여자로 로그인 — 반드시 되어야 하는 것 ==='
\echo '── S1. 자기 부결 사유 읽기 (이의신청의 전제)'
SELECT '   심의 결과 조회: ' || count(*) || '건' FROM public.seoul_plan_reviews;
\echo '── S2. 자기 예산 잔액 확인'
SELECT '   내 잔액: ' || remaining FROM public.v_seoul_budget_balance;
\echo '── S3. 이의신청 스스로 제기'
INSERT INTO public.seoul_appeals (notification_id, participant_id, ground)
VALUES ('99999999-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','본인 제기');
SELECT '   → 이의신청 ' || count(*) || '건' FROM public.seoul_appeals;
\echo '── S4. 지출 스스로 기록 (계획에 없는 건 → 플래그 트리거 동반)'
INSERT INTO public.seoul_service_usages (participant_id, allocation_id, usage_date, amount, description)
VALUES ('11111111-1111-1111-1111-111111111111','eeeeeeee-0000-0000-0000-000000000001','2025-03-08',50000,'도서 구입');
SELECT '   → 내 지출 ' || count(*) || '건' FROM public.seoul_service_usages;

\echo ''
\echo '=== 반드시 막혀야 하는 것 ==='
\echo '── S5. 예산 한도 상향'
UPDATE public.seoul_budget_allocations SET total_ceiling = 99999999;
SELECT '   총한도: ' || total_ceiling || CASE WHEN total_ceiling=2400000 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_budget_allocations WHERE participant_id='11111111-1111-1111-1111-111111111111';
\echo '── S6. 이의신청 결과를 스스로 인용으로'
UPDATE public.seoul_appeals SET outcome = 'upheld';
SELECT '   결과: ' || outcome || CASE WHEN outcome='pending' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_appeals LIMIT 1;
\echo '── S7. 통지일 조작으로 기한 연장'
UPDATE public.seoul_notifications SET notified_on = '2030-01-01';
SELECT '   통지일: ' || notified_on || CASE WHEN notified_on='2025-03-03' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_notifications;
\echo '── S8. 신청 상태를 선정으로'
UPDATE public.seoul_applications SET status = 'selected';
SELECT '   상태: ' || status || CASE WHEN status='received' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_applications WHERE participant_id='11111111-1111-1111-1111-111111111111';
\echo '── S9. 복지부 중복 참여 사실 은폐'
UPDATE public.seoul_benefit_status SET participates_in_mohw_pilot = FALSE;
SELECT '   복지부 참여 플래그: ' || participates_in_mohw_pilot || '  ✅ (본인 것은 원래 FALSE)'
  FROM public.seoul_benefit_status WHERE participant_id='11111111-1111-1111-1111-111111111111';
\echo '── S10. 규칙 판정 뒤집기'
UPDATE public.seoul_rule_checks SET human_decision='accepted';
SELECT '   accepted 로 바뀐 행: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_rule_checks WHERE human_decision='accepted';
\echo '── S11. 자기 지출을 정산 인정으로'
UPDATE public.seoul_service_usages SET settlement_status='accepted';
SELECT '   accepted 건수: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_service_usages WHERE settlement_status='accepted';
\echo '── S12. 남의 데이터 열람'
SELECT '   참여자B 신청서: ' || count(*) || CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_applications WHERE participant_id='22222222-2222-2222-2222-222222222222';
\echo '── S13. 자기 계획을 스스로 승인으로'
UPDATE public.seoul_utilization_plans SET status='approved';
SELECT '   계획 상태: ' || status || CASE WHEN status<>'approved' THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_utilization_plans WHERE participant_id='11111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 담당 실무자 ==='
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
\echo '── S14. 규칙 판정 확정'
UPDATE public.seoul_rule_checks SET human_decision='accepted', human_decision_reason='좋은 기회라 인정';
SELECT '   → 판정 ' || count(*) || '건  ' || CASE WHEN count(*)>0 THEN '✅' ELSE '❌ 실무자가 막힘' END
  FROM public.seoul_rule_checks WHERE human_decision='accepted';
\echo '── S15. 예산 한도 조정 (담당자 권한)'
UPDATE public.seoul_budget_allocations SET total_ceiling = 3000000
 WHERE participant_id='11111111-1111-1111-1111-111111111111';
SELECT '   → 총한도: ' || total_ceiling || CASE WHEN total_ceiling=3000000 THEN '  ✅' ELSE '  ❌ 담당자가 막힘' END
  FROM public.seoul_budget_allocations WHERE participant_id='11111111-1111-1111-1111-111111111111';
RESET ROLE;
