-- =====================================================================
-- §11. 자산지도 "쓸 수 있는 곳" — 전역 제공기관→영역 발견 함수
--
--   설계: Plan&Source/goala_provider_domains_W.md · 계약: verify_provider_domains.sql
--   소비: src/utils/assetMap.ts(buildDiscoveryAssets) → (participant)/map "쓸 수 있는 곳" 탭
--
--   문제(§1): buildProviderAssets(#46)는 '내가 쓴 곳'을 본인 지출 이력에서 파생한다(RLS 스코프).
--   그래서 이제 막 시작한 당사자에게는 마커가 한두 개뿐이라 지도가 비어 보인다. 자산지도의 진짜
--   값어치는 '쓸 수 있는 곳'(discovery) — *다른 사람들이 이 예산으로 실제로 이용한 장소* 다.
--   → 전체 참여자의 지출을 제공기관×영역으로 집계해 "이 장소는 [사회생활]에 쓸 수 있어요"를 보여준다.
-- =====================================================================

-- ★ 왜 뷰가 아니라 SECURITY DEFINER 함수인가 (설계 §2 — 핵심 보안 결정)
--
--   05_seoul_graph.sql §5 와 모든 seoul 뷰는 반드시 WITH (security_invoker = true) 를 가진다.
--   이 기능은 '의도적으로' RLS 를 넘어 전 참여자 지출을 집계해야 발견이 성립한다(§1). 그러나:
--     · security_invoker=true 뷰 → RLS 적용 → 당사자는 본인 것만 → 다시 sparse. 기능 불성립.
--     · security_invoker=false(평범한) 뷰 → RLS 우회는 되지만 §5 가 경고한 '조용한 우회'
--       안티패턴(grep 에 안 드러나고 리뷰에서 놓치기 쉽다) → W 리뷰 거부 대상.
--   → 올바른 답은 명시적 SECURITY DEFINER 함수다. 코드베이스가 이미 감사기록 트리거
--     (seoul_flag_criteria, 03 §)에서 쓰는 '의도적·검증가능한 RLS 우회'의 정본 관용구다.
--
--   안전성은 함수의 RETURNS 컬럼만 보면 증명된다: 신원(participant_id)·금액(amount)·
--   날짜(usage_date)·작성자(created_by) 그 어느 것도 반환하지 않는다. 오직 집계 수치(usage_count)뿐.
--   즉 "≥1명이 장소 X 를 영역 D 로 이용했다"만 공개하고 '누가·얼마·언제'는 절대 새지 않는다.
--   (잔여 소셀 위험·완화 옵션 HAVING count(*)>=floor 은 설계 §5 참조 — 기본 끔.)

CREATE OR REPLACE FUNCTION public.seoul_provider_domains()
RETURNS TABLE (
  provider_id    UUID,
  provider_name  TEXT,
  category       TEXT,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  domain_id      UUID,
  domain_code    TEXT,
  domain_label   TEXT,
  program        TEXT,
  usage_count    BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER                       -- ★ 의도적 전역 집계: 발견을 위해 RLS 를 넘되, 신원은 반환하지 않는다
SET search_path = public, pg_temp     -- ★ definer 함수는 search_path 고정 필수(권한상승 방지)
AS $$
  SELECT
    p.id, p.name, p.category, p.lat, p.lng,
    d.id, d.code, d.label, d.program,
    count(*) AS usage_count
  FROM public.seoul_service_usages u
  JOIN public.seoul_service_providers p ON p.id = u.provider_id   -- INNER: 장소 없는 지출 제외
  JOIN public.seoul_service_domains   d ON d.id = u.domain_id     -- INNER: 영역 없는 지출 제외
  GROUP BY p.id, p.name, p.category, p.lat, p.lng, d.id, d.code, d.label, d.program;
$$;

COMMENT ON FUNCTION public.seoul_provider_domains() IS
  '전역 제공기관×영역 발견 집계(자산지도 "쓸 수 있는 곳"). SECURITY DEFINER 로 RLS 를 의도적으로 넘어 전 참여자 지출을 합산하되, 신원·금액·날짜는 반환하지 않는다(집계 수치만). security_invoker 인 v_seoul_graph_edges(교차참여자 차단)와 의도적으로 대비된다.';

-- 실행 권한: 로그인 사용자(authenticated)에게만. PUBLIC(익명 포함) 회수.
REVOKE ALL ON FUNCTION public.seoul_provider_domains() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seoul_provider_domains() TO authenticated;
