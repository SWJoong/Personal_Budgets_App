-- 데모 모드용 관리자 프로필 삽입
-- server.ts의 DEMO_ADMIN_ID (00000000-0000-0000-0000-000000000001)와 일치해야 함
-- 참여자 데모 유저(김지수, UUID: 11e95b8b-6806-496d-9f36-88bd04e814b3)는 seed.sql에 이미 존재
-- profiles 테이블에는 email 컬럼 없음 (id, name, role, onboarding_completed 등만 존재)
INSERT INTO profiles (id, name, role)
VALUES ('00000000-0000-0000-0000-000000000001', '관리자', 'admin')
ON CONFLICT (id) DO NOTHING;
