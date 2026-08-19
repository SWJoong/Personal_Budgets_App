-- 07: 6개 이메일 계정을 관리자(admin)로 설정
-- Supabase SQL Editor에서 실행

-- profiles 테이블에서 해당 이메일의 사용자를 admin으로 업데이트
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'ahreum217@nowondaycare.org',
    'valuesh@nowondaycare.org',
    'tpdnr9870@nowondaycare.org',
    '0305ysy@nowondaycare.org',
    'soujin1020@nowondaycare.org',
    'green4869@nowondaycare.org'
  )
);

-- 변경 확인
SELECT p.id, p.name, p.role, u.email
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email IN (
  'ahreum217@nowondaycare.org',
  'valuesh@nowondaycare.org',
  'tpdnr9870@nowondaycare.org',
  '0305ysy@nowondaycare.org',
  'soujin1020@nowondaycare.org',
  'green4869@nowondaycare.org'
);
