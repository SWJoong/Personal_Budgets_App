-- =====================================================================
-- 검증용 auth 스텁 — 로컬 PostgreSQL 전용. Supabase 에는 절대 실행하지 말 것.
--
-- 이전 verify_00_stubs.sql 을 대체한다. 그 파일은 profiles/participants 까지
-- 흉내 냈는데, 하필 participants.id 를 profiles.id 참조로 정의해서
-- "participants.id = auth.uid()" 라는 **틀린 신원 모델**을 못 박고 있었다.
-- 그 결과 보안 테스트 15종이 전부 잘못된 전제 위에서 통과했다.
--
-- 이제 코어는 supabase/seoul/01_core.sql 이 진짜로 만든다. 이 파일은
-- Supabase 가 제공하는 auth 스키마만 최소한으로 흉내 낸다.
--
-- 실행 순서:
--   verify_00_auth_stub.sql
--   → supabase/seoul/00_extensions.sql
--   → supabase/seoul/01_core.sql
--   → supabase/seoul/02_core_rls.sql
--   → supabase/seoul/03_seoul_schema.sql
--   → supabase/seoul/04_seoul_rls.sql
--   → supabase/seoul/05_seoul_graph.sql
--   → verify_01_behaviour.sql / verify_02_rls.sql / verify_03_graph.sql
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- 실제 auth.users 에는 컬럼이 훨씬 많지만, 코어가 읽는 것은 이 셋뿐이다.
-- (id / email / raw_user_meta_data — handle_new_user 와 link_participant_to_auth_user)
CREATE TABLE IF NOT EXISTS auth.users (
  id                 UUID PRIMARY KEY,
  email              TEXT,
  raw_user_meta_data JSONB
);

-- Supabase 는 JWT 의 sub 클레임을 auth.uid() 로 노출한다.
-- 테스트에서는 SET request.jwt.claim.sub = '<uuid>' 로 로그인 사용자를 바꾼다.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

DO $$ BEGIN
  CREATE ROLE authenticated;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA auth   TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON auth.users   TO authenticated;

-- ── storage 스키마 최소 흉내 ────────────────────────────────────────────
-- Supabase 의 storage 스키마는 로컬 PostgreSQL 에 없다. 06_storage.sql 의
-- seoul_storage_owner() 가 storage.foldername() 하나만 쓰므로 그것만 만든다.
-- (버킷·정책은 로컬에서 검증할 수 없다 — 실제 Supabase 에서 확인해야 한다.)
CREATE SCHEMA IF NOT EXISTS storage;

CREATE OR REPLACE FUNCTION storage.foldername(p_name TEXT) RETURNS TEXT[]
  LANGUAGE sql IMMUTABLE
  AS $$ SELECT string_to_array(p_name, '/') $$;

GRANT USAGE ON SCHEMA storage TO authenticated;
