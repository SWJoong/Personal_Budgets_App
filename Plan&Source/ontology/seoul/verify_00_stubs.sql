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
