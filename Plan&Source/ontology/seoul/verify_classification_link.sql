-- =====================================================================
-- 검증 · GOAL축 B — 분류축 연결 계약 (사정→목표→예산→지출→평가 단일 FK축)
--
-- 스펙: Plan&Source/ontology_db_reform_spec_W.md §3(needs_assessment)·§4(FK화)·§5(연결축)
-- 대상 구현: supabase/seoul/09_ontology_classification.sql (+ 이후 FK-ization 단계)
--
-- ★ 이 파일은 두 부분이다:
--   [A·B·C] 지금 초록이어야 하는 계약 — 무결성(고아 FK 0)·정합성·축 시작점(사정) 조인.
--           여기서 ❌ 가 나오면 실제 결함이다.
--   [D]     "다음 단계(FK-ization)" 의 실패 목표 — 예산·지출(중분류)·평가 hop 에 분류 FK가
--           아직 없어 ❌ 로 뜬다. 이건 U 가 다음 PR 로 초록화할 스펙(test-first)이다.
--
-- 실행: 로컬 임시 PostgreSQL 에 supabase/seoul/00~05 + 09 적용 후 psql -f 이 파일.
--        소유자/superuser 로 실행(픽스처 삽입에 RLS 우회). 픽스처 UUID 접두 '9b'.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
RESET ROLE;

-- ── 픽스처 정리(재실행 가능) — 9b 당사자 삭제 시 needs_assessment 는 CASCADE ──
DELETE FROM public.participants WHERE id='9b111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== [A] 무결성 — 고아 FK 0 (FK 가 보장하지만 계약으로 못박음) ==='

SELECT '   중분류→대분류 고아: ' || count(*) || CASE WHEN count(*)=0 THEN ' ✅' ELSE ' ❌' END
  FROM public.seoul_service_subdomains s
  LEFT JOIN public.seoul_service_domains d ON d.id=s.domain_id
 WHERE d.id IS NULL;

SELECT '   사정→대분류 고아: ' || count(*) || CASE WHEN count(*)=0 THEN ' ✅' ELSE ' ❌' END
  FROM public.seoul_needs_assessment na
  LEFT JOIN public.seoul_service_domains d ON d.id=na.domain_id
 WHERE d.id IS NULL;

SELECT '   사정→중분류 고아(non-null만): ' || count(*) || CASE WHEN count(*)=0 THEN ' ✅' ELSE ' ❌' END
  FROM public.seoul_needs_assessment na
  LEFT JOIN public.seoul_service_subdomains s ON s.id=na.subdomain_id
 WHERE na.subdomain_id IS NOT NULL AND s.id IS NULL;

SELECT '   요청서비스→대분류 고아(non-null만): ' || count(*) || CASE WHEN count(*)=0 THEN ' ✅' ELSE ' ❌' END
  FROM public.seoul_requested_services r
  LEFT JOIN public.seoul_service_domains d ON d.id=r.domain_id
 WHERE r.domain_id IS NOT NULL AND d.id IS NULL;

SELECT '   지출→대분류 고아(non-null만): ' || count(*) || CASE WHEN count(*)=0 THEN ' ✅' ELSE ' ❌' END
  FROM public.seoul_service_usages u
  LEFT JOIN public.seoul_service_domains d ON d.id=u.domain_id
 WHERE u.domain_id IS NOT NULL AND d.id IS NULL;

SELECT '   지출→중분류 고아(non-null만): ' || count(*) || CASE WHEN count(*)=0 THEN ' ✅' ELSE ' ❌' END
  FROM public.seoul_service_usages u
  LEFT JOIN public.seoul_service_subdomains s ON s.id=u.subdomain_id
 WHERE u.subdomain_id IS NOT NULL AND s.id IS NULL;

\echo ''
\echo '=== [B] 정합성 계약 — 사정·지출의 (domain,subdomain)·(program,domain) 일치 ==='
\echo '     (현재 복합 FK/트리거 미설치면 ❌ — U 가 seoul_service_subdomains(id,domain_id)'
\echo '      복합 UNIQUE + needs_assessment 복합 FK 로 초록화)'

-- 픽스처: 9b 당사자
INSERT INTO public.participants (id, name)
VALUES ('9b111111-1111-1111-1111-111111111111','축B검증-당사자')
ON CONFLICT (id) DO NOTHING;

\echo '── B1. 음성: domain=seoul/daily_living 인데 subdomain=mohw/physical_health 하위 → 막혀야 함'
INSERT INTO public.seoul_needs_assessment (id, participant_id, program, domain_id, subdomain_id)
SELECT '9b333333-3333-3333-3333-333333333333',
       '9b111111-1111-1111-1111-111111111111','seoul',
       (SELECT id FROM public.seoul_service_domains WHERE program='seoul' AND code='daily_living'),
       (SELECT s.id FROM public.seoul_service_subdomains s
          JOIN public.seoul_service_domains d ON d.id=s.domain_id
         WHERE d.program='mohw' AND d.code='physical_health' AND s.code='rehabilitation');
SELECT '   교차(domain≠subdomain.domain) 행: ' || count(*) ||
       CASE WHEN count(*)=0 THEN ' ✅ 방어됨' ELSE ' ❌ 미방어 — 복합 FK 필요' END
  FROM public.seoul_needs_assessment na
  JOIN public.seoul_service_subdomains s ON s.id=na.subdomain_id
 WHERE s.domain_id <> na.domain_id;

\echo '── B2. 음성: program=seoul 인데 domain 이 mohw 소속 → 막혀야 함'
INSERT INTO public.seoul_needs_assessment (id, participant_id, program, domain_id)
SELECT '9b444444-4444-4444-4444-444444444444',
       '9b111111-1111-1111-1111-111111111111','seoul',
       (SELECT id FROM public.seoul_service_domains WHERE program='mohw' AND code='physical_health');
SELECT '   program≠domain.program 행: ' || count(*) ||
       CASE WHEN count(*)=0 THEN ' ✅ 방어됨' ELSE ' ❌ 미방어 — CHECK/복합 FK 필요' END
  FROM public.seoul_needs_assessment na
  JOIN public.seoul_service_domains d ON d.id=na.domain_id
 WHERE na.program <> d.program;

-- 정리(다음 섹션 픽스처와 분리)
DELETE FROM public.seoul_needs_assessment
 WHERE id IN ('9b333333-3333-3333-3333-333333333333','9b444444-4444-4444-4444-444444444444');

\echo '── B3. 지출 insert 경로 복합 FK — service_usages(subdomain_id,domain_id)→subdomains(id,domain_id)'
\echo '     (지출폼 #39 가 이 두 컬럼을 함께 쓴다. 유효 지출행은 allocation·plan·cohort 전체 체인이'
\echo '      필요해 픽스처가 무거우므로, 여기서는 FK 형태를 카탈로그로 못박는다 — 형태가 이러면 엉뚱한'
\echo '      중분류·대분류 짝 insert 는 DB 가 반드시 거절한다. subdomain_id NULL(서울형 flat)은 MATCH'
\echo '      SIMPLE 로 미검사되어 허용됨.)'
SELECT '   지출 복합 FK (subdomain_id,domain_id)->subdomains(id,domain_id): ' ||
       CASE WHEN EXISTS (
         SELECT 1
           FROM pg_constraint c
           JOIN pg_class rel ON rel.oid = c.conrelid AND rel.relname = 'seoul_service_usages'
          WHERE c.contype = 'f'
            AND pg_get_constraintdef(c.oid)
                ILIKE '%FOREIGN KEY (subdomain_id, domain_id) REFERENCES%seoul_service_subdomains(id, domain_id)%'
       ) THEN '✅ 설치됨(엉뚱한 짝 거절 보장)' ELSE '❌ 복합 FK 부재 — 지출 (중분류,대분류) 정합 깨짐' END;

\echo ''
\echo '=== [C] 축 시작점 — 사정→도메인 라벨 조인 도달(서울형 flat: subdomain NULL 허용) ==='
INSERT INTO public.seoul_needs_assessment (id, participant_id, program, domain_id, limitation, need_hope)
SELECT '9b222222-2222-2222-2222-222222222222',
       '9b111111-1111-1111-1111-111111111111','seoul', d.id,
       '혼자 이동이 어려움','혼자 외출하고 싶어요'
  FROM public.seoul_service_domains d WHERE d.program='seoul' AND d.code='daily_living'
ON CONFLICT (id) DO NOTHING;

SELECT '   사정→대분류 라벨: ' || COALESCE(d.label,'(조인 실패)') ||
       CASE WHEN d.label='일상생활' THEN ' ✅' ELSE ' ❌' END
  FROM public.seoul_needs_assessment na
  JOIN public.seoul_service_domains d ON d.id=na.domain_id
 WHERE na.id='9b222222-2222-2222-2222-222222222222';

SELECT '   서울형 flat(subdomain NULL) 허용: ' ||
       CASE WHEN subdomain_id IS NULL THEN '✅' ELSE '❌' END
  FROM public.seoul_needs_assessment
 WHERE id='9b222222-2222-2222-2222-222222222222';

\echo ''
\echo '=== [D] 다음 단계 목표(FK-ization) — 5노드 단일 분류축 완성 여부 (현재 부분 ❌) ==='
\echo '     스펙 §5: 사정→목표→예산→지출→평가 를 같은 분류 FK 로 조인 도달'

SELECT '   [사정]  needs_assessment.domain_id: ' ||
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='seoul_needs_assessment'
                AND column_name='domain_id') THEN '있음 ✅' ELSE '없음 ❌' END;

SELECT '   [목표]  requested_services.domain_id: ' ||
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='seoul_requested_services'
                AND column_name='domain_id') THEN '있음 ✅' ELSE '없음 ❌' END;

SELECT '   [예산]  budget_allocations.domain_id/subdomain_id: ' ||
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='seoul_budget_allocations'
                AND column_name IN ('domain_id','subdomain_id'))
            THEN '있음 ✅' ELSE '없음 ❌ (FK-ization 목표)' END;

SELECT '   [지출]  service_usages.domain_id(대분류): ' ||
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='seoul_service_usages'
                AND column_name='domain_id') THEN '있음 ✅' ELSE '없음 ❌' END;

SELECT '   [지출]  service_usages.subdomain_id(중분류): ' ||
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='seoul_service_usages'
                AND column_name='subdomain_id')
            THEN '있음 ✅' ELSE '없음 ❌ (FK-ization 목표)' END;

SELECT '   [평가]  settlements.domain_id: ' ||
       CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='seoul_settlements'
                AND column_name='domain_id')
            THEN '있음 ✅' ELSE '없음 ❌ (FK-ization 목표)' END;

SELECT '   ▶ 5노드 단일축 완성: ' ||
       CASE WHEN (
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                 AND table_name='seoul_needs_assessment' AND column_name='domain_id') AND
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                 AND table_name='seoul_requested_services' AND column_name='domain_id') AND
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                 AND table_name='seoul_budget_allocations' AND column_name IN ('domain_id','subdomain_id')) AND
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                 AND table_name='seoul_service_usages' AND column_name='subdomain_id') AND
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                 AND table_name='seoul_settlements' AND column_name='domain_id')
       ) THEN '✅ 전 노드 연결' ELSE '❌ 미완(예산·지출중분류·평가 hop 남음 = 다음 단계)' END;

-- ── 픽스처 정리 ──
DELETE FROM public.participants WHERE id='9b111111-1111-1111-1111-111111111111';

\echo ''
\echo '=== 판정: [A][B][C] ❌ = 실제 결함 / [D] ❌ = 다음 FK-ization 단계 목표(정상) ==='
