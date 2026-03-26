-- =============================================================
-- 아름드리꿈터 개인예산 관리 앱 - 통합 스키마
-- Supabase 실제 운영 스키마 기준 (2026-03-27 동기화)
-- =============================================================

-- =============================================================
-- 1. TABLES
-- =============================================================

-- 1-1. 프로필 (인증 사용자와 1:1)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID NOT NULL PRIMARY KEY,
  role       TEXT NOT NULL DEFAULT 'participant'
               CHECK (role IN ('admin', 'supporter', 'participant')),
  name       TEXT,
  full_name  TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 1-2. 당사자 (participants) - 프로필과 독립, 자체 인적사항 보유
CREATE TABLE IF NOT EXISTS public.participants (
  id                    UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT,
  email                 TEXT,
  birth_date            DATE,
  disability_type       TEXT,
  support_grade         TEXT,
  monthly_budget_default NUMERIC NOT NULL DEFAULT 150000,
  yearly_budget_default  NUMERIC NOT NULL DEFAULT 1500000,
  budget_start_date     DATE DEFAULT '2026-03-01',
  budget_end_date       DATE DEFAULT '2026-12-31',
  funding_source_count  INTEGER NOT NULL DEFAULT 1,
  alert_threshold       NUMERIC NOT NULL DEFAULT 15000,
  assigned_supporter_id UUID,
  auth_user_id          UUID,
  bank_book_copy_url    TEXT,
  bank_cover_url        TEXT,
  created_at            TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT participants_assigned_supporter_id_fkey
    FOREIGN KEY (assigned_supporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT participants_auth_user_id_fkey
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);

-- 1-3. 재원 (funding_sources)
CREATE TABLE IF NOT EXISTS public.funding_sources (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id        UUID,
  name                  TEXT NOT NULL,
  monthly_budget        NUMERIC NOT NULL,
  yearly_budget         NUMERIC NOT NULL,
  current_month_balance NUMERIC NOT NULL,
  current_year_balance  NUMERIC NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT funding_sources_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE
);

-- 1-4. 거래 내역 (transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id    UUID,
  funding_source_id UUID,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_name     TEXT NOT NULL,
  amount            NUMERIC NOT NULL,
  category          TEXT,
  memo              TEXT,
  payment_method    TEXT,
  receipt_image_url TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed')),
  creator_id        UUID,
  created_at        TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at        TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT transactions_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
  CONSTRAINT transactions_funding_source_id_fkey
    FOREIGN KEY (funding_source_id) REFERENCES public.funding_sources(id),
  CONSTRAINT transactions_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 1-5. 파일 링크 (file_links)
CREATE TABLE IF NOT EXISTS public.file_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID,
  title          TEXT,
  url            TEXT NOT NULL,
  file_type      TEXT NOT NULL
                   CHECK (file_type IN ('계획서', '평가서', '참고자료', '증빙자료', '기타')),
  created_at     TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT file_links_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE
);

-- 1-6. 오늘의 계획 (plans)
CREATE TABLE IF NOT EXISTS public.plans (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id         UUID,
  activity_name          TEXT NOT NULL,
  date                   DATE NOT NULL DEFAULT CURRENT_DATE,
  options                JSONB NOT NULL,       -- [{name, cost, time, icon}]
  selected_option_index  INTEGER,
  creator_id             UUID,
  created_at             TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at             TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT plans_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
  CONSTRAINT plans_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 1-7. PCP 4+1 평가 (evaluations)
CREATE TABLE IF NOT EXISTS public.evaluations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID,
  month          DATE NOT NULL,               -- 평가 대상 월 (e.g. 2026-03-01)
  tried          TEXT,                         -- 시도한 것
  learned        TEXT,                         -- 배운 것
  pleased        TEXT,                         -- 만족하는 것
  concerned      TEXT,                         -- 고민되는 것
  next_step      TEXT,                         -- 향후 계획 (+1)
  ai_analysis    JSONB,                        -- AI 분석 결과
  easy_summary   TEXT,                         -- 당사자용 쉬운 요약
  creator_id     UUID,
  created_at     TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at     TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

  CONSTRAINT evaluations_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES public.participants(id) ON DELETE CASCADE,
  CONSTRAINT evaluations_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE SET NULL,

  UNIQUE(participant_id, month)
);


-- =============================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- =============================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations     ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_by_admin"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

CREATE POLICY "profiles_update_by_admin"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

CREATE POLICY "profiles_delete_by_admin"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- participants ----
CREATE POLICY "participants_select_own"
  ON public.participants FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "participants_select_by_staff"
  ON public.participants FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

CREATE POLICY "participants_all_by_admin"
  ON public.participants FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "participants_insert_by_supporter"
  ON public.participants FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

CREATE POLICY "participants_update_by_supporter"
  ON public.participants FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

-- ---- funding_sources ----
CREATE POLICY "fs_select_own"
  ON public.funding_sources FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.participants WHERE id = participant_id AND auth_user_id = auth.uid())
  );

CREATE POLICY "fs_select_by_staff"
  ON public.funding_sources FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

CREATE POLICY "fs_manage_by_staff"
  ON public.funding_sources FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

-- ---- transactions ----
CREATE POLICY "tx_select_own"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.participants WHERE id = participant_id AND auth_user_id = auth.uid())
  );

CREATE POLICY "tx_insert_own"
  ON public.transactions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.participants WHERE id = participant_id AND auth_user_id = auth.uid())
  );

CREATE POLICY "tx_select_by_staff"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

CREATE POLICY "tx_manage_by_staff"
  ON public.transactions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

-- ---- file_links ----
CREATE POLICY "fl_select_own"
  ON public.file_links FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.participants WHERE id = participant_id AND auth_user_id = auth.uid())
  );

CREATE POLICY "fl_manage_by_staff"
  ON public.file_links FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

-- ---- plans ----
CREATE POLICY "plans_select_own"
  ON public.plans FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.participants WHERE id = participant_id AND auth_user_id = auth.uid())
  );

CREATE POLICY "plans_update_own"
  ON public.plans FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.participants WHERE id = participant_id AND auth_user_id = auth.uid())
  );

CREATE POLICY "plans_manage_by_staff"
  ON public.plans FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );

-- ---- evaluations ----
CREATE POLICY "eval_select_own"
  ON public.evaluations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.participants WHERE id = participant_id AND auth_user_id = auth.uid())
  );

CREATE POLICY "eval_manage_by_staff"
  ON public.evaluations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
  );


-- =============================================================
-- 3. FUNCTIONS & TRIGGERS
-- =============================================================

-- 3-1. 프로필 자동 생성 트리거 (회원가입 시)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name, full_name, email, created_at)
  VALUES (
    NEW.id,
    'participant',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3-2. 잔액 자동 계산 트리거 (거래 변경 시)
CREATE OR REPLACE FUNCTION public.calculate_funding_source_balance()
RETURNS TRIGGER AS $$
DECLARE
  target_fs_id       UUID;
  total_spent_month  NUMERIC;
  total_spent_year   NUMERIC;
  budget_monthly     NUMERIC;
  budget_yearly      NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_fs_id := OLD.funding_source_id;
  ELSE
    target_fs_id := NEW.funding_source_id;
  END IF;

  SELECT monthly_budget, yearly_budget
    INTO budget_monthly, budget_yearly
    FROM public.funding_sources
   WHERE id = target_fs_id;

  SELECT COALESCE(SUM(amount), 0) INTO total_spent_month
    FROM public.transactions
   WHERE funding_source_id = target_fs_id
     AND status = 'confirmed'
     AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

  SELECT COALESCE(SUM(amount), 0) INTO total_spent_year
    FROM public.transactions
   WHERE funding_source_id = target_fs_id
     AND status = 'confirmed'
     AND date_trunc('year', date) = date_trunc('year', CURRENT_DATE);

  UPDATE public.funding_sources
     SET current_month_balance = budget_monthly - total_spent_month,
         current_year_balance  = budget_yearly  - total_spent_year
   WHERE id = target_fs_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_calculate_balance ON public.transactions;
CREATE TRIGGER trigger_calculate_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_funding_source_balance();

-- 3-3. 첫 관리자 원자적 할당 (Race Condition 방지)
CREATE OR REPLACE FUNCTION public.assign_first_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.profiles
     SET role = 'admin'
   WHERE id = user_id
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin');
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.assign_first_admin(UUID) TO authenticated;


-- =============================================================
-- 4. 관리자 계정 자동 설정
-- =============================================================
-- 아래 이메일 계정으로 로그인 시 자동으로 admin 역할 부여됨
-- (앱 코드: src/app/actions/admin.ts → ensureAdminAccount)
--
-- cheese0318@nowondaycare.org
-- ahreum217@nowondaycare.org
-- valuesh@nowondaycare.org
-- tpdnr9870@nowondaycare.org
-- 0305ysy@nowondaycare.org
-- soujin1020@nowondaycare.org
-- green4869@nowondaycare.org
