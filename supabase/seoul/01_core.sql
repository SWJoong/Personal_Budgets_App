-- =====================================================================
-- 01. 코어 — profiles / participants / user_invitations + 신원 연결 + RLS 헬퍼
--
-- 신원 모델의 핵심 결정 (자세한 근거는 README.md 참조):
--   · participants.id 는 기관이 먼저 발급하는 내부 키다. 로그인 계정과 무관하다.
--   · participants.auth_user_id 가 로그인 계정과의 연결 고리다. 처음엔 NULL —
--     당사자가 아직 로그인하지 않았을 수 있기 때문이다.
--   · 연결은 이메일 일치로 자동 이루어진다 (아래 handle_new_user / participants_autolink).
--   · "participants.id = auth.uid()" 로 조회하는 코드는 전부 틀렸다 — 기존 앱의
--     핵심 결함이었다. 이 파일 이후로는 auth_user_id 경유만 정답이다.
--
-- 이 파일 안에서 테이블 → 연결 로직 → RLS 헬퍼 순서로 둔 이유:
-- RLS 헬퍼(seoul_is_admin 등)가 참여자 본인 승격 방지 트리거(§8)보다 먼저 있어야
-- 참조가 어긋나지 않는다. 실제 앱에서 set_updated_at() 을 트리거보다 늦게 정의해
-- 배포가 실패했던 것과 같은 종류의 함정을 여기서는 피한다.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- §1. 공용 유틸리티
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 이메일 대소문자·앞뒤 공백 정규화. citext 확장 없이 동일한 효과를 낸다.
CREATE OR REPLACE FUNCTION public.norm_email(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(p_email));
$$;


-- ─────────────────────────────────────────────────────────────────────
-- §2. profiles — auth.users 와 1:1. "이 사람이 무슨 역할인가"
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'participant'
                   CHECK (role IN ('admin', 'supporter', 'participant')),
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  name           TEXT,
  full_name      TEXT,
  email          TEXT,
  avatar_url     TEXT,
  bio            TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.profiles IS
  '로그인 계정(auth.users)과 1:1. 역할(role)은 handle_new_user() 트리거가 정하고, 이후에는 관리자만 바꿀 수 있다(§8 트리거로 강제).';

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- §3. participants — 당사자. 기관이 먼저 등록하고, 로그인은 나중에 연결된다.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.participants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  email                 TEXT,
  auth_user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  birth_date            DATE,
  disability_type       TEXT,
  support_grade         TEXT,
  assigned_supporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ui_preferences        JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.participants IS
  '당사자. id 는 기관이 발급하는 내부 키 — 로그인 계정과 무관하다. auth_user_id 가 채워지기 전까지는 아직 로그인하지 않은 상태다.';
COMMENT ON COLUMN public.participants.auth_user_id IS
  '로그인 계정 연결 고리. handle_new_user()/participants_autolink() 가 이메일 일치로 자동 채운다. RLS 는 관리자·담당자에게만 이 컬럼 쓰기를 허용한다.';

CREATE UNIQUE INDEX IF NOT EXISTS participants_auth_user_id_key
  ON public.participants (auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS participants_email_key
  ON public.participants (public.norm_email(email)) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_participants_assigned_supporter
  ON public.participants (assigned_supporter_id);

DROP TRIGGER IF EXISTS trg_participants_updated_at ON public.participants;
CREATE TRIGGER trg_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- §4. user_invitations — 실무자·관리자 사전 등록 (당사자는 participants.email 로 충분)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'supporter', 'participant')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note       TEXT,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_invitations_email_key
  ON public.user_invitations (public.norm_email(email)) WHERE used_at IS NULL;
COMMENT ON TABLE public.user_invitations IS
  '실무자·관리자를 이메일로 사전 등록한다. 로그인 시 handle_new_user() 가 소비(used_at)와 역할 부여를 한 트랜잭션에서 함께 처리한다 — 예전에는 트리거가 먼저 소비하고 콜백이 나중에 다시 확인해 항상 실패하는 경쟁 조건이 있었다.';


-- ─────────────────────────────────────────────────────────────────────
-- §5. 신원 연결 — 양방향
-- ─────────────────────────────────────────────────────────────────────

-- 방향 1 · 로그인이 나중인 경우: 기관이 참여자를 이메일로 미리 등록해 두면,
-- 그 사람이 구글로 로그인할 때 auth_user_id 를 채운다. 몇 번 불러도 결과가 같다.
CREATE OR REPLACE FUNCTION public.link_participant_to_auth_user(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email TEXT;
  v_pid   UUID;
  v_n     INT;
BEGIN
  SELECT public.norm_email(email) INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_pid FROM public.participants WHERE auth_user_id = p_user_id;
  IF v_pid IS NOT NULL THEN
    RETURN v_pid;  -- 이미 연결됨 — 재호출에 안전
  END IF;

  -- 미연결 + 이메일 일치 행이 "정확히 하나"일 때만 연결한다.
  -- 둘 이상이면 사람이 판단해야 한다 — 임의로 고르면 남의 기록에 잘못 붙는다.
  -- (UUID 에는 min() 집계가 없다 — count 와 id 를 따로 구한다.)
  SELECT count(*) INTO v_n
    FROM public.participants
   WHERE public.norm_email(email) = v_email AND auth_user_id IS NULL;

  IF v_n <> 1 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_pid
    FROM public.participants
   WHERE public.norm_email(email) = v_email AND auth_user_id IS NULL;

  UPDATE public.participants SET auth_user_id = p_user_id WHERE id = v_pid;
  RETURN v_pid;
END;
$$;
COMMENT ON FUNCTION public.link_participant_to_auth_user(UUID) IS
  '이메일이 정확히 하나의 미연결 참여자 행과 일치할 때만 연결한다. handle_new_user() 트리거와 로그인 콜백(자가 치유) 양쪽에서 호출된다.';

-- 방향 2 · 참여자 등록이 나중인 경우: 당사자가 먼저 구글로 로그인해 있었고,
-- 그 뒤 기관이 같은 이메일로 참여자 행을 등록하면 즉시 연결한다.
CREATE OR REPLACE FUNCTION public.participants_autolink()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF NEW.auth_user_id IS NOT NULL OR NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.id INTO v_uid
    FROM auth.users u
   WHERE public.norm_email(u.email) = public.norm_email(NEW.email)
     AND NOT EXISTS (SELECT 1 FROM public.participants p WHERE p.auth_user_id = u.id)
   LIMIT 1;

  NEW.auth_user_id := v_uid;  -- 일치하는 미연결 계정이 없으면 NULL 유지
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participants_autolink ON public.participants;
CREATE TRIGGER trg_participants_autolink
  BEFORE INSERT OR UPDATE OF email ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.participants_autolink();


-- ─────────────────────────────────────────────────────────────────────
-- §6. auth.users 신규 가입 트리거 — profiles 생성 + 초대 소비 + 참여자 연결
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
  v_role       TEXT := 'participant';
BEGIN
  SELECT * INTO v_invitation
    FROM public.user_invitations
   WHERE public.norm_email(email) = public.norm_email(NEW.email) AND used_at IS NULL
   LIMIT 1;

  IF FOUND THEN
    v_role := v_invitation.role;
    UPDATE public.user_invitations SET used_at = NOW() WHERE id = v_invitation.id;
  END IF;
  -- 도메인 기반 실무자 자동 승격은 여기서 하지 않는다 — 그 판단에 쓰는 환경변수
  -- (ALLOWED_EMAIL_DOMAINS)는 SQL 이 읽을 수 없다. 로그인 콜백이 담당한다.

  INSERT INTO public.profiles (id, role, name, full_name, email)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  PERFORM public.link_participant_to_auth_user(NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 첫 관리자 원자적 할당 — SUPER_ADMIN_EMAIL 로 판정되지 않는 경우의 안전망(레이스 방지).
CREATE OR REPLACE FUNCTION public.assign_first_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
     SET role = 'admin'
   WHERE id = user_id
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin');
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.assign_first_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_participant_to_auth_user(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- §7. RLS 헬퍼 — 이름은 seoul_ 접두어를 쓴다
--
-- 이 함수들 자체는 코어(profiles/participants)에 관한 것이라 seoul_ 접두어가
-- 어색하지만, seoul_schema_draft.sql 의 74개 정책이 이미 이 이름들을 참조한다.
-- 이름을 바꾸면 정책 74개를 전부 고쳐야 하므로, 정본은 여기 하나만 두고
-- 04_seoul_rls.sql 은 이 함수들을 재정의하지 않는다.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seoul_is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- 로그인한 사용자 본인의 participants.id (연결되어 있지 않으면 NULL).
CREATE OR REPLACE FUNCTION public.seoul_self_participant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.participants WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.seoul_is_self(p_participant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.participants
     WHERE id = p_participant_id AND auth_user_id = auth.uid()
  );
$$;
COMMENT ON FUNCTION public.seoul_is_self(UUID) IS
  '기존 결함의 수정판. 예전에는 auth.uid() = p_participant_id 로 비교했는데, participants.id 는 로그인 계정과 무관한 내부 키라 실제 참여자는 절대 자기 데이터를 볼 수 없었다. auth_user_id 경유로 고쳤다.';

CREATE OR REPLACE FUNCTION public.seoul_is_staff_for(p_participant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    public.seoul_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.participants pt
       WHERE pt.id = p_participant_id AND pt.assigned_supporter_id = auth.uid()
    );
$$;
COMMENT ON FUNCTION public.seoul_is_staff_for(UUID) IS
  'seoul_can_access 와 달리 본인을 포함하지 않는다. 행정 기록(심의·배정·통지·자격)의 쓰기 판정에 쓴다.';

CREATE OR REPLACE FUNCTION public.seoul_can_access(p_participant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.seoul_is_self(p_participant_id) OR public.seoul_is_staff_for(p_participant_id);
$$;

-- 하위 호환 별칭 — 트리거·문서에서 일반명으로 쓴다.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$ SELECT public.seoul_is_admin(); $$;


-- ─────────────────────────────────────────────────────────────────────
-- §8. 참여자 본인이 profiles.role / is_super_admin 을 직접 바꾸지 못하게 막는다
--
-- auth.uid() 가 NULL 인 호출(서비스 롤 관리자 클라이언트 — 초대·역할변경 화면,
-- assign_first_admin RPC 등)은 신뢰된 경로로 보고 통과시킨다.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.seoul_is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
      NEW.is_super_admin := OLD.is_super_admin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.protect_profile_role() IS
  '참여자·실무자가 스스로를 admin 으로 승격시키는 것을 서버에서 막는다. 이전 세션에서 유사한 권한 상승 결함(참여자가 RLS 허점으로 관리자 전용 컬럼을 쓸 수 있었던 사례)을 실제로 발견한 적이 있어 방어적으로 추가한다.';

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
