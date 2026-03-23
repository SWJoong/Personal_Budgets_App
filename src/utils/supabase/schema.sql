-- Phase 2: Budget Management & Visualization Schema

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  role INTEGER NOT NULL DEFAULT 2 CHECK (role IN (0, 1, 2)), -- 0: admin, 1: supporter, 2: participant
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Participants Table
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  monthly_budget_default NUMERIC NOT NULL DEFAULT 150000,
  yearly_budget_default NUMERIC NOT NULL DEFAULT 1500000,
  budget_start_date DATE DEFAULT '2026-03-01',
  budget_end_date DATE DEFAULT '2026-12-31',
  funding_source_count INTEGER NOT NULL DEFAULT 1,
  alert_threshold NUMERIC NOT NULL DEFAULT 15000,
  assigned_supporter_id UUID REFERENCES public.profiles(id),
  bank_book_copy_url TEXT,
  bank_cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Funding Sources Table
CREATE TABLE IF NOT EXISTS public.funding_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  monthly_budget NUMERIC NOT NULL,
  yearly_budget NUMERIC NOT NULL,
  current_month_balance NUMERIC NOT NULL,
  current_year_balance NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  funding_source_id UUID REFERENCES public.funding_sources(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT,
  memo TEXT,
  payment_method TEXT,
  receipt_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  creator_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. File Links Table
CREATE TABLE IF NOT EXISTS public.file_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('계획서', '평가서', '참고자료', '증빙자료', '기타')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_links ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone authenticated can view, only owner can update
DROP POLICY IF EXISTS "Profiles viewable by all authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by all authenticated users" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Participants: Participant sees own, Supporter/Admin see all (Numeric roles: 0, 1)
DROP POLICY IF EXISTS "Participants see own" ON public.participants;
CREATE POLICY "Participants see own" ON public.participants FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Supporters/Admins see all participants" ON public.participants;
CREATE POLICY "Supporters/Admins see all participants" ON public.participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (0, 1))
);

-- Funding Sources: Link to participant visibility
DROP POLICY IF EXISTS "Participants see own funding sources" ON public.funding_sources;
CREATE POLICY "Participants see own funding sources" ON public.funding_sources FOR SELECT USING (participant_id = auth.uid());
DROP POLICY IF EXISTS "Supporters/Admins see all funding sources" ON public.funding_sources;
CREATE POLICY "Supporters/Admins see all funding sources" ON public.funding_sources FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (0, 1))
);

-- Transactions: Link to participant visibility
DROP POLICY IF EXISTS "Participants see own transactions" ON public.transactions;
CREATE POLICY "Participants see own transactions" ON public.transactions FOR SELECT USING (participant_id = auth.uid());
DROP POLICY IF EXISTS "Supporters/Admins see all transactions" ON public.transactions;
CREATE POLICY "Supporters/Admins see all transactions" ON public.transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (0, 1))
);
DROP POLICY IF EXISTS "Participants can insert own transactions" ON public.transactions;
CREATE POLICY "Participants can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (participant_id = auth.uid());
DROP POLICY IF EXISTS "Supporters/Admins can manage transactions" ON public.transactions;
CREATE POLICY "Supporters/Admins can manage transactions" ON public.transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (0, 1))
);

-- File Links Policies
DROP POLICY IF EXISTS "Participants see own file links" ON public.file_links;
CREATE POLICY "Participants see own file links" ON public.file_links FOR SELECT USING (participant_id = auth.uid());
DROP POLICY IF EXISTS "Supporters/Admins can manage file links" ON public.file_links;
CREATE POLICY "Supporters/Admins can manage file links" ON public.file_links FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (0, 1))
);

-- Profiles INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Profile Auto-Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name, created_at)
  VALUES (
    NEW.id,
    2,  -- Default: participant
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Balance Calculation Trigger
CREATE OR REPLACE FUNCTION public.calculate_funding_source_balance()
RETURNS TRIGGER AS $$
DECLARE
  target_funding_source_id UUID;
  total_spent_month NUMERIC;
  total_spent_year NUMERIC;
  default_monthly_budget NUMERIC;
  default_yearly_budget NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_funding_source_id := OLD.funding_source_id;
  ELSE
    target_funding_source_id := NEW.funding_source_id;
  END IF;

  SELECT monthly_budget, yearly_budget INTO default_monthly_budget, default_yearly_budget
  FROM public.funding_sources
  WHERE id = target_funding_source_id;

  SELECT COALESCE(SUM(amount), 0) INTO total_spent_month
  FROM public.transactions
  WHERE funding_source_id = target_funding_source_id
    AND status = 'confirmed'
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

  SELECT COALESCE(SUM(amount), 0) INTO total_spent_year
  FROM public.transactions
  WHERE funding_source_id = target_funding_source_id
    AND status = 'confirmed'
    AND date_trunc('year', date) = date_trunc('year', CURRENT_DATE);

  UPDATE public.funding_sources
  SET 
    current_month_balance = default_monthly_budget - total_spent_month,
    current_year_balance = default_yearly_budget - total_spent_year
  WHERE id = target_funding_source_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_calculate_balance ON public.transactions;
CREATE TRIGGER trigger_calculate_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_funding_source_balance();
