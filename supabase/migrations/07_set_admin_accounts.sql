-- 07: 최고관리자 계정(cheese0318@gmail.com)을 관리자(admin)로 설정
-- Supabase SQL Editor에서 실행

-- 가입 트리거(handle_new_user)가 이미 처리하지만, 가입 후 역할이 바뀐 경우를 위해 한 번 더 보정한다.
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email = 'cheese0318@gmail.com'
);

-- 변경 확인
SELECT p.id, p.name, p.role, u.email
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'cheese0318@gmail.com';
