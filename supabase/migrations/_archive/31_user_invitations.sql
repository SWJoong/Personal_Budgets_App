-- 1. 사전 등록 테이블 (당사자·관리자 Gmail 사전 등록)
CREATE TABLE public.user_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'participant',  -- 'admin' | 'supporter' | 'participant'
  invited_by UUID REFERENCES public.profiles(id),
  note       TEXT,              -- 당사자 이름 등 메모
  used_at    TIMESTAMPTZ,       -- NULL이면 미사용, 로그인 시 자동 설정
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. profiles에 is_super_admin 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- 3. user_invitations RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_admin_read_write" ON public.user_invitations
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_super_admin = true)
  )
);

-- 4. handle_new_user 트리거 업데이트
--    user_invitations 사전 등록 확인 → @nowondaycare.org 도메인 → 기본 participant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation RECORD;
  v_role       TEXT;
BEGIN
  -- 1. user_invitations 사전 등록 확인
  SELECT * INTO v_invitation
  FROM public.user_invitations
  WHERE email = NEW.email AND used_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    v_role := v_invitation.role;
    UPDATE public.user_invitations SET used_at = now() WHERE id = v_invitation.id;
  -- 2. @nowondaycare.org 도메인 → supporter 자동 배정
  ELSIF NEW.email LIKE '%@nowondaycare.org' THEN
    v_role := 'supporter';
  ELSE
    v_role := 'participant';  -- 미등록 이메일은 콜백에서 차단됨
  END IF;

  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 슈퍼 관리자 설정용 인덱스
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON public.user_invitations(email);

-- ==========================================
-- 배포 후 실행: 슈퍼 관리자 설정 (1회)
-- ==========================================
-- UPDATE public.profiles p
-- SET role = 'admin', is_super_admin = true
-- FROM auth.users u
-- WHERE p.id = u.id
-- AND u.email = 'cheese0318@nowondaycare.org';
