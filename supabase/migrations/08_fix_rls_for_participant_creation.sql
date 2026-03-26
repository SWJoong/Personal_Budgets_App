-- 08: Admin/Supporter가 profiles INSERT 가능하도록 RLS 정책 추가
-- 당사자 등록 시 admin이 profiles 테이블에 새 레코드를 삽입해야 함
-- 기존 정책은 auth.uid() = id 조건이므로 다른 사용자의 프로필 생성 불가

-- Admin/Supporter가 profiles INSERT 가능
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
);

-- Admin/Supporter가 participants INSERT 가능
DROP POLICY IF EXISTS "Admins can insert participants" ON public.participants;
CREATE POLICY "Admins can insert participants" ON public.participants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
);

-- Admin/Supporter가 funding_sources INSERT 가능
DROP POLICY IF EXISTS "Admins can insert funding sources" ON public.funding_sources;
CREATE POLICY "Admins can insert funding sources" ON public.funding_sources FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
);

-- Admin이 profiles DELETE 가능 (롤백용)
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Admin/Supporter가 profiles UPDATE 가능 (역할 변경 등)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'supporter'))
);
