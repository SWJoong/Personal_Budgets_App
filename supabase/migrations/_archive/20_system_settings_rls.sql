-- 20_system_settings_rls.sql
-- system_settings 테이블 RLS 활성화 (Supabase 보안 경고 대응)
-- 원인: migration 13에서 테이블 생성 시 ENABLE ROW LEVEL SECURITY 누락

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자(admin·supporter·participant)는 설정 읽기 가능
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_settings'
      AND policyname = 'system_settings_select_authenticated'
  ) THEN
    CREATE POLICY "system_settings_select_authenticated"
      ON public.system_settings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 쓰기(INSERT/UPDATE/DELETE)는 admin 역할만 가능
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_settings'
      AND policyname = 'system_settings_write_admin'
  ) THEN
    CREATE POLICY "system_settings_write_admin"
      ON public.system_settings FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;
