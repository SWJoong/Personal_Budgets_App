# 데이터 모델 정의

## profiles (사용자 프로필)
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  display_name TEXT NOT NULL,          -- 쉬운 이름 (발달장애인 이용자)
  support_level INT DEFAULT 1,         -- 1: 독립, 2: 부분 지원, 3: 전면 지원
  guardian_id UUID REFERENCES profiles(id), -- 보호자/지원자
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## budgets (예산)
```sql
CREATE TABLE budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,                  -- 예: "이번 달 생활비"
  amount NUMERIC(12,2) NOT NULL,       -- 예산 금액
  period_type TEXT NOT NULL,           -- daily/weekly/monthly/quarterly
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## expenses (지출)
```sql
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  budget_id UUID REFERENCES budgets(id) NOT NULL,
  category_id UUID REFERENCES categories(id),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,                    -- 쉬운 언어로 작성
  expense_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## categories (카테고리)
```sql
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id), -- NULL이면 시스템 기본 카테고리
  name TEXT NOT NULL,                  -- 예: "밥값", "교통비"
  icon TEXT,                           -- 이모지 또는 아이콘 코드
  color TEXT                           -- 색상 코드
);
```

## 주요 RLS 정책
```sql
-- budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_budgets" ON budgets FOR ALL
  USING (auth.uid() = user_id);

-- expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_expenses" ON expenses FOR ALL
  USING (auth.uid() = user_id);

-- 보호자는 피보호인 데이터 읽기 가능
CREATE POLICY "guardian_read_access" ON budgets FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM profiles WHERE guardian_id = auth.uid()
    )
  );
```

## 핵심 집계 쿼리
```sql
-- 예산 잔액 계산 함수
CREATE OR REPLACE FUNCTION get_budget_remaining(budget_uuid UUID)
RETURNS NUMERIC AS $$
  SELECT b.amount - COALESCE(SUM(e.amount), 0)
  FROM budgets b
  LEFT JOIN expenses e ON e.budget_id = b.id
  WHERE b.id = budget_uuid
  GROUP BY b.amount;
$$ LANGUAGE SQL SECURITY DEFINER;
```
