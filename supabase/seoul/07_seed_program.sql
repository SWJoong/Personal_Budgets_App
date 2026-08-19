-- =====================================================================
-- 07. 서울형 제도 데이터 시드
--
-- 서비스영역 6종·금지항목 3종은 03_seoul_schema.sql 에 이미 시드되어 있다
-- (seoul_schema_draft.sql 원본에 포함). 여기서는 나머지 — 차수·시행주체·
-- 수행기관·심의위원회 — 를 채운다.
--
-- ⚠️ carry_over_allowed 는 §16 기관 확인 항목 1번(이월 가능 여부)이 정리되기 전까지
--    스키마 컬럼 기본값과 같은 TRUE(총액만 강제)로 둔다 — "잘못 막으면 당사자가
--    즉시 손해를 본다"는 원 설계 원칙 그대로다. 기관 확인 후 이 행을 UPDATE 하면
--    되고, 코드 변경은 필요 없다. (verify_01_behaviour.sql 은 이 시드와 무관한
--    자체 픽스처 cohort를 쓰므로 이 값과 결합되어 있지 않다.)
-- =====================================================================

-- 본인부담금은 3차(2026)에 신설됐다. 모집 안내문:
--   "기초생활수급자·차상위계층 본인부담금 없음(0원) / 그 외 참여자 지원액의 10%(최대 24만 원)"
-- 승인금액 240만원 × 10% = 24만원이라 상한과 정확히 맞아떨어진다.
INSERT INTO public.seoul_cohorts
  (code, name, period_months, monthly_ceiling, total_ceiling, carry_over_allowed,
   copay_rate, copay_max, appeal_due_days, starts_on, ends_on, is_active)
-- appeal_due_days 는 NULL 로 둔다 — 이의신청 기한·기산점은 심사처가 전달하는
-- 내용이고 앱은 기록만 한다(기관 확인). 값을 지어내면 당사자가 실제 기한을
-- 오해하므로, 전달받은 뒤 이 행의 값을 채우거나 이의신청마다 due_on 을 직접 적는다.
VALUES
  ('2026_3', '서울형 장애인 개인예산제 3차 시범사업', 6, 400000, 2400000, TRUE,
   0.10, 240000, NULL, '2026-01-01', '2026-12-31', TRUE)
ON CONFLICT (code) DO UPDATE
  SET copay_rate = EXCLUDED.copay_rate,
      copay_max  = EXCLUDED.copay_max;

-- 아래 세 테이블은 원본 초안(seoul_schema_draft.sql)에 자연키/UNIQUE 가 없어
-- ON CONFLICT 를 못 쓴다. WHERE NOT EXISTS 로 재실행 안전성을 대신한다.

INSERT INTO public.seoul_administering_bodies (name, body_role)
SELECT '서울특별시', 'city'
 WHERE NOT EXISTS (SELECT 1 FROM public.seoul_administering_bodies WHERE name = '서울특별시');

-- 수행기관 — 실제 배포 시 기관명으로 교체
INSERT INTO public.seoul_executing_agencies (name, designated_by_id, is_active)
SELECT '아름드리꿈터', ab.id, TRUE
  FROM public.seoul_administering_bodies ab
 WHERE ab.name = '서울특별시'
   AND NOT EXISTS (SELECT 1 FROM public.seoul_executing_agencies WHERE name = '아름드리꿈터');

-- ⚠️ 심의 주체·구성은 §16 기관 확인 항목 3번 — 구성 확정 전까지 이름만 둔다.
INSERT INTO public.seoul_review_committees (name, administering_body_id, composition_note)
SELECT '서울형 개인예산제 심의위원회', ab.id, '구성·의결정족수 기관 확인 필요'
  FROM public.seoul_administering_bodies ab
 WHERE ab.name = '서울특별시'
   AND NOT EXISTS (SELECT 1 FROM public.seoul_review_committees WHERE name = '서울형 개인예산제 심의위원회');
