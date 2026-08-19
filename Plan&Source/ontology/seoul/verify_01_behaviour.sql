\set ON_ERROR_STOP off
\pset pager off
-- 기초 데이터
-- profiles.id 가 이제 auth.users(id) 를 FK 로 참조하므로(01_core.sql), 먼저 로그인 계정을 만든다.
-- 이 파일은 RLS 를 테스트하지 않으므로(슈퍼유저로 실행 — 정책 우회) participants.id 를
-- auth 계정과 다르게 둘 필요는 없다. 신원 모델 자체의 검증은 verify_02_rls.sql 담당.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001','admin@test.local'),
  ('00000000-0000-0000-0000-000000000002','supporter@test.local'),
  ('11111111-1111-1111-1111-111111111111','participant-a@test.local'),
  ('22222222-2222-2222-2222-222222222222','participant-b@test.local');
-- auth.users 삽입이 handle_new_user() 트리거를 태워 이미 기본 role(participant)로
-- profiles 행을 만들어 두었으므로, 여기서는 의도한 role/name 으로 덮어쓴다.
INSERT INTO public.profiles (id, role, name) VALUES
  ('00000000-0000-0000-0000-000000000001','admin','관리자'),
  ('00000000-0000-0000-0000-000000000002','supporter','실무자'),
  ('11111111-1111-1111-1111-111111111111','participant','참여자A'),
  ('22222222-2222-2222-2222-222222222222','participant','참여자B(복지부중복)')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.participants (id, name, assigned_supporter_id) VALUES
  ('11111111-1111-1111-1111-111111111111','참여자A','00000000-0000-0000-0000-000000000002'),
  ('22222222-2222-2222-2222-222222222222','참여자B','00000000-0000-0000-0000-000000000002');
INSERT INTO public.seoul_cohorts (id, code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed, appeal_due_days, starts_on, ends_on)
VALUES ('cccccccc-0000-0000-0000-000000000001','2025_2','2차(2025)',6,400000,2400000,FALSE,14,'2025-01-01','2025-06-30');
INSERT INTO public.seoul_benefit_status (participant_id, participates_in_mohw_pilot) VALUES
  ('11111111-1111-1111-1111-111111111111', FALSE),
  ('22222222-2222-2222-2222-222222222222', TRUE);
INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','S-001'),
  ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','cccccccc-0000-0000-0000-000000000001','S-002');

\echo '── T1. 동의 없이 선정 시도 → 차단되어야 함'
INSERT INTO public.seoul_selection_decisions (application_id, is_selected)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', TRUE);

\echo '── T2. 동의 2건 등록 후 선정 → 성공해야 함'
INSERT INTO public.seoul_consent_records (application_id, participant_id, consent_type, is_agreed) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','general',TRUE),
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','unique_id',TRUE);
INSERT INTO public.seoul_selection_decisions (application_id, is_selected)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', TRUE);

-- T3 은 원래 "복지부 중복 참여자 선정 → 차단"이었다. 기관 확인 결과 복지부 중복
-- 여부는 수행기관이 자체 확인하므로 앱은 막지 않고 선정 화면에서 경고만 한다
-- (배제 트리거 제거). 따라서 이제 선정이 저장되어야 한다. 경고 노출은 화면 몫이라
-- SQL 로는 "막지 않는다"만 확인한다.
\echo '── T3. 복지부 중복 참여자 선정 시도 → 막지 않고 저장되어야 함 (경고는 화면)'
INSERT INTO public.seoul_consent_records (application_id, participant_id, consent_type, is_agreed) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','general',TRUE),
 ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','unique_id',TRUE);
INSERT INTO public.seoul_selection_decisions (application_id, is_selected)
VALUES ('aaaaaaaa-0000-0000-0000-000000000002', TRUE);
SELECT '   복지부 중복자 선정 저장: ' || count(*) || '건  '
       || CASE WHEN count(*) = 1 THEN '✅ (막지 않음)' ELSE '❌' END
  FROM public.seoul_selection_decisions
 WHERE application_id = 'aaaaaaaa-0000-0000-0000-000000000002' AND is_selected;

\echo '── T4. 부결인데 사유 없음 → 차단되어야 함'
INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','submitted');
INSERT INTO public.seoul_plan_reviews (plan_id, decision) VALUES ('bbbbbbbb-0000-0000-0000-000000000001','rejected');

\echo '── T5. 승인 심의 + 예산배정'
INSERT INTO public.seoul_plan_reviews (id, plan_id, decision, reason)
VALUES ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','approved',NULL);
INSERT INTO public.seoul_budget_allocations (id, participant_id, plan_id, review_id, cohort_id, monthly_ceiling, total_ceiling, period_months, carry_over_allowed, allocated_amount, starts_on, ends_on)
VALUES ('eeeeeeee-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',400000,2400000,6,FALSE,2400000,'2025-01-01','2025-06-30');

\echo '── T6. 정상 지출 30만원 → 성공'
INSERT INTO public.seoul_service_usages (participant_id, allocation_id, usage_date, amount, description)
VALUES ('11111111-1111-1111-1111-111111111111','eeeeeeee-0000-0000-0000-000000000001','2025-01-10',300000,'수영 강습비');

\echo '── T7. 같은 달 추가 20만원 (월 40만 한도, 이월불가) → 차단되어야 함'
INSERT INTO public.seoul_service_usages (participant_id, allocation_id, usage_date, amount, description)
VALUES ('11111111-1111-1111-1111-111111111111','eeeeeeee-0000-0000-0000-000000000001','2025-01-20',200000,'미술 재료');

-- T8 은 원래 "금지 항목(주류) → 차단"이었다. 기관 확인 결과 지원 불가 여부는
-- 수행기관 서류를 근거로 심사처가 정하고 그 전에 담당자와의 대화에서 자정되므로,
-- 앱은 명시·기록만 하고 막지 않는다(§3 설계 근거). 따라서 이제 기록되어야 한다.
-- 지원 불가 항목이 기록으로 남는지는 verify_07_spending_rules.sql 이 따로 본다.
\echo '── T8. 지원 불가 항목(여가성) → 막지 않고 기록되어야 함'
INSERT INTO public.seoul_service_usages (id, participant_id, allocation_id, usage_date, amount, description)
VALUES ('ee800000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','eeeeeeee-0000-0000-0000-000000000001','2025-02-01',20000,'주말 여행 경비');
SELECT '   기록: ' || count(*) || '건  ' || CASE WHEN count(*)=1 THEN '✅ (막지 않음)' ELSE '❌' END
  FROM public.seoul_service_usages WHERE id = 'ee800000-0000-0000-0000-000000000008';

\echo '── T9. 기간 밖 이용일 → 차단되어야 함'
INSERT INTO public.seoul_service_usages (participant_id, allocation_id, usage_date, amount, description)
VALUES ('11111111-1111-1111-1111-111111111111','eeeeeeee-0000-0000-0000-000000000001','2025-08-01',10000,'기간 밖');

\echo '── T10. 계획에 없는 지출(정상 금액) → 성공하되 검토 플래그가 생겨야 함'
INSERT INTO public.seoul_service_usages (id, participant_id, allocation_id, usage_date, amount, description)
VALUES ('ffffffff-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','eeeeeeee-0000-0000-0000-000000000001','2025-02-05',150000,'갑자기 생긴 공연 관람 기회');
SELECT '  → rule_checks 행수: ' || count(*) || ', 결과: ' || coalesce(max(check_result),'-')
  FROM public.seoul_rule_checks WHERE usage_id='ffffffff-0000-0000-0000-000000000001';

\echo '── T11. 이의신청 기한 자동 계산 (통지일 + 14일)'
INSERT INTO public.seoul_notifications (id, review_id, participant_id, notified_on, method)
VALUES ('99999999-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','2025-03-03','sms');
INSERT INTO public.seoul_appeals (notification_id, participant_id, ground)
VALUES ('99999999-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','일부 항목이 빠졌습니다');
SELECT '  → 통지일 2025-03-03 / 자동 기한: ' || due_on FROM public.seoul_appeals LIMIT 1;

\echo '── T12. 잔액 뷰 검증 (30만 + 15만 = 45만 사용, 240만 한도)'
SELECT '  → spent=' || spent || ' remaining=' || remaining || ' unplanned=' || unplanned_count
  FROM public.v_seoul_budget_balance WHERE allocation_id='eeeeeeee-0000-0000-0000-000000000001';

\echo '── T13. 승인금액 초과 시도 (250만원) → 차단되어야 함'
INSERT INTO public.seoul_service_usages (participant_id, allocation_id, usage_date, amount, description)
VALUES ('11111111-1111-1111-1111-111111111111','eeeeeeee-0000-0000-0000-000000000001','2025-03-01',2500000,'대형 지출');
