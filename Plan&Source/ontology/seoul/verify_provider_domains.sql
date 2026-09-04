-- =====================================================================
-- 검증 · 자산지도 "쓸 수 있는 곳" — 전역 제공기관→영역 발견 함수 계약
--
-- 스펙: Plan&Source/goala_provider_domains_W.md §3
-- 대상 구현: supabase/seoul/ 의 SECURITY DEFINER 함수 seoul_provider_domains()
--
-- test-first 계약(W): 이 파일이 초록이면 "전역 집계는 되되(발견) 신원은 새지 않는(안전)
-- SECURITY DEFINER 함수"가 스펙대로 서 있는 것이다. U(구현)가 함수를 만들고
-- .github/workflows/db-verify.yml verify 배열에 verify_provider_domains 를 추가하면 발동한다.
--
-- ★ 이 계약이 다른 그래프 뷰(verify_03_graph G5)와 의도적으로 대비되는 지점:
--    v_seoul_graph_edges(security_invoker) 는 교차참여자를 '차단'해야 초록이지만,
--    seoul_provider_domains() 는 교차참여자를 '합산'해야 초록이다(발견 목적). 단, 그 대가로
--    신원(participant_id)·금액·날짜를 절대 반환하지 않는다는 것을 함께 못박는다.
--
-- 실행: verify_03_graph 와 같은 방식(임시 PostgreSQL 또는 대시보드 SQL Editor).
--        seoul 빌드 00~05(+07·09·10) 적용 뒤 이 파일. 같은 DB 세션이라 앞 verify 의
--        시드가 남아 있어도 무방하도록 이 파일은 자체 시드(da* 프리픽스)를 쓰고 자기 것만 본다.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

-- ── 시드: 두 참여자(가·나)가 '같은 장소·같은 영역'을 이용한다 ────────────────
-- 로그인 id(da00…)와 참여자 내부 키(da10…)를 분리해 둔다(RLS 시뮬레이션에서 필요).
INSERT INTO auth.users (id, email) VALUES
  ('da000000-0000-0000-0000-0000000000a1','pd-ga-login@test.local'),
  ('da000000-0000-0000-0000-0000000000a2','pd-na-login@test.local')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, role, name) VALUES
  ('da000000-0000-0000-0000-0000000000a1','participant','가나다'),
  ('da000000-0000-0000-0000-0000000000a2','participant','라마바')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role, name=EXCLUDED.name;
INSERT INTO public.participants (id, name, auth_user_id) VALUES
  ('da100000-0000-0000-0000-000000000001','가나다','da000000-0000-0000-0000-0000000000a1'),
  ('da100000-0000-0000-0000-000000000002','라마바','da000000-0000-0000-0000-0000000000a2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seoul_cohorts (id, code, name, period_months, monthly_ceiling, total_ceiling,
                                  carry_over_allowed, appeal_due_days, starts_on, ends_on)
VALUES ('da200000-0000-0000-0000-000000000001','test_provider_domains','발견계약차수',6,400000,2400000,
        TRUE,14,'2025-01-01','2025-06-30')
ON CONFLICT (code) DO NOTHING;

-- 각 참여자의 신청→계획→배정 최소 체인 (지출 트리거가 배정을 요구한다)
INSERT INTO public.seoul_applications (id, participant_id, cohort_id, receipt_number) VALUES
  ('da300000-0000-0000-0000-000000000001','da100000-0000-0000-0000-000000000001','da200000-0000-0000-0000-000000000001','PD-001'),
  ('da300000-0000-0000-0000-000000000002','da100000-0000-0000-0000-000000000002','da200000-0000-0000-0000-000000000001','PD-002')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_utilization_plans (id, participant_id, application_id, cohort_id, status,
       plan_period_start, plan_period_end) VALUES
  ('da400000-0000-0000-0000-000000000001','da100000-0000-0000-0000-000000000001','da300000-0000-0000-0000-000000000001','da200000-0000-0000-0000-000000000001','approved','2025-01-01','2025-06-30'),
  ('da400000-0000-0000-0000-000000000002','da100000-0000-0000-0000-000000000002','da300000-0000-0000-0000-000000000002','da200000-0000-0000-0000-000000000001','approved','2025-01-01','2025-06-30')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_budget_allocations (id, participant_id, plan_id, cohort_id,
       monthly_ceiling, total_ceiling, period_months, carry_over_allowed, allocated_amount, starts_on, ends_on) VALUES
  ('da500000-0000-0000-0000-000000000001','da100000-0000-0000-0000-000000000001','da400000-0000-0000-0000-000000000001','da200000-0000-0000-0000-000000000001',400000,2400000,6,TRUE,2400000,'2025-01-01','2025-06-30'),
  ('da500000-0000-0000-0000-000000000002','da100000-0000-0000-0000-000000000002','da400000-0000-0000-0000-000000000002','da200000-0000-0000-0000-000000000001',400000,2400000,6,TRUE,2400000,'2025-01-01','2025-06-30')
ON CONFLICT (id) DO NOTHING;

-- 공유 제공기관 PV(좌표 있음) + 아무도 안 쓸 제공기관 UNUSED(좌표 있음)
INSERT INTO public.seoul_service_providers (id, name, category, lat, lng) VALUES
  ('da600000-0000-0000-0000-000000000001','나눔카페','카페',37.5601,126.9701),
  ('da600000-0000-0000-0000-000000000009','아무도안쓴가게','상점',37.5602,126.9702)
ON CONFLICT (id) DO NOTHING;

-- ★ 핵심 시드: 가·나 두 참여자가 PV 를 '사회생활'로 각각 1건씩 → 전역 합산 시 2 여야 한다.
--   + 음성 2건: 가의 PV·영역NULL(영역 링크 만들면 안 됨), 가의 장소NULL·사회생활(장소 링크 만들면 안 됨).
INSERT INTO public.seoul_service_usages (id, participant_id, allocation_id, domain_id, provider_id, usage_date, amount, description) VALUES
  ('da700000-0000-0000-0000-000000000001','da100000-0000-0000-0000-000000000001','da500000-0000-0000-0000-000000000001',
     (SELECT id FROM public.seoul_service_domains WHERE code='social_life' AND program='seoul'),
     'da600000-0000-0000-0000-000000000001','2025-02-01',50000,'가-PV-사회생활'),
  ('da700000-0000-0000-0000-000000000002','da100000-0000-0000-0000-000000000002','da500000-0000-0000-0000-000000000002',
     (SELECT id FROM public.seoul_service_domains WHERE code='social_life' AND program='seoul'),
     'da600000-0000-0000-0000-000000000001','2025-02-01',40000,'나-PV-사회생활'),
  ('da700000-0000-0000-0000-000000000003','da100000-0000-0000-0000-000000000001','da500000-0000-0000-0000-000000000001',
     NULL,'da600000-0000-0000-0000-000000000001','2025-02-02',30000,'가-PV-영역NULL(음성)'),
  ('da700000-0000-0000-0000-000000000004','da100000-0000-0000-0000-000000000001','da500000-0000-0000-0000-000000000001',
     (SELECT id FROM public.seoul_service_domains WHERE code='social_life' AND program='seoul'),
     NULL,'2025-02-03',20000,'가-장소NULL-사회생활(음성)')
ON CONFLICT (id) DO NOTHING;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P1. 함수 존재 · SECURITY DEFINER · search_path 고정'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   함수 존재: ' ||
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='seoul_provider_domains' AND pronargs=0)
       THEN '있음 ✅' ELSE '없음 ❌ (U 미구현)' END;
SELECT '   SECURITY DEFINER(prosecdef=true): ' ||
  CASE WHEN COALESCE((SELECT prosecdef FROM pg_proc WHERE proname='seoul_provider_domains' AND pronargs=0),FALSE)
       THEN 'true ✅' ELSE 'false ❌ (definer 아니면 전역 집계 불가)' END;
SELECT '   search_path 고정: ' ||
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='seoul_provider_domains' AND pronargs=0
                     AND array_to_string(proconfig,',') LIKE '%search_path%')
       THEN '고정됨 ✅' ELSE '미고정 ❌ (definer 는 search_path 고정 필수)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P2. 실행 권한 — authenticated 에게만, PUBLIC·anon 회수'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   EXECUTE→authenticated: ' ||
  CASE WHEN has_function_privilege('authenticated','public.seoul_provider_domains()','EXECUTE')
       THEN '있음 ✅' ELSE '없음 ❌ (GRANT EXECUTE TO authenticated 필요)' END;
-- proacl 이 NULL(기본값)이면 PUBLIC 이 실행 가능한 상태다 — REVOKE 를 안 한 것이므로 실패로 본다.
SELECT '   PUBLIC 실행권한 회수: ' ||
  CASE WHEN (SELECT proacl FROM pg_proc WHERE proname='seoul_provider_domains' AND pronargs=0) IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
                         WHERE p.proname='seoul_provider_domains' AND p.pronargs=0
                           AND a.grantee=0 AND a.privilege_type='EXECUTE')
       THEN '회수됨 ✅' ELSE '남음 ❌ (REVOKE ALL ON FUNCTION ... FROM PUBLIC 필요)' END;
-- ★ anon(익명) 실행 차단 — Supabase 회귀잠금. Supabase 는 ALTER DEFAULT PRIVILEGES 로 새 함수마다
--   anon 에게 EXECUTE 를 '직접' 부여하므로, REVOKE FROM PUBLIC 만으로는 anon 이 막히지 않는다.
--   → 11_provider_domains.sql 은 REVOKE EXECUTE ... FROM anon 을 별도로 해야 한다(설계 §2 authenticated 전용).
--   plain-PG(CI)에는 anon 롤이 없어 건너뛴다 — 이 판정은 Supabase(대시보드 SQL Editor)에서만 실효.
--   CASE 는 순서대로 단락평가하므로 anon 롤이 없으면 아래 has_function_privilege('anon',...) 는 실행되지 않는다.
SELECT '   anon 실행권한 없음: ' ||
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')
      THEN '건너뜀 — anon 롤 없음(plain-PG, Supabase 전용 판정) ✅'
    WHEN has_function_privilege('anon','public.seoul_provider_domains()','EXECUTE')
      THEN '있음 ❌ (REVOKE EXECUTE ON FUNCTION ... FROM anon 필요 — Supabase 기본권한이 anon 에 부여)'
    ELSE '없음 ✅'
  END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P3. ★ 안전 불변식 — 반환 시그니처에 PII 가 없다 (신원·금액·날짜 미노출)'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   반환 시그니처: ' || pg_get_function_result('public.seoul_provider_domains()'::regprocedure);
SELECT '   PII 컬럼 없음: ' ||
  CASE WHEN pg_get_function_result('public.seoul_provider_domains()'::regprocedure)
            !~* '(participant|amount|usage_date|created_by|decided_by|description)'
       THEN '✅ (신원·금액·날짜 없음)' ELSE '❌ (전역 소스에 PII 노출 — 제거 필요)' END;
SELECT '   필수 집계 컬럼 존재(provider_id·domain_id·usage_count): ' ||
  CASE WHEN pg_get_function_result('public.seoul_provider_domains()'::regprocedure) ~* 'provider_id'
        AND pg_get_function_result('public.seoul_provider_domains()'::regprocedure) ~* 'domain_id'
        AND pg_get_function_result('public.seoul_provider_domains()'::regprocedure) ~* 'usage_count'
       THEN '✅' ELSE '❌ (계약 컬럼 누락)' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P4. 전역 집계(발견) — 서로 다른 두 참여자의 같은 장소·영역이 합산되는가'
\echo '════════════════════════════════════════════════════════════════'
SELECT '   PV·사회생활 전역 usage_count(가+나=2): ' || COALESCE(sum(usage_count),0) ||
  CASE WHEN COALESCE(sum(usage_count),0)=2 THEN ' ✅' ELSE ' ❌ (전역 합산 안 됨)' END
  FROM public.seoul_provider_domains()
 WHERE provider_id='da600000-0000-0000-0000-000000000001' AND domain_code='social_life';
SELECT '   PV 영역 종류 수(=1, 영역NULL 지출 제외): ' || count(DISTINCT domain_id) ||
  CASE WHEN count(DISTINCT domain_id)=1 THEN ' ✅' ELSE ' ❌ (INNER JOIN 이면 NULL 영역 제외돼야)' END
  FROM public.seoul_provider_domains()
 WHERE provider_id='da600000-0000-0000-0000-000000000001';
SELECT '   미사용 제공기관 결과에 없음(링크 없음): ' ||
  CASE WHEN NOT EXISTS (SELECT 1 FROM public.seoul_provider_domains()
                         WHERE provider_id='da600000-0000-0000-0000-000000000009')
       THEN '없음 ✅' ELSE '있음 ❌' END;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' P5. ★ 대비 — 참여자 권한으로 호출해도 전역이 보인다(SECURITY DEFINER)'
\echo '       (security_invoker 뷰였다면 본인 것만 보여 실패했어야 한다)'
\echo '════════════════════════════════════════════════════════════════'
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE carol LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO carol;

SET ROLE carol;
SET request.jwt.claim.sub = 'da000000-0000-0000-0000-0000000000a2';  -- 라마바의 로그인 id(PV 지출 1건뿐 — 가나다는 2건이라 raw<2 단언과 충돌, 시드버그 수정)
SELECT '   [참여자 권한] 함수 전역 count(=2 여야 definer): ' || COALESCE(sum(usage_count),0) ||
  CASE WHEN COALESCE(sum(usage_count),0)=2 THEN ' ✅ 전역 보임' ELSE ' ❌ (본인 것만 — invoker/뷰 의심)' END
  FROM public.seoul_provider_domains()
 WHERE provider_id='da600000-0000-0000-0000-000000000001' AND domain_code='social_life';
SELECT '   [참여자 권한] 원본테이블 직접조회는 RLS 스코프(< 전역, 신원은 원본이 가림): ' ||
  (SELECT count(*) FROM public.seoul_service_usages WHERE provider_id='da600000-0000-0000-0000-000000000001') ||
  ' < 2 ' ||
  CASE WHEN (SELECT count(*) FROM public.seoul_service_usages
              WHERE provider_id='da600000-0000-0000-0000-000000000001') < 2
       THEN '✅' ELSE '❌ (원본이 전역만큼 새면 RLS 결함)' END;
RESET ROLE;

\echo ''
\echo '=== 검증 종료: 위 결과라인에 ❌ 가 하나도 없어야 계약 통과 ==='
