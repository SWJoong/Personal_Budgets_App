-- =====================================================================
-- 검증 — 사회 관계망 (seoul_network_entities) 스키마 + RLS 계약 (Track B · B1)
--
-- 설계출처: Plan&Source/goala_relationship_network_crud_W.md (§1 데이터모델, RLS=staff-only)
-- 배경: 당사자의 사회적 관계망(가족/친구/유급지원/지역사회 4분면)을 사회복지사가 CRUD 하는 신규
--       테이블. 사용자 결정으로 **실무자 전용**(친밀도 평가·고립 신호 = 사정성 정보) — SELECT·write
--       모두 seoul_is_staff_for. seoul_needs_assessment(09) 패턴 미러.
--
-- 확인 항목
--   T0. 테이블·필수 컬럼 존재 (구현 전이면 RED — 이 계약의 RED 게이트)
--   T1a. relation_category CHECK — 4분면 밖 값 거부
--   T1b. closeness CHECK — 1~4 밖 값 거부
--   T1c. FK participant_id → participants, ON DELETE CASCADE
--   S1. 담당 실무자는 담당 당사자의 관계망을 읽는다
--   S2/S3/S4. 담당 실무자는 추가·수정·삭제한다
--   S5. ★staff-only: 당사자 본인은 자기 관계망을 못 읽는다 (사용자 결정)
--   S6. 당사자 본인은 자기 관계망에 못 쓴다 (staff 아님)
--   S7. 남(다른 참여자)은 못 읽고 못 쓴다
--
-- ID 접두: 'da' (hex·다른 verify_*.sql 과 겹치지 않게).
-- 실행 순서: verify_00_auth_stub.sql → supabase/seoul/00,01 → 13_network_entities.sql → 이 파일
--            (network_entities 는 participants·profiles·헬퍼[01]만 의존).
-- CI: .github/workflows/db-verify.yml 의 verify 배열에 verify_network_entities 등록 필요.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;
DO $$ BEGIN CREATE ROLE alice LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT authenticated TO alice;

-- ── 픽스처 ────────────────────────────────────────────────────────────
-- 로그인 id ≠ 내부 키(participants.id) — 우연 일치로 결함 가려짐 방지(verify_02 관습).
INSERT INTO auth.users (id, email) VALUES
  ('daaaaaaa-0000-0000-0000-0000000000a1','ne-a-login@test.local'),   -- 당사자A 로그인
  ('dabbbbbb-0000-0000-0000-0000000000b1','ne-b-login@test.local'),   -- 당사자B 로그인(남)
  ('da000000-0000-0000-0000-0000000000ff','ne-staff@test.local')      -- 담당 실무자
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, name) VALUES
  ('daaaaaaa-0000-0000-0000-0000000000a1','participant','관계망당사자A'),
  ('dabbbbbb-0000-0000-0000-0000000000b1','participant','관계망당사자B'),
  ('da000000-0000-0000-0000-0000000000ff','supporter','관계망실무자')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('da111111-1111-1111-1111-111111111111','관계망당사자A',
     'daaaaaaa-0000-0000-0000-0000000000a1','da000000-0000-0000-0000-0000000000ff'),
  ('da222222-2222-2222-2222-222222222222','관계망당사자B',
     'dabbbbbb-0000-0000-0000-0000000000b1','da000000-0000-0000-0000-0000000000ff')
ON CONFLICT (id) DO NOTHING;

\echo '=== T0. 스키마 계약: seoul_network_entities 테이블·컬럼 (구현 전이면 RED) ==='
SELECT '   T0a. 테이블 존재: ' ||
       CASE WHEN to_regclass('public.seoul_network_entities') IS NOT NULL THEN '✅' ELSE '❌ 없음(구현 대기)' END;
SELECT '   T0b. 필수 컬럼 11개 전부 존재: ' ||
       CASE WHEN (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='seoul_network_entities'
                    AND column_name IN ('id','participant_id','relation_category','entity_name','relation_type',
                                        'closeness','contact_frequency','last_contact_date','linked_profile_id',
                                        'created_by','created_at')) = 11
            THEN '✅' ELSE '❌ 누락' END;
SELECT '   T0c. participant_id NOT NULL: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='seoul_network_entities' AND column_name='participant_id' AND is_nullable='NO')
            THEN '✅' ELSE '❌' END;
SELECT '   T0d. relation_category NOT NULL: ' ||
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='seoul_network_entities' AND column_name='relation_category' AND is_nullable='NO')
            THEN '✅' ELSE '❌' END;

-- 픽스처: A 의 가족 1명(소유자/superuser 권한, RLS 우회).
INSERT INTO public.seoul_network_entities
  (id, participant_id, relation_category, entity_name, relation_type, closeness, contact_frequency, created_by)
VALUES
  ('da700000-0000-0000-0000-0000000000a1','da111111-1111-1111-1111-111111111111',
   'family','김엄마','엄마',1,'주 3회','da000000-0000-0000-0000-0000000000ff')
ON CONFLICT (id) DO NOTHING;

\echo ''
\echo '=== T1. 제약 계약 ==='
\echo '── T1a. relation_category 4분면 밖 값 거부'
INSERT INTO public.seoul_network_entities (id, participant_id, relation_category, entity_name)
VALUES ('da700000-0000-0000-0000-0000000000c1','da111111-1111-1111-1111-111111111111','coworker','불량분면');
SELECT '   잘못된 분면 삽입 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ CHECK 방어' ELSE '  ❌ 뚫림' END
  FROM public.seoul_network_entities WHERE id='da700000-0000-0000-0000-0000000000c1';
\echo '── T1b. closeness 1~4 밖 값 거부'
INSERT INTO public.seoul_network_entities (id, participant_id, relation_category, entity_name, closeness)
VALUES ('da700000-0000-0000-0000-0000000000c2','da111111-1111-1111-1111-111111111111','friend','과도친밀',5);
SELECT '   closeness=5 삽입 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ CHECK 방어' ELSE '  ❌ 뚫림' END
  FROM public.seoul_network_entities WHERE id='da700000-0000-0000-0000-0000000000c2';
\echo '── T1c. FK participant_id ON DELETE CASCADE (당사자 지우면 관계망도 사라진다)'
INSERT INTO public.participants (id, name, auth_user_id, assigned_supporter_id) VALUES
  ('da333333-3333-3333-3333-333333333333','삭제용당사자',NULL,'da000000-0000-0000-0000-0000000000ff')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.seoul_network_entities (id, participant_id, relation_category, entity_name)
VALUES ('da700000-0000-0000-0000-0000000000c9','da333333-3333-3333-3333-333333333333','friend','삭제될관계');
DELETE FROM public.participants WHERE id='da333333-3333-3333-3333-333333333333';
SELECT '   지운 당사자의 관계망 잔여: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ CASCADE' ELSE '  ❌ 안 지워짐' END
  FROM public.seoul_network_entities WHERE id='da700000-0000-0000-0000-0000000000c9';

\echo ''
\echo '=== 담당 실무자 — 반드시 되어야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'da000000-0000-0000-0000-0000000000ff';
\echo '── S1. 담당 실무자가 A 의 관계망 열람'
SELECT '   실무자가 본 A 관계망: ' || count(*) ||
       CASE WHEN count(*)>=1 THEN '  ✅' ELSE '  ❌ 실무자가 못 봄' END
  FROM public.seoul_network_entities WHERE participant_id='da111111-1111-1111-1111-111111111111';
\echo '── S2. 담당 실무자가 A 관계망에 추가'
INSERT INTO public.seoul_network_entities (id, participant_id, relation_category, entity_name, relation_type, closeness)
VALUES ('da700000-0000-0000-0000-0000000000f1','da111111-1111-1111-1111-111111111111','friend','박친구','친구',2);
SELECT '   실무자 추가 성공: ' || count(*) ||
       CASE WHEN count(*)=1 THEN '  ✅' ELSE '  ❌ 실무자가 막힘' END
  FROM public.seoul_network_entities WHERE id='da700000-0000-0000-0000-0000000000f1';
\echo '── S3. 담당 실무자가 수정'
UPDATE public.seoul_network_entities SET closeness=1 WHERE id='da700000-0000-0000-0000-0000000000f1';
SELECT '   수정 반영: ' || COALESCE(max(closeness)::text,'없음') ||
       CASE WHEN max(closeness)=1 THEN '  ✅' ELSE '  ❌ 수정 안 됨' END
  FROM public.seoul_network_entities WHERE id='da700000-0000-0000-0000-0000000000f1';
\echo '── S4. 담당 실무자가 삭제'
DELETE FROM public.seoul_network_entities WHERE id='da700000-0000-0000-0000-0000000000f1';
SELECT '   삭제 후 잔여: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅' ELSE '  ❌ 삭제 안 됨' END
  FROM public.seoul_network_entities WHERE id='da700000-0000-0000-0000-0000000000f1';
RESET ROLE;

\echo ''
\echo '=== 당사자 본인(A) — staff-only 라 막혀야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'daaaaaaa-0000-0000-0000-0000000000a1';
\echo '── S5. ★본인이 자기 관계망 열람 시도 (staff-only → 0 이어야)'
SELECT '   본인이 본 자기 관계망: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ staff-only 방어' ELSE '  ❌ 당사자에게 노출됨' END
  FROM public.seoul_network_entities WHERE participant_id='da111111-1111-1111-1111-111111111111';
\echo '── S6. 본인이 자기 관계망에 추가 시도 (staff 아님 → 막힘)'
INSERT INTO public.seoul_network_entities (id, participant_id, relation_category, entity_name)
VALUES ('da700000-0000-0000-0000-0000000000e1','da111111-1111-1111-1111-111111111111','family','본인추가시도');
RESET ROLE;
SELECT '   본인 무단추가 성공 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_network_entities WHERE id='da700000-0000-0000-0000-0000000000e1';

\echo ''
\echo '=== 남(당사자B) — 반드시 막혀야 하는 것 ==='
SET ROLE alice;
SET request.jwt.claim.sub = 'dabbbbbb-0000-0000-0000-0000000000b1';
\echo '── S7a. 남이 A 관계망 열람 시도'
SELECT '   B 가 본 A 관계망: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_network_entities WHERE participant_id='da111111-1111-1111-1111-111111111111';
\echo '── S7b. 남이 A 관계망에 삽입 시도'
INSERT INTO public.seoul_network_entities (id, participant_id, relation_category, entity_name)
VALUES ('da700000-0000-0000-0000-0000000000e2','da111111-1111-1111-1111-111111111111','friend','무단삽입');
RESET ROLE;
SELECT '   B 의 무단삽입 성공 건수: ' || count(*) ||
       CASE WHEN count(*)=0 THEN '  ✅ 방어됨' ELSE '  ❌ 뚫림' END
  FROM public.seoul_network_entities WHERE id='da700000-0000-0000-0000-0000000000e2';

\echo ''
\echo '=== 관계망(seoul_network_entities) 계약 검증 끝 ==='
