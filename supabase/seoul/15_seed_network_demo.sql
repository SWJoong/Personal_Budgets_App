-- =====================================================================
-- 15 · 데모 관계망 시드 (seoul_network_entities)  —  Track B QA 준비  —  U(backend)
--
--      설계권위: Plan&Source/goala_relationship_network_crud_W.md (Track B)
--      배경: 관계망 편집 UI(B3)·그래프 오버레이(B4)를 QA 하려면 데모 당사자에게 볼 관계가 있어야 한다.
--            08 시드로 만든 데모 당사자(이메일 자연키)에게 4분면 샘플 사회 관계를 넣는다.
--            강도현(사회생활 고립 페르소나)은 일부러 **희소**하게(무급 관계 비어 고립 신호 시연).
--
-- 멱등: 참여자에 관계망이 하나라도 있으면 그 참여자는 통째로 건너뛴다(중복 방지·재실행 안전).
--       참여자(이메일)가 없으면 조용히 스킵(에러 아님).
-- 의존: 13(seoul_network_entities) · 08(데모 당사자) · norm_email(01) · 데모 실무자 프로필(created_by).
-- 실행: 대시보드 SQL Editor 수동(13·08 이후). CI db-verify 대상 아님(시드 데이터).
-- =====================================================================
DO $$
DECLARE
  v_supporter_id UUID;
  v_rows JSONB;
  v_r    JSONB;
  v_e    JSONB;
  v_pid  UUID;
BEGIN
  -- created_by = 데모 실무자(없으면 NULL 로 둔다 — created_by 는 nullable).
  SELECT id INTO v_supporter_id FROM public.profiles
   WHERE public.norm_email(email) = public.norm_email('demo.supporter@example.com')
   LIMIT 1;

  v_rows := $json$[
    {
      "email":"demo.participant@example.com",
      "network":[
        {"relation_category":"family","entity_name":"김영희","relation_type":"엄마","closeness":1,"contact_frequency":"매일"},
        {"relation_category":"family","entity_name":"김도윤","relation_type":"오빠","closeness":2,"contact_frequency":"주 2회"},
        {"relation_category":"friend","entity_name":"이수민","relation_type":"미술 동아리 친구","closeness":2,"contact_frequency":"주 1회"},
        {"relation_category":"paid_support","entity_name":"박지원","relation_type":"활동지원사","closeness":2,"contact_frequency":"주 3회"},
        {"relation_category":"community","entity_name":"햇살복지관 그림교실","relation_type":"강사","closeness":3,"contact_frequency":"주 1회"}
      ]
    },
    {
      "email":"demo.p06@example.com",
      "network":[
        {"relation_category":"family","entity_name":"강순자","relation_type":"어머니","closeness":1,"contact_frequency":"매일"},
        {"relation_category":"paid_support","entity_name":"최유진","relation_type":"활동지원사","closeness":3,"contact_frequency":"주 2회"}
      ]
    },
    {
      "email":"demo.p07@example.com",
      "network":[
        {"relation_category":"family","entity_name":"윤서진","relation_type":"딸","closeness":1,"contact_frequency":"주 3회"},
        {"relation_category":"friend","entity_name":"옆집 정씨","relation_type":"이웃","closeness":3,"contact_frequency":"주 1회"},
        {"relation_category":"paid_support","entity_name":"한미경","relation_type":"활동지원사","closeness":2,"contact_frequency":"주 4회"}
      ]
    },
    {
      "email":"demo.p02@example.com",
      "network":[
        {"relation_category":"family","entity_name":"박성호","relation_type":"아버지","closeness":2,"contact_frequency":"주 1회"},
        {"relation_category":"friend","entity_name":"카페 동료 지훈","relation_type":"직장 동료","closeness":2,"contact_frequency":"주 5회"},
        {"relation_category":"community","entity_name":"바리스타 학원","relation_type":"강사","closeness":3,"contact_frequency":"주 2회"}
      ]
    }
  ]$json$::jsonb;

  FOR v_r IN SELECT value FROM jsonb_array_elements(v_rows)
  LOOP
    SELECT id INTO v_pid FROM public.participants
     WHERE public.norm_email(email) = public.norm_email(v_r->>'email');
    CONTINUE WHEN v_pid IS NULL;  -- 데모 당사자 없으면 스킵
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.seoul_network_entities WHERE participant_id = v_pid);  -- 이미 있으면 스킵(멱등)

    FOR v_e IN SELECT value FROM jsonb_array_elements(v_r->'network')
    LOOP
      INSERT INTO public.seoul_network_entities
        (participant_id, relation_category, entity_name, relation_type, closeness, contact_frequency, created_by)
      VALUES (v_pid,
              v_e->>'relation_category',
              v_e->>'entity_name',
              v_e->>'relation_type',
              (v_e->>'closeness')::int,
              v_e->>'contact_frequency',
              v_supporter_id);
    END LOOP;
  END LOOP;
END $$;
