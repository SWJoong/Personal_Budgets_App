-- 그래프 오버레이 검증 — 실제 사례로 "꿈에서 돈까지" 경로가 이어지는지 확인
-- 실행 순서: verify_00_stubs → seoul_schema_draft → seoul_graph_overlay → 이 파일
\set ON_ERROR_STOP off
\pset pager off

-- ── 시나리오: 웹툰 작가가 되고 싶은 김민수 ──────────────────────────
INSERT INTO public.profiles (id, role, name) VALUES
  ('00000000-0000-0000-0000-0000000000a1','admin','관리자'),
  ('00000000-0000-0000-0000-0000000000a2','supporter','박담당'),
  ('10000000-0000-0000-0000-000000000001','participant','김민수');
INSERT INTO public.participants (id, assigned_supporter_id)
  VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2');

INSERT INTO public.seoul_administering_bodies (id, name, body_role) VALUES
  ('b0000000-0000-0000-0000-000000000001','서울특별시','city');
INSERT INTO public.seoul_executing_agencies (id, name, designated_by_id) VALUES
  ('c0000000-0000-0000-0000-000000000001','아름드리꿈터','b0000000-0000-0000-0000-000000000001');
INSERT INTO public.seoul_review_committees (id, name, administering_body_id) VALUES
  ('c1000000-0000-0000-0000-000000000001','서울형 개인예산 심의위원회','b0000000-0000-0000-0000-000000000001');

INSERT INTO public.seoul_cohorts (id, code, name, period_months, monthly_ceiling, total_ceiling,
                                  carry_over_allowed, appeal_due_days, starts_on, ends_on)
VALUES ('c2000000-0000-0000-0000-000000000001','2025_2','2차(2025)',6,400000,2400000,TRUE,14,'2025-01-01','2025-06-30');

INSERT INTO public.seoul_benefit_status (participant_id, public_assistance, participates_in_mohw_pilot)
VALUES ('10000000-0000-0000-0000-000000000001','basic_livelihood',FALSE);
INSERT INTO public.seoul_disability_profiles (participant_id, primary_disability_type, disability_severity)
VALUES ('10000000-0000-0000-0000-000000000001','지적장애','severe');

INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number, received_by_id)
VALUES ('a1000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
        'c2000000-0000-0000-0000-000000000001','2025-S-014','c0000000-0000-0000-0000-000000000001');
INSERT INTO public.seoul_consent_records (application_id, participant_id, consent_type, is_agreed) VALUES
  ('a1000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','general',TRUE),
  ('a1000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','unique_id',TRUE);
INSERT INTO public.seoul_selection_decisions (application_id, is_selected, decided_by_id)
VALUES ('a1000000-0000-0000-0000-000000000001',TRUE,'b0000000-0000-0000-0000-000000000001');

INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id,
       assisted_by_id, authored_with_support, status, plan_period_start, plan_period_end)
VALUES ('d1000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
        'a1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-0000000000a2','self','approved','2025-01-01','2025-06-30');

INSERT INTO public.seoul_self_narratives (plan_id, strengths_talents, social_barriers,
       desired_change, desired_life, goal_to_try, written_in_first_person)
VALUES ('d1000000-0000-0000-0000-000000000001',
        '그림을 잘 그린다. 캐릭터를 잘 만든다.',
        '사람이 많은 곳에서 말하기가 어렵다.',
        '내 그림을 사람들에게 보여주고 싶다.',
        '웹툰 작가가 되고 싶다',
        '그림 배우기, 내 작품 한 편 완성하기',
        TRUE);

INSERT INTO public.seoul_requested_services (id, plan_id, priority, service_name, domain_id, estimated_cost, approved_for_service)
VALUES
 ('e1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001',1,'드로잉 태블릿 구입',
  (SELECT id FROM public.seoul_service_domains WHERE code='self_development'), 450000, TRUE),
 ('e1000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000001',2,'웹툰 아카데미 수강',
  (SELECT id FROM public.seoul_service_domains WHERE code='self_development'), 600000, TRUE),
 ('e1000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000001',3,'주 1회 수영 강습',
  (SELECT id FROM public.seoul_service_domains WHERE code='health_safety'), 300000, TRUE);

INSERT INTO public.seoul_plan_reviews (id, plan_id, committee_id, decision, review_date)
VALUES ('f1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001',
        'c1000000-0000-0000-0000-000000000001','approved','2024-12-20');
INSERT INTO public.seoul_notifications (id, review_id, participant_id, notified_on, method)
VALUES ('f2000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001','2024-12-22','sms');

INSERT INTO public.seoul_budget_allocations (id, participant_id, plan_id, review_id, cohort_id,
       funded_by_id, monthly_ceiling, total_ceiling, period_months, carry_over_allowed,
       allocated_amount, starts_on, ends_on)
VALUES ('01000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
        'd1000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001',
        'c2000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',
        400000,2400000,6,TRUE,2400000,'2025-01-01','2025-06-30');

INSERT INTO public.seoul_service_providers (id, name, business_number) VALUES
 ('02000000-0000-0000-0000-000000000001','하이마트 은평점','123-45-67890'),
 ('02000000-0000-0000-0000-000000000002','서울웹툰아카데미','234-56-78901'),
 ('02000000-0000-0000-0000-000000000003','구립 은평수영장','345-67-89012');

-- 실제 지출 — 계획 항목과 연결된 것 3건 + 계획에 없던 것 1건
INSERT INTO public.seoul_service_usages (id, participant_id, allocation_id, requested_service_id,
       domain_id, provider_id, usage_date, amount, description, decided_by)
VALUES
 ('03000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000001',(SELECT id FROM public.seoul_service_domains WHERE code='self_development'),
  '02000000-0000-0000-0000-000000000001','2025-01-15',450000,'드로잉 태블릿 구입','self'),
 ('03000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000002',(SELECT id FROM public.seoul_service_domains WHERE code='self_development'),
  '02000000-0000-0000-0000-000000000002','2025-02-03',300000,'웹툰 아카데미 3개월 수강료','self'),
 ('03000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000003',(SELECT id FROM public.seoul_service_domains WHERE code='health_safety'),
  '02000000-0000-0000-0000-000000000003','2025-02-10',150000,'수영 강습 3개월','self_with_support'),
 ('03000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000001',
  NULL,(SELECT id FROM public.seoul_service_domains WHERE code='social_life'),
  NULL,'2025-03-08',80000,'웹툰 작가 팬미팅 참가비와 교통비','self');

INSERT INTO public.seoul_receipts (usage_id, provider_id, storage_path, issued_on, amount)
VALUES ('03000000-0000-0000-0000-000000000001','02000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001/tablet.jpg','2025-01-15',450000);

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' G1. 엣지 오버레이 — 외래키가 트리플로 투영되었는가'
\echo '════════════════════════════════════════════════════════════════'
SELECT count(*) AS 총_엣지수, count(DISTINCT predicate) AS 술어_종류
  FROM public.v_seoul_graph_edges;

\echo ''
\echo '── 김민수에서 나가는 화살표'
SELECT e.predicate_ko AS 관계, e.o_type AS 대상종류, n.label AS 대상
  FROM public.v_seoul_graph_edges e
  LEFT JOIN public.v_seoul_graph_nodes n ON n.id = e.o_id AND n.node_type = e.o_type
 WHERE e.s_id = '10000000-0000-0000-0000-000000000001'
 ORDER BY e.o_type;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' G2. 경로 탐색 — "김민수 → ... → 실제 지출" 이 몇 단계로 이어지는가'
\echo '════════════════════════════════════════════════════════════════'
SELECT depth AS 단계, path_label AS 경로, o_label AS 도착지
  FROM public.seoul_graph_walk('10000000-0000-0000-0000-000000000001', 5)
 WHERE o_type = 'ServiceUsage'
 ORDER BY depth, 경로;

\echo ''
\echo '── 계획을 거쳐 지출에 닿는 경로 (양방향 탐색이 필요한 이유)'
\echo '   fulfills 는 지출→계획 방향이라 역방향 엣지가 없으면 이 경로는 0건이 된다.'
SELECT depth AS 단계, path_label AS 경로, o_label AS 지출
  FROM public.seoul_graph_walk('10000000-0000-0000-0000-000000000001', 4, TRUE)
 WHERE o_type = 'ServiceUsage' AND path_label LIKE '계획을 세운다%'
 ORDER BY depth, 경로;

\echo ''
\echo '── 같은 질문을 단방향으로 하면 (역방향 엣지 없이)'
SELECT count(*) AS 찾은_경로수
  FROM public.seoul_graph_walk('10000000-0000-0000-0000-000000000001', 4, FALSE)
 WHERE o_type = 'ServiceUsage' AND path_label LIKE '계획을 세운다%';

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' G3. 온톨로지의 값어치 — 금액이 아니라 맥락으로 읽기'
\echo '════════════════════════════════════════════════════════════════'
SELECT 원하는_삶, 순위, 요청한_서비스, 영역,
       to_char(예상비용,'FM999,999,999')   AS 예상,
       to_char(실제_집행액,'FM999,999,999') AS 집행,
       상태
  FROM public.v_seoul_intent_to_spending
 ORDER BY 순위;

\echo ''
\echo '── 영역별 흐름 (계획외 지출 포함)'
SELECT 영역, 건수, to_char(금액,'FM999,999,999') AS 금액,
       계획외_건수, to_char(COALESCE(계획외_금액,0),'FM999,999,999') AS 계획외_금액
  FROM public.v_seoul_domain_flow ORDER BY 금액 DESC;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' G4. RDF 트리플로 내보내기 (외부 도구 연동용)'
\echo '════════════════════════════════════════════════════════════════'
SELECT subject, predicate, object
  FROM public.seoul_export_triples('10000000-0000-0000-0000-000000000001')
 LIMIT 12;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' G5. RLS 가 그래프 탐색에도 걸리는가 (그래프 DB 를 따로 두면 잃는 것)'
\echo '════════════════════════════════════════════════════════════════'
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE bob LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO bob;

-- 김민수와 무관한 다른 참여자를 만든다
INSERT INTO public.profiles (id, role, name) VALUES
  ('10000000-0000-0000-0000-000000000009','participant','남남이');
INSERT INTO public.participants (id) VALUES ('10000000-0000-0000-0000-000000000009');

SET ROLE bob;
SET request.jwt.claim.sub = '10000000-0000-0000-0000-000000000009';
-- 개인정보를 담은 엣지와 공개 기관정보 엣지를 구분해서 센다.
-- (수행기관이 어느 지자체 지정인지는 공개 정보이므로 보여도 된다)
SELECT '   남남이에게 보이는 개인정보 엣지: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '   ✅ 차단됨' ELSE '   ❌ 새어나감' END
  FROM public.v_seoul_graph_edges
 WHERE s_type NOT IN ('ExecutingAgency','AdministeringBody','ServiceDomain','SpendingRule')
   AND o_type NOT IN ('ExecutingAgency','AdministeringBody','ServiceDomain','SpendingRule');
SELECT '   (참고) 공개 기관정보 엣지: ' || count(*) || '건 — 보여도 무방'
  FROM public.v_seoul_graph_edges
 WHERE s_type IN ('ExecutingAgency','AdministeringBody')
    OR o_type IN ('ExecutingAgency','AdministeringBody');
SELECT '   남남이가 김민수를 탐색한 결과: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '건   ✅ 차단됨' ELSE '건   ❌ 뚫림' END
  FROM public.seoul_graph_walk('10000000-0000-0000-0000-000000000001', 5);
RESET ROLE;

SET ROLE bob;
SET request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
SELECT '   김민수 본인이 보는 엣지 수: ' || count(*) ||
       CASE WHEN count(*)>0 THEN '   ✅ 본인 그래프는 보임' ELSE '   ❌ 본인도 막힘' END
  FROM public.v_seoul_graph_edges;
RESET ROLE;
