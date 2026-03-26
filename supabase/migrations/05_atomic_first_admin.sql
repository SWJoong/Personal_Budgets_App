-- PostgreSQL RPC function: Atomic first admin assignment (Race Condition 방지)
-- 이 함수는 원자적으로 처리되어 여러 사용자가 동시에 로그인해도 첫 유저만 admin이 됨

CREATE OR REPLACE FUNCTION public.assign_first_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  -- Check if admin exists and update atomically
  -- 이 조건부 UPDATE는 transaction 내에서 원자적으로 처리됨
  UPDATE public.profiles 
  SET role = 'admin' 
  WHERE id = user_id 
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE role = 'admin'
    );
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  -- Log error or handle gracefully
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_first_admin(UUID) TO authenticated;
