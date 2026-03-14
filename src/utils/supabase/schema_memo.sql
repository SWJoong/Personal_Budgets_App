-- Supabase Auth의 users 테이블은 자동 생성됩니다.
-- 이 스키마 메모는 커스텀 profiles 테이블이나 
-- 향후 확장될 participants, budgets, transactions 등에 대한 가이드를 제공합니다.

-- 1. Profiles Table (선택형 확장, users 테이블의 id를 외래키로 참조)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'supporter', 'participant')),
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- RLS (Row Level Security) 정책 예시
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert their own profile."
  ON profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
  ON profiles FOR UPDATE
  USING ( auth.uid() = id );
