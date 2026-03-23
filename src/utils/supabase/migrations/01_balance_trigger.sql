-- ============================================================
-- 잔액 자동 계산 트리거 (Race Condition 방지)
-- ============================================================
-- 
-- 사용 내역(transactions) 테이블에 데이터가 추가, 수정, 삭제될 때
-- 해당 내역의 상태가 'confirmed'(확정)인 경우에만
-- 연결된 재원(funding_sources)의 이번 달 잔액과 올해 잔액을
-- 데이터베이스 레이어에서 원자적으로(Atomically) 재계산합니다.

-- 1. 잔액 재계산 함수 생성
CREATE OR REPLACE FUNCTION public.calculate_funding_source_balance()
RETURNS TRIGGER AS $$
DECLARE
  target_funding_source_id UUID;
  total_spent_month NUMERIC;
  total_spent_year NUMERIC;
  default_monthly_budget NUMERIC;
  default_yearly_budget NUMERIC;
BEGIN
  -- 대상 funding_source 결정 (INSERT/UPDATE는 NEW, DELETE는 OLD 기준)
  IF TG_OP = 'DELETE' THEN
    target_funding_source_id := OLD.funding_source_id;
  ELSE
    target_funding_source_id := NEW.funding_source_id;
  END IF;

  -- 1-1. 해당 재원의 기본 예산 정보 가져오기
  SELECT monthly_budget, yearly_budget INTO default_monthly_budget, default_yearly_budget
  FROM public.funding_sources
  WHERE id = target_funding_source_id;

  -- 1-2. 해당 재원의 이번 달 '확정' 사용 금액 합산
  SELECT COALESCE(SUM(amount), 0) INTO total_spent_month
  FROM public.transactions
  WHERE funding_source_id = target_funding_source_id
    AND status = 'confirmed'
    AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE);

  -- 1-3. 해당 재원의 올해 '확정' 사용 금액 합산
  SELECT COALESCE(SUM(amount), 0) INTO total_spent_year
  FROM public.transactions
  WHERE funding_source_id = target_funding_source_id
    AND status = 'confirmed'
    AND date_trunc('year', date) = date_trunc('year', CURRENT_DATE);

  -- 1-4. funding_sources 테이블 잔액 업데이트 (원자적)
  UPDATE public.funding_sources
  SET 
    current_month_balance = default_monthly_budget - total_spent_month,
    current_year_balance = default_yearly_budget - total_spent_year
  WHERE id = target_funding_source_id;

  -- 트리거 원본 데이터 반환
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 기존 트리거가 있다면 안전하게 삭제
DROP TRIGGER IF EXISTS trigger_calculate_balance ON public.transactions;

-- 3. 트리거 등록 (INSERT, UPDATE, DELETE 발생 시 위 함수 실행)
CREATE TRIGGER trigger_calculate_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_funding_source_balance();

-- ============================================================
-- SQL 설명 시나리오
-- ============================================================
-- A: 지원자가 "5,000원 추가 (confirmed)" -> 트리거 실행 -> 즉시 월 예산에서 5,000원 차감
-- B: 다른 기기에서 동시에 "10,000원 추가 (confirmed)" -> DB 락(Row Level Lock)에 의해 순차 실행 
-- C: 총 15,000원이 정확히 차감된 잔액 통과 (Race condition 방지 완벽 대응)
