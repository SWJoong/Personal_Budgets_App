-- ============================================================
-- 테스트 데이터 시드 (Supabase SQL Editor에서 실행)
-- ============================================================
-- 
-- ⚠️ 주의: 이 SQL은 schema.sql 실행 후에 실행해야 합니다.
-- ⚠️ auth.users에 이미 로그인한 사용자가 있어야 합니다.
--    아래 UUID를 실제 사용자의 UUID로 교체하세요.
--
-- Supabase Dashboard → Authentication → Users 에서 UUID를 확인할 수 있습니다.

-- ============================================================
-- 1. 프로필 역할 업데이트 (로그인 후 트리거로 생성된 프로필의 역할 변경)
-- ============================================================
-- 관리자 설정 (첫 번째 로그인 사용자를 관리자로 변경)
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_ADMIN_UUID';

-- 지원자 설정
-- UPDATE public.profiles SET role = 'supporter' WHERE id = 'YOUR_SUPPORTER_UUID';

-- ============================================================
-- 2. 당사자 예산 프로필 등록 (관리자가 등록하는 구조)
-- ============================================================
-- 아래 'PARTICIPANT_UUID'를 당사자 역할의 실제 사용자 UUID로 교체하세요.
-- 'SUPPORTER_UUID'를 담당 지원자의 실제 사용자 UUID로 교체하세요.

-- INSERT INTO public.participants (
--   id, monthly_budget_default, yearly_budget_default,
--   budget_start_date, budget_end_date,
--   funding_source_count, alert_threshold, assigned_supporter_id
-- ) VALUES (
--   'PARTICIPANT_UUID',
--   150000,            -- 월 예산 15만원
--   1500000,           -- 연 예산 150만원
--   '2026-03-01',      -- 운영 시작일
--   '2026-12-31',      -- 운영 종료일
--   2,                 -- 재원 수: 2개
--   15000,             -- 경고 기준액: 15,000원
--   'SUPPORTER_UUID'   -- 담당 지원자
-- );

-- ============================================================
-- 3. 재원 등록 (2개 재원)
-- ============================================================

-- 재원 1: 주 재원
-- INSERT INTO public.funding_sources (
--   participant_id, name, monthly_budget, yearly_budget,
--   current_month_balance, current_year_balance
-- ) VALUES (
--   'PARTICIPANT_UUID',
--   '주 재원 (개인예산)',
--   100000,            -- 월 10만원
--   1000000,           -- 연 100만원
--   100000,            -- 이번 달 잔액 (초기)
--   1000000            -- 올해 잔액 (초기)
-- );

-- 재원 2: 보조 재원
-- INSERT INTO public.funding_sources (
--   participant_id, name, monthly_budget, yearly_budget,
--   current_month_balance, current_year_balance
-- ) VALUES (
--   'PARTICIPANT_UUID',
--   '보조 재원 (활동지원)',
--   50000,             -- 월 5만원
--   500000,            -- 연 50만원
--   50000,             -- 이번 달 잔액 (초기)
--   500000             -- 올해 잔액 (초기)
-- );

-- ============================================================
-- 4. 샘플 사용 내역 (선택 사항)
-- ============================================================

-- INSERT INTO public.transactions (
--   participant_id, funding_source_id, date, activity_name,
--   amount, category, memo, payment_method, status, creator_id
-- ) VALUES (
--   'PARTICIPANT_UUID',
--   'FUNDING_SOURCE_1_UUID',  -- 재원 1의 UUID
--   '2026-03-15',
--   '카페 방문',
--   8500,
--   '여가활동',
--   '아메리카노 2잔',
--   '체크카드',
--   'confirmed',
--   'SUPPORTER_UUID'
-- );
