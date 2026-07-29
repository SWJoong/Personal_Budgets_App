-- =====================================================================
-- 02. 코어 RLS — profiles / participants / user_invitations
--
-- 헬퍼 함수(seoul_is_admin 등)는 01_core.sql §7 에 이미 정의되어 있다.
-- 이 파일은 정책만 둔다.
-- =====================================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────
-- profiles
-- INSERT 정책이 없다 — 의도적이다. profiles 행은 handle_new_user() 트리거
-- (SECURITY DEFINER, 테이블 소유자 권한으로 RLS 우회)만 만들 수 있다.
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.seoul_is_admin() OR role IN ('admin', 'supporter'));
COMMENT ON POLICY profiles_select ON public.profiles IS
  '본인 · 관리자 · 실무자 명단(누구나 담당자 이름을 볼 수 있어야 함)은 공개, 다른 참여자의 행은 비공개.';

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.seoul_is_admin())
  WITH CHECK (auth.uid() = id OR public.seoul_is_admin());
COMMENT ON POLICY profiles_update ON public.profiles IS
  '본인은 이름·아바타 등을 고칠 수 있지만 role/is_super_admin 은 01_core.sql §8 트리거가 별도로 막는다.';


-- ─────────────────────────────────────────────────────────────────────
-- participants
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS participants_select ON public.participants;
CREATE POLICY participants_select ON public.participants FOR SELECT
  USING (public.seoul_can_access(id));

DROP POLICY IF EXISTS participants_insert ON public.participants;
CREATE POLICY participants_insert ON public.participants FOR INSERT
  WITH CHECK (public.seoul_is_admin());
COMMENT ON POLICY participants_insert ON public.participants IS
  '참여자 등록은 관리자만 한다. 이메일을 함께 넣어야 이후 로그인 시 자동 연결된다.';

DROP POLICY IF EXISTS participants_update ON public.participants;
CREATE POLICY participants_update ON public.participants FOR UPDATE
  USING (public.seoul_can_access(id))
  WITH CHECK (public.seoul_can_access(id));
COMMENT ON POLICY participants_update ON public.participants IS
  '본인도 UPDATE 문 자체는 통과하지만, protect_participant_fields 트리거가 ui_preferences 외 컬럼을 원래 값으로 되돌린다 (본인 편집은 화면 설정뿐).';

DROP POLICY IF EXISTS participants_delete ON public.participants;
CREATE POLICY participants_delete ON public.participants FOR DELETE
  USING (public.seoul_is_admin());

-- 본인이 담당자 배정·연결 계정 등 행정 필드를 직접 바꾸지 못하게 막는다.
-- (참여자가 스스로 담당자를 바꾸거나 다른 로그인 계정에 자기 행을 옮기는 것을 방지)
CREATE OR REPLACE FUNCTION public.protect_participant_fields()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  -- auth.uid() 가 NULL 인 호출(서비스 롤 클라이언트, SQL Editor, 시드 스크립트)은
  -- protect_profile_role() 과 같은 이유로 신뢰된 경로로 보고 통과시킨다.
  -- 이 예외가 없으면 08_seed_demo.sql 자신의 담당자 배정 UPDATE 조차
  -- 이 트리거가 조용히 되돌려 버린다 (auth.uid() NULL → seoul_is_staff_for = FALSE).
  IF auth.uid() IS NOT NULL AND NOT public.seoul_is_staff_for(OLD.id) THEN
    NEW.name                  := OLD.name;
    NEW.email                 := OLD.email;
    NEW.auth_user_id          := OLD.auth_user_id;
    NEW.birth_date            := OLD.birth_date;
    NEW.disability_type       := OLD.disability_type;
    NEW.support_grade         := OLD.support_grade;
    NEW.assigned_supporter_id := OLD.assigned_supporter_id;
    -- ui_preferences 는 본인도 바꿀 수 있게 그대로 둔다 (화면 블록 표시 설정).
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_participant_fields ON public.participants;
CREATE TRIGGER trg_protect_participant_fields
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.protect_participant_fields();


-- ─────────────────────────────────────────────────────────────────────
-- user_invitations — 관리자만 읽고 쓴다
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS user_invitations_admin_all ON public.user_invitations;
CREATE POLICY user_invitations_admin_all ON public.user_invitations FOR ALL
  USING (public.seoul_is_admin())
  WITH CHECK (public.seoul_is_admin());
