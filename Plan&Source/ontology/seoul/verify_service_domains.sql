-- =====================================================================
-- 검증 · GOAL축 B — 분류 참조테이블 계약 (service_domains / subdomains)
--
-- 스펙: Plan&Source/ontology_db_reform_spec_W.md §2 (판정 D-B1, program 스코프)
-- 대상 구현: supabase/seoul/03_seoul_schema.sql(program 확장) + 09_ontology_classification.sql
--
-- test-first 계약: 이 파일이 초록이면 "서울형6 ↔ 복지부8 병존 + 중분류 27 + (program,code)
-- UNIQUE" 라는 분류축 기반이 스펙대로 서 있는 것이다. U(구현)가 09 로 맞춘다.
--
-- 실행: 로컬 임시 PostgreSQL 클러스터에서 supabase/seoul/00~05 + 09 적용 후
--        psql -f 이 파일  (또는 대시보드 SQL Editor 에 붙여넣기).
--        RLS 우회가 필요 없다 — 참조데이터·제약만 본다(소유자/superuser 로 실행).
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

\echo ''
\echo '=== §1. 대분류 개수 · 코드셋 (서울형 6 / 복지부 8 병존) ==='

SELECT '   서울형(program=seoul) 대분류: ' || count(*) || '개 ' ||
       CASE WHEN count(*)=6 THEN '✅' ELSE '❌ (기대 6)' END
  FROM public.seoul_service_domains WHERE program='seoul';

SELECT '   복지부(program=mohw) 대분류: ' || count(*) || '개 ' ||
       CASE WHEN count(*)=8 THEN '✅' ELSE '❌ (기대 8)' END
  FROM public.seoul_service_domains WHERE program='mohw';

SELECT '   서울형 코드셋 일치: ' ||
       CASE WHEN (SELECT array_agg(code ORDER BY code)
                    FROM public.seoul_service_domains WHERE program='seoul')
                 = ARRAY['daily_living','employment','health_safety',
                         'housing','self_development','social_life']
            THEN '✅' ELSE '❌ (스펙 §2 6코드와 불일치)' END;

SELECT '   복지부 코드셋 일치: ' ||
       CASE WHEN (SELECT array_agg(code ORDER BY code)
                    FROM public.seoul_service_domains WHERE program='mohw')
                 = ARRAY['culture_leisure','daily_living','employment','housing',
                         'legal_rights','mental_health','physical_health','voucher_flex']
            THEN '✅' ELSE '❌ (서식 §4 8대분류와 불일치)' END;

\echo ''
\echo '=== §2. 제약 — (program,code) UNIQUE 로 재구성, code 단독 UNIQUE 제거 ==='

SELECT '   (program,code) UNIQUE: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint
                          WHERE conname='seoul_service_domains_program_code_key')
            THEN '있음 ✅' ELSE '없음 ❌' END;

SELECT '   code 단독 UNIQUE 제거됨: ' ||
       CASE WHEN NOT EXISTS (SELECT 1 FROM pg_constraint
                              WHERE conname='seoul_service_domains_code_key')
            THEN '✅' ELSE '❌ (아직 남아 병존 불가)' END;

SELECT '   program CHECK(seoul,mohw): ' ||
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint
                          WHERE conname='seoul_service_domains_program_chk')
            THEN '있음 ✅' ELSE '없음 ❌' END;

\echo ''
\echo '=== §3. 중분류(subdomain) — 복지부 3단(중분류 27) · 서울형 flat(0) ==='

SELECT '   복지부 중분류 총계: ' || count(*) || '개 ' ||
       CASE WHEN count(*)=27 THEN '✅' ELSE '❌ (기대 27)' END
  FROM public.seoul_service_subdomains s
  JOIN public.seoul_service_domains d ON d.id=s.domain_id AND d.program='mohw';

SELECT '   서울형 중분류(flat → 0 이어야): ' || count(*) ||
       CASE WHEN count(*)=0 THEN ' ✅' ELSE ' ❌ (서울형은 domain 직접 참조)' END
  FROM public.seoul_service_subdomains s
  JOIN public.seoul_service_domains d ON d.id=s.domain_id AND d.program='seoul';

\echo '── 대분류별 중분류 개수 (기대: 신체5·정신4·주거3·일상4·일자리5·법률1·문화3·바우처2)'
SELECT '   ' || d.code || ': ' || count(s.id) || '개' AS "대분류별 중분류"
  FROM public.seoul_service_domains d
  LEFT JOIN public.seoul_service_subdomains s ON s.domain_id=d.id
 WHERE d.program='mohw'
 GROUP BY d.code, d.sort_order
 ORDER BY d.sort_order;

-- 기대치와 기계 비교 (한 줄 판정)
SELECT '   대분류별 개수 정합: ' ||
       CASE WHEN NOT EXISTS (
         SELECT 1 FROM (
           SELECT d.code, count(s.id) AS n
             FROM public.seoul_service_domains d
             LEFT JOIN public.seoul_service_subdomains s ON s.domain_id=d.id
            WHERE d.program='mohw' GROUP BY d.code
         ) g
         JOIN (VALUES
           ('physical_health',5),('mental_health',4),('housing',3),('daily_living',4),
           ('employment',5),('legal_rights',1),('culture_leisure',3),('voucher_flex',2)
         ) e(code,n) ON e.code=g.code
        WHERE e.n <> g.n
       ) THEN '✅' ELSE '❌ (중분류 개수 서식 §4 불일치)' END;

\echo ''
\echo '=== §4. 병존 증명 + 음성(중복 삽입 차단) ==='

SELECT '   housing 병존(seoul+mohw 각 1): ' || count(*) ||
       CASE WHEN count(*)=2 THEN ' ✅ (같은 code, 다른 program 공존)' ELSE ' ❌' END
  FROM public.seoul_service_domains WHERE code='housing';

\echo '── 음성: 같은 (program=seoul, code=housing) 중복 삽입 → UNIQUE 로 차단되어야 함'
INSERT INTO public.seoul_service_domains (program, code, label) VALUES ('seoul','housing','중복시도');
SELECT '   seoul/housing 행 수(1 유지 = 방어): ' || count(*) ||
       CASE WHEN count(*)=1 THEN ' ✅ 방어됨' ELSE ' ❌ 뚫림' END
  FROM public.seoul_service_domains WHERE program='seoul' AND code='housing';

\echo ''
\echo '=== 검증 종료: 위에 ❌ 가 하나도 없어야 계약 통과 ==='
