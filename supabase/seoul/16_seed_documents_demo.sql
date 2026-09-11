-- =====================================================================
-- 16 · 데모 서류 시드 (seoul_application_documents)  —  담당자 QA 준비(F1b)  —  U(backend)
--
--      배경: 서류함(A3/F1) QA 를 하려면 데모 당사자에게 볼 서류가 있어야 한다. 08 시드로 만든 데모
--            당사자에게 신청서/동의서/기타 샘플 서류 **메타데이터**를 넣는다.
--
-- ★중요(솔직한 한계): 이 시드는 seoul_application_documents **행(메타데이터)만** 만든다. storage_path 가
--   가리키는 실제 파일은 documents 버킷에 없으므로(파일 업로드는 SQL 로 불가) **'열기'(signed URL)는
--   동작하지 않는다**. 목록·그룹·유형칩·삭제·업로드 UI QA 용이며, 열기가 되는 서류는 서류함의
--   '서류 올리기'(F1)로 실제 업로드한 것에서 확인한다.
--
-- 멱등: 참여자에 서류가 하나라도 있으면 그 참여자는 통째 건너뜀. 참여자·신청서 없으면 조용히 스킵.
-- 의존: 03(seoul_application_documents·seoul_applications) · 08(데모 당사자·신청서) · norm_email(01).
-- 실행: 대시보드 SQL Editor 수동(08 이후). CI db-verify 대상 아님(시드 데이터).
-- =====================================================================
DO $$
DECLARE
  v_supporter_id UUID;
  v_rows JSONB;
  v_r    JSONB;
  v_d    JSONB;
  v_pid  UUID;
  v_appid UUID;
BEGIN
  SELECT id INTO v_supporter_id FROM public.profiles
   WHERE public.norm_email(email) = public.norm_email('demo.supporter@example.com')
   LIMIT 1;

  v_rows := $json$[
    {
      "email":"demo.participant@example.com",
      "docs":[
        {"doc_type":"application_form","file_name":"2026 개인예산 신청서.pdf","note":"1차 신청 서류(원본 보관)"},
        {"doc_type":"consent_form","file_name":"개인정보 수집·이용 동의서.pdf","note":null},
        {"doc_type":"other","file_name":"그림 강좌 안내문.pdf","note":"자기개발영역 참고자료"}
      ]
    },
    {
      "email":"demo.p02@example.com",
      "docs":[
        {"doc_type":"application_form","file_name":"2026 신청서.pdf","note":null},
        {"doc_type":"consent_form","file_name":"동의서.pdf","note":null}
      ]
    },
    {
      "email":"demo.p07@example.com",
      "docs":[
        {"doc_type":"application_form","file_name":"신청서(윤미래).pdf","note":"주 부양자 변경 관련 메모 첨부"}
      ]
    }
  ]$json$::jsonb;

  FOR v_r IN SELECT value FROM jsonb_array_elements(v_rows)
  LOOP
    SELECT id INTO v_pid FROM public.participants
     WHERE public.norm_email(email) = public.norm_email(v_r->>'email');
    CONTINUE WHEN v_pid IS NULL;  -- 데모 당사자 없으면 스킵
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.seoul_application_documents WHERE participant_id = v_pid);  -- 멱등

    -- application_id NOT NULL — 참여자의 최신 신청을 붙인다(없으면 스킵).
    SELECT id INTO v_appid FROM public.seoul_applications
     WHERE participant_id = v_pid ORDER BY created_at DESC LIMIT 1;
    CONTINUE WHEN v_appid IS NULL;

    FOR v_d IN SELECT value FROM jsonb_array_elements(v_r->'docs')
    LOOP
      INSERT INTO public.seoul_application_documents
        (application_id, participant_id, doc_type, file_name, storage_path, note, uploaded_by)
      VALUES (v_appid, v_pid,
              v_d->>'doc_type',
              v_d->>'file_name',
              -- 경로 첫 세그먼트 = 참여자 id(소유자 규칙). ★실제 파일 없음(메타데이터 시드).
              v_pid || '/applications/' || v_appid || '/seed-' || gen_random_uuid() || '.pdf',
              v_d->>'note',
              v_supporter_id);
    END LOOP;
  END LOOP;
END $$;
