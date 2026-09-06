-- =====================================================================
-- 08. 데모 시드 — 서울형 개인예산제 신청 당사자 10명
--
-- 페르소나 정본: docs/demo/seoul-personas.md
--   (NVIDIA Nemotron-Personas-Korea 26필드 형식으로 입체 구성한 뒤, 각자의
--    발달장애 생애사·사업 목표·사람중심생각에 기반해 이용계획을 수립한 과정을
--    이 시드가 그대로 반영한다: 사정→서사→요청서비스→심의→통지→(이의신청)→
--    배정→이용→모니터링→정산.)
--
-- 선행 조건:
--   1) 07_seed_program.sql (차수·시행주체·수행기관·심의위원회) 먼저 실행.
--   2) 09_ontology_classification.sql (분류축) 실행 권장.
--   3) scripts/seed-demo-auth.mjs 로 데모 계정 3종(관리자/담당자/당사자)을 만들어야
--      역할 배정과 1번 당사자(김지수) 로그인 연결이 이메일로 이루어진다. 스크립트를
--      아직 안 돌렸어도 이 파일은 실행 가능하다 — 계정 생성 후 로그인하면
--      participants_autolink 트리거가 나중에 연결한다(당사자 데이터 자체는 미리 채워짐).
--
-- 신원 모델(README §신원): 1번만 로그인 계정에 연결되는 "당사자 로그인 데모"이고,
--   2~10번은 이메일만 부여된 담당자 캐어로드다(관리자·담당자 화면에서 조회, 당사자
--   로그인 없음). 이것이 실제 운영과 같은 모습이다 — 대다수 당사자는 아직 미로그인.
--
-- 이메일은 .env 의 DEMO_*_EMAIL 기본값과 일치해야 한다(아래 v_*_email + 1번 email).
--
-- 구조: 10명의 페르소나를 JSONB 배열(데이터)로 두고, 아래 단일 루프(로직)가 각
--   페르소나를 신청~이용까지 해석해 넣는다. 데이터↔로직 분리로 검토가 쉽다.
--   전 구간 재실행 가능(idempotent) — 이메일·접수번호·(application,plan,allocation)
--   키와 "존재하면 건너뜀" 가드로 중복을 막는다.
--
-- 사진·파일: SQL 은 이미지 바이트를 못 넣는다. seoul_receipts 등에는 경로만 시드되고
--   실제 파일은 Storage 수동 업로드가 필요하다(없으면 signed URL falsy 로 갤러리가
--   조용히 걸러냄 — 에러 아님). docs/demo/seoul-personas.md 부록 E 참조.
--
-- [분업] 활동사진 전용 테이블(seoul_activity_photos)은 다른 세션이 03/04 에 신설 중.
--   그 테이블이 머지되면 이 파일에 활동사진 시드 섹션을 추가한다(현재는 seoul_receipts
--   로 대체 — 현 갤러리가 receipts 버킷을 활동사진으로 읽음).
-- =====================================================================

-- ── 데모 서비스 제공기관(지도·제공기관 표시용, 재실행 안전: 이름 자연키) ──
INSERT INTO public.seoul_service_providers (name, category, address, lat, lng)
SELECT v.name, v.category, v.address, v.lat, v.lng
FROM (VALUES
  ('강서 이룸 미술스튜디오',        '교육/문화', '서울 강서구 화곡로',   37.5509, 126.8495),
  ('노원 카페 오늘(사회적협동조합)', '취·창업',   '서울 노원구 상계로',   37.6543, 127.0568),
  ('은평 어울림 수영장',            '건강/체육', '서울 은평구 응암로',   37.6176, 126.9227),
  ('마포 함께자조모임터',           '사회참여', '서울 마포구 성산로',   37.5556, 126.9110),
  ('도봉 열린음악교실',             '교육/문화', '서울 도봉구 창동로',   37.6688, 127.0471),
  ('관악 안심주거지원센터',         '주거개선', '서울 관악구 신림로',   37.4784, 126.9516)
) AS v(name, category, address, lat, lng)
WHERE NOT EXISTS (SELECT 1 FROM public.seoul_service_providers p WHERE p.name = v.name);


DO $$
DECLARE
  v_admin_email     TEXT := 'demo.admin@example.com';
  v_supporter_email TEXT := 'demo.supporter@example.com';

  v_supporter_profile_id UUID;
  v_cohort_id     UUID;
  v_committee_id  UUID;
  v_admin_body_id UUID;
  v_agency_id     UUID;

  v_personas JSONB;
  v_p    JSONB;   -- 현재 페르소나
  v_plan JSONB;   -- 현재 페르소나의 plan 하위객체
  v_x    JSONB;   -- 중첩 배열 원소(사정/서비스/이용/모니터링)

  v_participant_id UUID;
  v_application_id  UUID;
  v_plan_id         UUID;
  v_review_id       UUID;
  v_notification_id UUID;
  v_allocation_id   UUID;
  v_proxy_id        UUID;
  v_domain_id       UUID;
  v_service_id      UUID;
  v_provider_id     UUID;
  v_usage_id        UUID;
BEGIN
  -- ── 1. 역할 배정(계정이 이미 로그인해 profiles 행이 있는 경우에만 반영) ──
  UPDATE public.profiles SET role = 'admin'
   WHERE public.norm_email(email) = public.norm_email(v_admin_email) AND role <> 'admin';
  UPDATE public.profiles SET role = 'supporter'
   WHERE public.norm_email(email) = public.norm_email(v_supporter_email) AND role <> 'supporter';
  SELECT id INTO v_supporter_profile_id
    FROM public.profiles WHERE public.norm_email(email) = public.norm_email(v_supporter_email);

  -- ── 2. 참조 데이터(07·09 선행) ──
  SELECT id INTO v_cohort_id     FROM public.seoul_cohorts WHERE code = '2026_3';
  IF v_cohort_id IS NULL THEN
    RAISE EXCEPTION '07_seed_program.sql 을 먼저 실행하세요 (seoul_cohorts 2026_3 없음)';
  END IF;
  SELECT id INTO v_committee_id  FROM public.seoul_review_committees LIMIT 1;
  SELECT id INTO v_admin_body_id FROM public.seoul_administering_bodies WHERE name = '서울특별시';
  SELECT id INTO v_agency_id     FROM public.seoul_executing_agencies LIMIT 1;

  -- ── 3. 페르소나 10명(데이터). 정본 문서: docs/demo/seoul-personas.md ──
  v_personas := $json$
[
  {
    "name":"김지수","email":"demo.participant@example.com","birth_date":"2002-04-11",
    "disability_type":"자폐성장애","public_assistance":"basic_livelihood",
    "receipt_number":"DEMO-0001","application_date":"2026-01-20","app_status":"selected","selected":true,
    "assessments":[{"domain_code":"self_development","support_example":"그림 역량 강화(기기·강좌·재료)","limitation":"사람 많은 학원은 감각적으로 버겁고 집의 낡은 기기로는 원하는 표현이 어려움","need_hope":"내 그림을 더 잘 그려서 사람들에게 보여주고 싶다"}],
    "plan":{"authored_with_support":"self","status":"approved","period_start":"2026-04-01","period_end":"2026-09-30",
      "narrative":{"strengths":"그림을 오래 그릴 수 있어요. 좋아하는 캐릭터를 잘 그려요.","barriers":"사람이 많고 시끄러운 곳은 힘들어요. 그래서 학원에 가기 어려워요.","desired_change":"집에서 좋은 태블릿으로 그림을 배우고 싶어요.","desired_life":"내 그림으로 웹툰을 만들고, 사람들과 이야기하고 싶어요.","goal":"온라인 그림 강좌를 끝까지 들어 볼래요.","first_person":true},
      "services":[
        {"priority":1,"name":"그림용 태블릿 구입","domain_code":"self_development","est_cost":900000,"approved":true},
        {"priority":2,"name":"온라인 드로잉 정기 강좌(6개월)","domain_code":"self_development","est_cost":360000,"approved":true},
        {"priority":3,"name":"디지털 드로잉 재료·소모품","domain_code":"self_development","est_cost":240000,"approved":true}]},
    "review":{"decision":"approved","review_date":"2026-03-20","notified_on":"2026-03-22","is_read":true},
    "allocation":{"allocated_amount":2000000,"starts_on":"2026-04-01","ends_on":"2026-12-31"},
    "usages":[
      {"days_ago":120,"amount":900000,"description":"그림용 태블릿 구입","domain_code":"self_development","service_priority":1,"decided_by":"self_with_support","settlement_status":"accepted","receipt":true},
      {"days_ago":90,"amount":300000,"description":"온라인 드로잉 정기 강좌 수강","domain_code":"self_development","service_priority":2,"decided_by":"self","settlement_status":"accepted","provider":"강서 이룸 미술스튜디오","receipt":true},
      {"days_ago":60,"amount":150000,"description":"디지털 드로잉 재료·펜촉","domain_code":"self_development","service_priority":3,"decided_by":"self","settlement_status":"accepted"},
      {"days_ago":30,"amount":80000,"description":"액정 보호필름·드로잉 장갑 소모품","domain_code":"self_development","service_priority":3,"decided_by":"self","settlement_status":"pending"},
      {"days_ago":12,"amount":40000,"description":"온라인 창작자 소모임 참가·교통비","domain_code":"social_life","decided_by":"self","settlement_status":"pending"}],
    "settlement":{"period":"2026-04~2026-08","accepted":1350000,"rejected":0,"recovered":0,"unused":0,"note":"1차 정산 — 계획 내 지출 승인, 소모품·계획외 건 검토 중","days_ago":20},
    "monitoring":[{"days_ago":25,"method":"app","observed_change":"온라인 강좌 3주차까지 이수, 캐릭터 5종 완성","participant_voice":"그림 그리는 시간이 제일 좋아요."}]
  },
  {
    "name":"박준호","email":"demo.p02@example.com","birth_date":"1995-08-03",
    "disability_type":"지적장애","public_assistance":"near_poor",
    "receipt_number":"DEMO-0002","application_date":"2026-01-18","app_status":"selected","selected":true,
    "assessments":[{"domain_code":"employment","support_example":"바리스타 교육·자격·실습장비","limitation":"카페 보조로 일하지만 체계적 교육·자격 없이는 정식 취업이 어려움","need_hope":"자격증을 따서 제대로 된 바리스타로 취업하고 싶다"}],
    "plan":{"authored_with_support":"with_support","status":"approved","period_start":"2026-03-15","period_end":"2026-09-14",
      "narrative":{"strengths":"순서를 잘 지켜요. 커피 만드는 걸 좋아하고 손이 빨라요.","barriers":"배우고 싶은데 학원비가 비싸서 못 갔어요.","desired_change":"바리스타 학원을 다니고 자격증을 따고 싶어요.","desired_life":"카페에 정식으로 취업해서 내 힘으로 살고 싶어요.","goal":"자격증 시험을 볼래요.","first_person":true},
      "services":[
        {"priority":1,"name":"바리스타 학원 3개월 과정","domain_code":"employment","est_cost":780000,"approved":true},
        {"priority":2,"name":"바리스타 2급 자격 응시·교재","domain_code":"employment","est_cost":120000,"approved":true},
        {"priority":3,"name":"홈카페 실습 장비(그라인더·드립세트)","domain_code":"employment","est_cost":300000,"approved":true}]},
    "review":{"decision":"approved","review_date":"2026-03-01","notified_on":"2026-03-03","is_read":true},
    "allocation":{"allocated_amount":2200000,"starts_on":"2026-03-15","ends_on":"2026-12-31"},
    "usages":[
      {"days_ago":150,"amount":780000,"description":"바리스타 학원 3개월 과정","domain_code":"employment","service_priority":1,"decided_by":"self_with_support","settlement_status":"accepted","provider":"노원 카페 오늘(사회적협동조합)","receipt":true},
      {"days_ago":100,"amount":60000,"description":"바리스타 2급 자격 응시료·교재","domain_code":"employment","service_priority":2,"decided_by":"self","settlement_status":"accepted"},
      {"days_ago":70,"amount":250000,"description":"홈카페 실습 장비(그라인더·드립세트)","domain_code":"employment","service_priority":3,"decided_by":"self","settlement_status":"accepted"},
      {"days_ago":40,"amount":90000,"description":"원두·실습 재료 구입","domain_code":"employment","service_priority":3,"decided_by":"self","settlement_status":"accepted"}],
    "settlement":{"period":"2026-03~2026-08","accepted":1180000,"rejected":0,"recovered":0,"unused":1020000,"note":"정산 완료 — 계획 내 전액 인정","days_ago":10},
    "monitoring":[{"days_ago":15,"method":"visit","observed_change":"바리스타 필기 합격, 매장 실습 자신감 상승","participant_voice":"자격증 꼭 딸 거예요."}]
  },
  {
    "name":"이서연","email":"demo.p03@example.com","birth_date":"1999-11-27",
    "disability_type":"자폐성장애","public_assistance":"none",
    "receipt_number":"DEMO-0003","application_date":"2026-01-25","app_status":"selected","selected":true,
    "assessments":[{"domain_code":"health_safety","support_example":"규칙적 수영·운동으로 정서·신체 안정","limitation":"감각 과민과 불안으로 일상 활동 지속이 어렵고 정서 기복이 큼","need_hope":"수영을 꾸준히 해서 몸도 마음도 편안해지고 싶다"}],
    "plan":{"authored_with_support":"with_support","status":"approved","period_start":"2026-05-01","period_end":"2026-10-31",
      "narrative":{"strengths":"물에서 수영을 잘해요. 약속 시간을 잘 지켜요.","barriers":"불안하고 예민해서 오래 활동하기 힘들어요.","desired_change":"수영을 규칙적으로 배우고 싶어요.","desired_life":"마음이 편안한 하루를 보내고 싶어요.","goal":"수영 강습을 3개월 다녀 볼래요.","first_person":true},
      "services":[
        {"priority":1,"name":"장애인 수영 강습(3개월)","domain_code":"health_safety","est_cost":540000,"approved":true},
        {"priority":2,"name":"수영용품(수경·수영복·방수백)","domain_code":"health_safety","est_cost":120000,"approved":true},
        {"priority":3,"name":"장애 이해 트레이너 개인운동(월 2회)","domain_code":"health_safety","est_cost":360000,"approved":true}]},
    "review":{"decision":"approved","review_date":"2026-04-15","notified_on":"2026-04-17","is_read":true},
    "allocation":{"allocated_amount":1500000,"starts_on":"2026-05-01","ends_on":"2026-12-31"},
    "usages":[
      {"days_ago":100,"amount":540000,"description":"장애인 수영 강습(3개월)","domain_code":"health_safety","service_priority":1,"decided_by":"self_with_support","settlement_status":"accepted","provider":"은평 어울림 수영장","receipt":true},
      {"days_ago":95,"amount":90000,"description":"수영용품(수경·수영복·방수백)","domain_code":"health_safety","service_priority":2,"decided_by":"self","settlement_status":"pending"}],
    "monitoring":[{"days_ago":20,"method":"phone","observed_change":"주 2회 수영 결석 없이 참여, 수면 개선 보고","participant_voice":"물에 들어가면 편해요."}]
  },
  {
    "name":"최민수","email":"demo.p04@example.com","birth_date":"1981-02-14",
    "disability_type":"지적장애","secondary":"지체장애","public_assistance":"basic_livelihood",
    "proxy":{"name":"김순자","relation":"모","contact":"010-0000-0004"},"signed_by_proxy":true,
    "receipt_number":"DEMO-0004","application_date":"2026-01-22","app_status":"selected","selected":true,
    "assessments":[{"domain_code":"housing","support_example":"욕실 안전손잡이·미끄럼방지·문턱 개선","limitation":"노후 빌라의 미끄러운 욕실·문턱·어두운 현관이 낙상 위험. 주 부양자(노모) 고령","need_hope":"넘어질 걱정 없이 혼자 씻고 다닐 수 있는 집"}],
    "plan":{"authored_with_support":"with_support","status":"conditional","period_start":"2026-07-01","period_end":"2026-12-31",
      "narrative":{"strengths":"이웃들과 인사를 잘해요. 집안일을 도와요.","barriers":"욕실에서 미끄러져 다칠까 봐 무서워요. 집에 문턱이 많아요.","desired_change":"욕실에 손잡이를 달고 미끄럽지 않게 하고 싶어요.","desired_life":"엄마 없이도 안전하게 지내고 싶어요.","goal":"안전한 집에서 혼자 씻어 볼래요.","first_person":false},
      "services":[
        {"priority":1,"name":"욕실 안전손잡이·미끄럼방지 시공","domain_code":"housing","est_cost":400000,"approved":true},
        {"priority":2,"name":"현관 문턱 제거·센서등·경사로","domain_code":"housing","est_cost":250000,"approved":true},
        {"priority":3,"name":"주방 전면 개조(싱크대 교체)","domain_code":"housing","est_cost":1200000,"approved":false}]},
    "review":{"decision":"conditional","reason":"안전손잡이·문턱 개선은 승인. 주방 전면 개조는 주택개조 별도 제도로 지원 가능(이미 다른 제도)하여 제외.","review_date":"2026-06-01","notified_on":"2026-06-03","is_read":true},
    "appeal":{"filed_on":"2026-06-10","ground":"주방은 별도 제도 대상이 아님을 소명. 안전한 조리를 위한 최소 개선 필요.","filed_by_self":true,"outcome":"partially_upheld","outcome_reason":"주방 전면 개조는 여전히 제외하되, 안전 관련 최소 개선(가스 자동차단·조리대 높이)은 인정.","decided_on":"2026-06-25"},
    "allocation":{"allocated_amount":800000,"starts_on":"2026-07-01","ends_on":"2026-12-31"},
    "usages":[
      {"days_ago":40,"amount":380000,"description":"욕실 안전손잡이·미끄럼방지 시공","domain_code":"housing","service_priority":1,"decided_by":"self_with_support","settlement_status":"accepted","provider":"관악 안심주거지원센터","receipt":true},
      {"days_ago":25,"amount":220000,"description":"현관 문턱 제거·센서등 설치","domain_code":"housing","service_priority":2,"decided_by":"self_with_support","settlement_status":"accepted"}],
    "monitoring":[{"days_ago":10,"method":"visit","observed_change":"욕실 시공 후 낙상 없음, 혼자 씻기 시도 시작","participant_voice":"이제 안 미끄러워요."}]
  },
  {
    "name":"정하늘","email":"demo.p05@example.com","birth_date":"2007-06-30",
    "disability_type":"지적장애","public_assistance":"none",
    "receipt_number":"DEMO-0005","application_date":"2026-02-10","app_status":"selected","selected":true,
    "assessments":[{"domain_code":"self_development","support_example":"직업 체험 강좌(바리스타·제과) 탐색","limitation":"특수학교 전공과 졸업 후 갈 곳·배울 곳이 정해지지 않아 낮 시간 공백과 진로 불확실","need_hope":"여러 가지를 배워 보고 내게 맞는 일을 찾고 싶다"}],
    "plan":{"authored_with_support":"with_support","status":"submitted","period_start":"2026-09-01","period_end":"2026-12-31",
      "narrative":{"strengths":"만드는 걸 좋아해요. 새로운 것도 잘 해 봐요.","barriers":"학교를 졸업하니 갈 곳이 없어졌어요.","desired_change":"카페랑 제과를 배워 보고 싶어요.","desired_life":"내가 좋아하는 일을 찾아서 하고 싶어요.","goal":"여러 강좌를 들어 보고 하나를 정할래요.","first_person":true},
      "services":[
        {"priority":1,"name":"바리스타 입문 평생교육 강좌","domain_code":"self_development","est_cost":400000},
        {"priority":2,"name":"제과제빵 체험 클래스(단기)","domain_code":"self_development","est_cost":300000},
        {"priority":3,"name":"진로 탐색 워크북·재료","domain_code":"self_development","est_cost":120000}]}
  },
  {
    "name":"강도현","email":"demo.p06@example.com","birth_date":"1988-09-12",
    "disability_type":"자폐성장애","public_assistance":"near_poor",
    "receipt_number":"DEMO-0006","application_date":"2026-01-19","app_status":"selected","selected":true,
    "assessments":[{"domain_code":"social_life","support_example":"자조모임·사회성 프로그램·관심사 기반 소모임","limitation":"사회적 의사소통 어려움으로 고립. 관계 맺을 접점 부재","need_hope":"관심사를 나눌 사람들과 정기적으로 만나고 싶다"}],
    "plan":{"authored_with_support":"self","status":"approved","period_start":"2026-04-15","period_end":"2026-10-14",
      "narrative":{"strengths":"지하철 노선을 다 외워요. 한 가지를 오래 잘해요.","barriers":"사람들과 이야기하는 게 어려워서 혼자 있게 돼요.","desired_change":"내 관심사를 나눌 모임에 나가고 싶어요.","desired_life":"외롭지 않게, 아는 사람이 있는 하루를 보내고 싶어요.","goal":"자조모임에 매주 나가 볼래요.","first_person":true},
      "services":[
        {"priority":1,"name":"자폐 성인 자조모임 정기 참가(6개월)","domain_code":"social_life","est_cost":360000,"approved":true},
        {"priority":2,"name":"사회성 그룹 프로그램(관계 기술)","domain_code":"social_life","est_cost":420000,"approved":true},
        {"priority":3,"name":"관심사 기반 소모임(교통 동호회) 활동비","domain_code":"social_life","est_cost":180000,"approved":true}]},
    "review":{"decision":"approved","review_date":"2026-04-05","notified_on":"2026-04-07","is_read":true},
    "allocation":{"allocated_amount":1200000,"starts_on":"2026-04-15","ends_on":"2026-12-31"},
    "usages":[
      {"days_ago":120,"amount":360000,"description":"자폐 성인 자조모임 정기 참가(6개월)","domain_code":"social_life","service_priority":1,"decided_by":"self","settlement_status":"accepted","provider":"마포 함께자조모임터","receipt":true},
      {"days_ago":80,"amount":300000,"description":"사회성 그룹 프로그램(관계 기술)","domain_code":"social_life","service_priority":2,"decided_by":"self_with_support","settlement_status":"accepted"},
      {"days_ago":45,"amount":120000,"description":"교통 동호회 활동비(관심사 기반 관계)","domain_code":"social_life","service_priority":3,"decided_by":"self","settlement_status":"pending"}],
    "monitoring":[{"days_ago":18,"method":"app","observed_change":"자조모임 5회 참석, 회원에게 먼저 인사","participant_voice":"모임 가는 날이 기다려져요."}]
  },
  {
    "name":"윤미래","email":"demo.p07@example.com","birth_date":"1974-03-08",
    "disability_type":"지적장애","public_assistance":"basic_livelihood",
    "proxy":{"name":"윤대호","relation":"형제","contact":"010-0000-0007"},"signed_by_proxy":false,
    "receipt_number":"DEMO-0007","application_date":"2026-08-20","app_status":"screening","selected":false,
    "assessments":[{"domain_code":"daily_living","support_example":"안전한 조리·가사 자립 훈련","limitation":"평생 가족 의존으로 조리·가사 등 일상 자립 기술 부족. 주 부양자 변화로 자립 준비 시급","need_hope":"내 밥은 내가 짓고 집안일을 스스로 하고 싶다"}]
  },
  {
    "name":"임재현","email":"demo.p08@example.com","birth_date":"1997-12-05",
    "disability_type":"지적장애","public_assistance":"none",
    "receipt_number":"DEMO-0008","application_date":"2026-01-28","app_status":"selected","selected":true,
    "assessments":[{"domain_code":"employment","support_example":"제과제빵 학원·실기 재료","limitation":"독학의 한계, 체계적 제과 훈련·자격 필요","need_hope":"제과제빵을 제대로 배워 취업하고 싶다"}],
    "plan":{"authored_with_support":"with_support","status":"under_appeal","period_start":"2026-05-01","period_end":"2026-10-31",
      "narrative":{"strengths":"빵을 잘 구워요. 순서를 정확히 지켜요.","barriers":"혼자 배우니까 한계가 있고, 자격증이 없어요.","desired_change":"제과제빵 학원에서 제대로 배우고 싶어요.","desired_life":"빵집에 취업해서 내가 만든 빵을 팔고 싶어요.","goal":"제과 학원 과정을 끝까지 들을래요.","first_person":true},
      "services":[
        {"priority":1,"name":"제과제빵 학원 과정(3개월)","domain_code":"employment","est_cost":900000,"approved":false},
        {"priority":2,"name":"제과 기능사 실기 재료·도구","domain_code":"employment","est_cost":300000,"approved":false}]},
    "review":{"decision":"rejected","reason":"요청 서비스가 기존 직업재활 훈련 제도로 지원 가능(이미 다른 제도)하며, 개인예산 필요성 소명이 부족함.","review_date":"2026-05-10","notified_on":"2026-05-12","is_read":true},
    "appeal":{"filed_on":"2026-05-20","ground":"기존 훈련은 정원·속도가 맞지 않아 중도 이탈 경험. 개인 속도의 소량 맞춤 실습·재료는 개인예산으로만 가능함을 소명.","filed_by_self":true,"outcome":"pending"}
  },
  {
    "name":"한소영","email":"demo.p09@example.com","birth_date":"1992-07-19",
    "disability_type":"자폐성장애","public_assistance":"near_poor",
    "receipt_number":"DEMO-0009","application_date":"2026-01-21","app_status":"selected","selected":true,
    "assessments":[{"domain_code":"self_development","support_example":"피아노 레슨·기기·음악치료","limitation":"청각 과민으로 일상 활동 제약, 정서 기복. 음악이 안정과 표현의 핵심 통로","need_hope":"피아노를 제대로 배워 마음을 표현하고 싶다"}],
    "plan":{"authored_with_support":"self","status":"approved","period_start":"2026-05-01","period_end":"2026-10-31",
      "narrative":{"strengths":"귀가 밝아서 들은 곡을 그대로 쳐요. 피아노를 오래 쳐요.","barriers":"큰 소리가 힘들어서 사람 많은 곳이 어려워요.","desired_change":"조용한 곳에서 피아노를 배우고 싶어요.","desired_life":"음악으로 마음을 표현하며 지내고 싶어요.","goal":"개인 피아노 레슨을 받아 볼래요.","first_person":true},
      "services":[
        {"priority":1,"name":"디지털 피아노 구입","domain_code":"self_development","est_cost":850000,"approved":true},
        {"priority":2,"name":"장애 이해 강사 개인 피아노 레슨(3개월)","domain_code":"self_development","est_cost":540000,"approved":true},
        {"priority":3,"name":"음악치료 세션(월 2회)","domain_code":"health_safety","est_cost":360000,"approved":true}]},
    "review":{"decision":"approved","review_date":"2026-04-20","notified_on":"2026-04-22","is_read":true},
    "allocation":{"allocated_amount":1800000,"starts_on":"2026-05-01","ends_on":"2026-12-31"},
    "usages":[
      {"days_ago":110,"amount":850000,"description":"디지털 피아노 구입","domain_code":"self_development","service_priority":1,"decided_by":"self_with_support","settlement_status":"accepted","receipt":true},
      {"days_ago":70,"amount":450000,"description":"장애 이해 강사 개인 피아노 레슨(3개월)","domain_code":"self_development","service_priority":2,"decided_by":"self","settlement_status":"accepted","provider":"도봉 열린음악교실"},
      {"days_ago":15,"amount":60000,"description":"소규모 발표회 참가비·악보 구입","domain_code":"self_development","decided_by":"self","settlement_status":"pending"}],
    "monitoring":[{"days_ago":12,"method":"visit","observed_change":"레슨 2곡 완성, 발표회 참가 희망. 계획외 지출(발표회) 담당자와 상의","participant_voice":"피아노 칠 때 행복해요."}]
  },
  {
    "name":"오지훈","email":"demo.p10@example.com","birth_date":"1985-05-16",
    "disability_type":"지적장애","public_assistance":"none",
    "receipt_number":"DEMO-0010","application_date":"2026-02-05","app_status":"selected","selected":true,
    "assessments":[{"domain_code":"daily_living","support_example":"대중교통 이동 훈련·동행 지원·길찾기 보조","limitation":"대중교통 단독 이용 어려움으로 활동 반경·사회 참여 제약","need_hope":"혼자 버스·지하철을 타고 원하는 곳에 다니고 싶다"}],
    "plan":{"authored_with_support":"with_support","status":"under_review","period_start":"2026-09-01","period_end":"2026-12-31",
      "narrative":{"strengths":"한번 다닌 길은 잘 기억해요. 노선도 보는 걸 좋아해요.","barriers":"혼자 버스를 못 타서 어디 가려면 늘 같이 가야 해요.","desired_change":"혼자 대중교통 타는 법을 배우고 싶어요.","desired_life":"혼자서도 가고 싶은 곳에 다니고 싶어요.","goal":"이동 훈련을 받고 혼자 한 곳에 가 볼래요.","first_person":true},
      "services":[
        {"priority":1,"name":"지역사회 이동 훈련(대중교통 이용) 프로그램","domain_code":"daily_living","est_cost":500000},
        {"priority":2,"name":"이동 동행·실습 지원(단계적 축소)","domain_code":"daily_living","est_cost":300000},
        {"priority":3,"name":"길찾기 보조 스마트기기·앱","domain_code":"daily_living","est_cost":150000}]}
  }
]
$json$::jsonb;

  -- ── 4. 페르소나별 파이프라인 반영(로직) ──
  FOR v_p IN SELECT value FROM jsonb_array_elements(v_personas)
  LOOP
    -- 반복마다 파생 id 초기화(직전 페르소나 값 누수 방지)
    v_plan_id := NULL; v_review_id := NULL; v_notification_id := NULL;
    v_allocation_id := NULL; v_proxy_id := NULL; v_plan := NULL;

    -- (a) 당사자 upsert (이메일 자연키)
    SELECT id INTO v_participant_id
      FROM public.participants WHERE public.norm_email(email) = public.norm_email(v_p->>'email');
    IF v_participant_id IS NULL THEN
      INSERT INTO public.participants (name, email, birth_date, disability_type, support_grade, assigned_supporter_id)
      VALUES (v_p->>'name', v_p->>'email', (v_p->>'birth_date')::date, v_p->>'disability_type',
              '심한 장애(중증)', v_supporter_profile_id)
      RETURNING id INTO v_participant_id;
    ELSE
      UPDATE public.participants
         SET assigned_supporter_id = COALESCE(assigned_supporter_id, v_supporter_profile_id)
       WHERE id = v_participant_id;
    END IF;

    -- (b) 자격 정보 — 중증 고정, 부수장애 선택
    INSERT INTO public.seoul_disability_profiles
      (participant_id, primary_disability_type, disability_severity, secondary_disability_type)
    VALUES (v_participant_id, v_p->>'disability_type', 'severe', v_p->>'secondary')
    ON CONFLICT (participant_id) DO NOTHING;

    -- (c) 수급 상태 — 본인부담금 트리거의 입력값(배정 전에 있어야 함)
    INSERT INTO public.seoul_benefit_status
      (participant_id, public_assistance, participates_in_mohw_pilot)
    VALUES (v_participant_id, v_p->>'public_assistance', FALSE)
    ON CONFLICT (participant_id) DO NOTHING;

    -- (d) 대리인(선택)
    IF v_p ? 'proxy' THEN
      SELECT id INTO v_proxy_id FROM public.seoul_proxies
        WHERE participant_id = v_participant_id AND proxy_name = v_p->'proxy'->>'name';
      IF v_proxy_id IS NULL THEN
        INSERT INTO public.seoul_proxies (participant_id, proxy_name, relation_to_participant, contact)
        VALUES (v_participant_id, v_p->'proxy'->>'name', v_p->'proxy'->>'relation', v_p->'proxy'->>'contact')
        RETURNING id INTO v_proxy_id;
      END IF;
    END IF;

    -- (e) 욕구사정(사람중심 사정 — 계획의 시작점). 참여자에 하나라도 있으면 건너뜀
    IF NOT EXISTS (SELECT 1 FROM public.seoul_needs_assessment WHERE participant_id = v_participant_id) THEN
      FOR v_x IN SELECT value FROM jsonb_array_elements(COALESCE(v_p->'assessments','[]'::jsonb))
      LOOP
        SELECT id INTO v_domain_id FROM public.seoul_service_domains
          WHERE program = 'seoul' AND code = v_x->>'domain_code';
        INSERT INTO public.seoul_needs_assessment
          (participant_id, program, domain_id, support_example, limitation, need_hope, assessed_by)
        VALUES (v_participant_id, 'seoul', v_domain_id,
                v_x->>'support_example', v_x->>'limitation', v_x->>'need_hope', v_supporter_profile_id);
      END LOOP;
    END IF;

    -- (f) 신청 (참여자+차수 자연키)
    SELECT id INTO v_application_id FROM public.seoul_applications
      WHERE participant_id = v_participant_id AND cohort_id = v_cohort_id;
    IF v_application_id IS NULL THEN
      INSERT INTO public.seoul_applications
        (participant_id, cohort_id, receipt_number, application_date, received_by_id, proxy_id, status)
      VALUES (v_participant_id, v_cohort_id, v_p->>'receipt_number',
              (v_p->>'application_date')::date, v_agency_id, v_proxy_id, v_p->>'app_status')
      RETURNING id INTO v_application_id;
    END IF;

    -- (g) 동의 2종 (선정의 전제)
    INSERT INTO public.seoul_consent_records
      (application_id, participant_id, consent_type, is_agreed, signed_by_proxy)
    VALUES
      (v_application_id, v_participant_id, 'general',   TRUE, COALESCE((v_p->>'signed_by_proxy')::boolean, FALSE)),
      (v_application_id, v_participant_id, 'unique_id', TRUE, COALESCE((v_p->>'signed_by_proxy')::boolean, FALSE))
    ON CONFLICT (application_id, consent_type) DO NOTHING;

    -- (h) 선정 (동의 2종 있어야 트리거 통과)
    IF COALESCE((v_p->>'selected')::boolean, FALSE)
       AND NOT EXISTS (SELECT 1 FROM public.seoul_selection_decisions WHERE application_id = v_application_id) THEN
      INSERT INTO public.seoul_selection_decisions
        (application_id, is_selected, selection_reason, decided_by_id)
      VALUES (v_application_id, TRUE, '데모 시드 — 자격 확인 후 선정', v_admin_body_id);
    END IF;

    -- (i) 이용계획 + 자기서사 + 요청서비스
    IF v_p ? 'plan' THEN
      v_plan := v_p->'plan';
      SELECT id INTO v_plan_id FROM public.seoul_utilization_plans WHERE application_id = v_application_id;
      IF v_plan_id IS NULL THEN
        INSERT INTO public.seoul_utilization_plans
          (participant_id, application_id, cohort_id, assisted_by_id, authored_with_support,
           status, plan_period_start, plan_period_end)
        VALUES (v_participant_id, v_application_id, v_cohort_id, v_supporter_profile_id,
                v_plan->>'authored_with_support', v_plan->>'status',
                (v_plan->>'period_start')::date, (v_plan->>'period_end')::date)
        RETURNING id INTO v_plan_id;
      END IF;

      INSERT INTO public.seoul_self_narratives
        (plan_id, strengths_talents, social_barriers, desired_change, desired_life, goal_to_try, written_in_first_person)
      VALUES (v_plan_id,
              v_plan->'narrative'->>'strengths', v_plan->'narrative'->>'barriers',
              v_plan->'narrative'->>'desired_change', v_plan->'narrative'->>'desired_life',
              v_plan->'narrative'->>'goal', COALESCE((v_plan->'narrative'->>'first_person')::boolean, TRUE))
      ON CONFLICT (plan_id) DO NOTHING;

      FOR v_x IN SELECT value FROM jsonb_array_elements(COALESCE(v_plan->'services','[]'::jsonb))
      LOOP
        SELECT id INTO v_domain_id FROM public.seoul_service_domains
          WHERE program = 'seoul' AND code = v_x->>'domain_code';
        INSERT INTO public.seoul_requested_services
          (plan_id, priority, service_name, domain_id, estimated_cost, approved_for_service)
        VALUES (v_plan_id, (v_x->>'priority')::int, v_x->>'name', v_domain_id,
                (v_x->>'est_cost')::numeric, (v_x->>'approved')::boolean)
        ON CONFLICT (plan_id, priority) DO NOTHING;
      END LOOP;
    END IF;

    -- (j) 심의 + 통지
    IF v_p ? 'review' AND v_plan_id IS NOT NULL THEN
      SELECT id INTO v_review_id FROM public.seoul_plan_reviews WHERE plan_id = v_plan_id;
      IF v_review_id IS NULL THEN
        INSERT INTO public.seoul_plan_reviews (plan_id, committee_id, decision, reason, review_date)
        VALUES (v_plan_id, v_committee_id, v_p->'review'->>'decision',
                v_p->'review'->>'reason', (v_p->'review'->>'review_date')::date)
        RETURNING id INTO v_review_id;
      END IF;

      SELECT id INTO v_notification_id FROM public.seoul_notifications WHERE review_id = v_review_id;
      IF v_notification_id IS NULL THEN
        INSERT INTO public.seoul_notifications
          (review_id, participant_id, notified_on, method, is_read_by_participant)
        VALUES (v_review_id, v_participant_id, (v_p->'review'->>'notified_on')::date, 'app',
                COALESCE((v_p->'review'->>'is_read')::boolean, FALSE))
        RETURNING id INTO v_notification_id;
      END IF;
    END IF;

    -- (k) 이의신청 (통지가 있어야 함)
    IF v_p ? 'appeal' AND v_notification_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.seoul_appeals WHERE notification_id = v_notification_id) THEN
      INSERT INTO public.seoul_appeals
        (notification_id, participant_id, committee_id, filed_on, ground, filed_by_self,
         outcome, outcome_reason, decided_on)
      VALUES (v_notification_id, v_participant_id, v_committee_id,
              (v_p->'appeal'->>'filed_on')::date, v_p->'appeal'->>'ground',
              COALESCE((v_p->'appeal'->>'filed_by_self')::boolean, TRUE),
              v_p->'appeal'->>'outcome', v_p->'appeal'->>'outcome_reason',
              (v_p->'appeal'->>'decided_on')::date);
    END IF;

    -- (l) 예산 배정 (차수 기본값 복사 + 승인금액; 본인부담금은 트리거가 산정)
    IF v_p ? 'allocation' AND v_plan_id IS NOT NULL THEN
      SELECT id INTO v_allocation_id FROM public.seoul_budget_allocations WHERE plan_id = v_plan_id;
      IF v_allocation_id IS NULL THEN
        INSERT INTO public.seoul_budget_allocations
          (participant_id, plan_id, review_id, cohort_id, funded_by_id,
           monthly_ceiling, total_ceiling, period_months, carry_over_allowed,
           allocated_amount, starts_on, ends_on)
        SELECT v_participant_id, v_plan_id, v_review_id, v_cohort_id, v_admin_body_id,
               c.monthly_ceiling, c.total_ceiling, c.period_months, c.carry_over_allowed,
               (v_p->'allocation'->>'allocated_amount')::numeric,
               (v_p->'allocation'->>'starts_on')::date, (v_p->'allocation'->>'ends_on')::date
          FROM public.seoul_cohorts c WHERE c.id = v_cohort_id
        RETURNING id INTO v_allocation_id;
      END IF;

      -- (m) 이용 내역 (배정에 아직 없을 때만). 계획외(service_priority 없음)는
      --     seoul_flag_criteria 트리거가 자동으로 "검토 대기"에 남긴다.
      IF NOT EXISTS (SELECT 1 FROM public.seoul_service_usages WHERE allocation_id = v_allocation_id) THEN
        FOR v_x IN SELECT value FROM jsonb_array_elements(COALESCE(v_p->'usages','[]'::jsonb))
        LOOP
          SELECT id INTO v_domain_id FROM public.seoul_service_domains
            WHERE program = 'seoul' AND code = v_x->>'domain_code';

          v_service_id := NULL;
          IF v_x ? 'service_priority' THEN
            SELECT id INTO v_service_id FROM public.seoul_requested_services
              WHERE plan_id = v_plan_id AND priority = (v_x->>'service_priority')::int;
          END IF;

          v_provider_id := NULL;
          IF v_x ? 'provider' THEN
            SELECT id INTO v_provider_id FROM public.seoul_service_providers WHERE name = v_x->>'provider';
          END IF;

          INSERT INTO public.seoul_service_usages
            (participant_id, allocation_id, requested_service_id, domain_id, provider_id,
             usage_date, amount, description, created_by, decided_by, settlement_status)
          VALUES (v_participant_id, v_allocation_id, v_service_id, v_domain_id, v_provider_id,
                  CURRENT_DATE - (v_x->>'days_ago')::int, (v_x->>'amount')::numeric,
                  v_x->>'description', v_supporter_profile_id,
                  v_x->>'decided_by', v_x->>'settlement_status')
          RETURNING id INTO v_usage_id;

          -- 영수증(경로만 — 실제 파일은 수동 업로드). 갤러리·검토 화면이 이 경로를 signed URL 로 변환
          IF COALESCE((v_x->>'receipt')::boolean, FALSE) THEN
            INSERT INTO public.seoul_receipts (usage_id, provider_id, storage_path, issued_on, amount)
            VALUES (v_usage_id, v_provider_id,
                    v_participant_id::text || '/' || v_usage_id::text || '.jpg',
                    CURRENT_DATE - (v_x->>'days_ago')::int, (v_x->>'amount')::numeric);
          END IF;
        END LOOP;
      END IF;

      -- (n) 정산(선택)
      IF v_p ? 'settlement' THEN
        INSERT INTO public.seoul_settlements
          (allocation_id, verified_by_id, settled_period, accepted_amount, rejected_amount,
           recovered_amount, unused_amount, note, settled_on)
        VALUES (v_allocation_id, v_agency_id, v_p->'settlement'->>'period',
                (v_p->'settlement'->>'accepted')::numeric, (v_p->'settlement'->>'rejected')::numeric,
                (v_p->'settlement'->>'recovered')::numeric, (v_p->'settlement'->>'unused')::numeric,
                v_p->'settlement'->>'note', CURRENT_DATE - COALESCE((v_p->'settlement'->>'days_ago')::int, 0))
        ON CONFLICT (allocation_id, settled_period) DO NOTHING;
      END IF;
    END IF;

    -- (o) 모니터링(참여자에 하나라도 있으면 건너뜀)
    IF v_p ? 'monitoring'
       AND NOT EXISTS (SELECT 1 FROM public.seoul_monitoring_records WHERE participant_id = v_participant_id) THEN
      FOR v_x IN SELECT value FROM jsonb_array_elements(COALESCE(v_p->'monitoring','[]'::jsonb))
      LOOP
        INSERT INTO public.seoul_monitoring_records
          (participant_id, allocation_id, caseworker_id, monitoring_date, method,
           observed_change, participant_voice)
        VALUES (v_participant_id, v_allocation_id, v_supporter_profile_id,
                CURRENT_DATE - (v_x->>'days_ago')::int, v_x->>'method',
                v_x->>'observed_change', v_x->>'participant_voice');
      END LOOP;
    END IF;

  END LOOP;

  RAISE NOTICE '데모 시드 완료 — 당사자 10명(신청~이용~정산 파이프라인 반영)';
END $$;
