CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TYPE public."UserRole" AS ENUM ('admin','supporter','participant');
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY, role public."UserRole" NOT NULL DEFAULT 'participant',
  name TEXT, avatar_url TEXT, bio TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE public.participants (
  id UUID PRIMARY KEY REFERENCES public.profiles(id),
  monthly_budget_default NUMERIC NOT NULL DEFAULT 0,
  yearly_budget_default  NUMERIC NOT NULL DEFAULT 0,
  budget_start_date DATE, budget_end_date DATE,
  funding_source_count INT NOT NULL DEFAULT 1,
  alert_threshold NUMERIC NOT NULL DEFAULT 0.8,
  assigned_supporter_id UUID REFERENCES public.profiles(id),
  bank_book_copy_url TEXT, bank_cover_url TEXT, ui_preferences JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

-- ─────────────────────────────────────────────────────────────────────
-- 공유 코어에도 RLS 를 건다.
-- 실제 앱의 profiles/participants 에는 RLS 가 있으므로, 스텁에 없으면
-- 검증이 실제보다 관대해진다 (그래프 뷰가 남의 담당자 배정을 노출하는 것을
-- 놓칠 뻔했다).
--
-- ⚠️ 함정: 두 테이블의 정책이 서로를 조회하면 무한 재귀가 난다
--    (participants 정책이 profiles 를 보고, profiles 정책이 participants 를 봄).
--    SECURITY DEFINER 함수로 감싸면 그 안에서는 RLS 가 적용되지 않아 고리가 끊긴다.
--    실제 앱에서도 같은 패턴이 필요하다.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stub_is_admin() RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') $fn$;

CREATE OR REPLACE FUNCTION public.stub_supervises(p_id UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$ SELECT EXISTS (SELECT 1 FROM public.participants
                        WHERE id = p_id AND assigned_supporter_id = auth.uid()) $fn$;

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;

CREATE POLICY participants_visible ON public.participants
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR assigned_supporter_id = auth.uid() OR public.stub_is_admin());

-- 직원(실무자·관리자) 프로필은 서로 보이고, 당사자 프로필은 본인·담당자·관리자만
CREATE POLICY profiles_visible ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR role <> 'participant'
    OR public.stub_supervises(id)
    OR public.stub_is_admin()
  );
