-- ============================================================
-- 아름드리꿈터 개인예산 관리 앱 - 고품질 테스트 데이터 시드 (v5 기반)
-- 목업 디자인 데이터를 참조하여 실제 시연이 가능하도록 구성했습니다.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. 기존 테스트 데이터 초기화
DELETE FROM public.transactions;
DELETE FROM public.file_links;
DELETE FROM public.evaluations;
DELETE FROM public.plans;
DELETE FROM public.funding_sources;
DELETE FROM public.participants;
DELETE FROM public.profiles;

-- Auth 사용자는 관리자가 직접 관리하는 것을 권장하나, 시연을 위해 기존 테스트 계정 삭제 후 재생성
DELETE FROM auth.users WHERE email LIKE '%@nowondaycare.org' OR email LIKE 'demo-%';

-- ============================================================
-- 2. Auth Users (로그인 계정) 생성
-- ============================================================
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES 
-- [관리자]
('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'admin@nowondaycare.org', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"최고관리자"}', NOW(), NOW()),

-- [지원자]
('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'supporter@nowondaycare.org', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"김지원 실무자"}', NOW(), NOW()),

-- [당사자들 - 목업 성함 반영]
('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333301', 'authenticated', 'authenticated', 'minjun@nowondaycare.org', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"김민준"}', NOW(), NOW()),
('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333302', 'authenticated', 'authenticated', 'seoyeon@nowondaycare.org', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"이서연"}', NOW(), NOW()),
('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333303', 'authenticated', 'authenticated', 'yerin@nowondaycare.org', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"정예린"}', NOW(), NOW()),
('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333304', 'authenticated', 'authenticated', 'dohyun@nowondaycare.org', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"박도현"}', NOW(), NOW());

-- ============================================================
-- 3. 프로필 역할 설정
-- ============================================================
UPDATE public.profiles SET role = 'admin' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.profiles SET role = 'supporter' WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE public.profiles SET role = 'participant' WHERE id LIKE '33333333%';

-- ============================================================
-- 4. 당사자 설정 (Participants)
-- ============================================================
INSERT INTO public.participants (
  id, monthly_budget_default, yearly_budget_default, assigned_supporter_id
) VALUES 
('33333333-3333-3333-3333-333333333301', 200000, 2400000, '22222222-2222-2222-2222-222222222222'),
('33333333-3333-3333-3333-333333333302', 150000, 1800000, '22222222-2222-2222-2222-222222222222'),
('33333333-3333-3333-3333-333333333303', 100000, 1200000, '22222222-2222-2222-2222-222222222222'),
('33333333-3333-3333-3333-333333333304', 300000, 3600000, '22222222-2222-2222-2222-222222222222');

-- ============================================================
-- 5. 예산 재원 (Funding Sources)
-- 시각화 테스트를 위해 잔액 상태를 다양하게 구성
-- ============================================================
INSERT INTO public.funding_sources (
  id, participant_id, name, monthly_budget, yearly_budget, current_month_balance, current_year_balance
) VALUES 
-- 김민준: 넉넉한 상태 (Luxury)
('fs-minjun-01', '33333333-3333-3333-3333-333333333301', '활동지원금', 150000, 1800000, 145000, 1750000),
('fs-minjun-02', '33333333-3333-3333-3333-333333333301', '개인용돈', 50000, 600000, 48000, 580000),

-- 이서연: 안정적인 상태 (Stable)
('fs-seoyeon-01', '33333333-3333-3333-3333-333333333302', '식비예산', 150000, 1800000, 95000, 1600000),

-- 정예린: 부족한 상태 (Critical)
('fs-yerin-01', '33333333-3333-3333-3333-333333333303', '통합예산', 100000, 1200000, 12000, 1050000),

-- 박도현: 보통 상태 (Observing)
('fs-dohyun-01', '33333333-3333-3333-3333-333333333304', '활동보조', 200000, 2400000, 110000, 2200000),
('fs-dohyun-02', '33333333-3333-3333-3333-333333333304', '문화생활', 100000, 1200000, 45000, 1100000);

-- ============================================================
-- 6. 거래 내역 (Transactions) - 목업 장소 반영
-- ============================================================
INSERT INTO public.transactions (
  participant_id, creator_id, funding_source_id, date, activity_name, 
  amount, category, memo, payment_method, status
) VALUES 
-- 김민준 내역
('33333333-3333-3333-3333-333333333301', '33333333-3333-3333-3333-333333333301', 'fs-minjun-01', CURRENT_DATE - INTERVAL '1 day', '스타벅스 노원점', 5500, '식비', '아이스 아메리카노 한 잔', '체크카드', 'confirmed'),
('33333333-3333-3333-3333-333333333301', '33333333-3333-3333-3333-333333333301', 'fs-minjun-02', CURRENT_DATE, '편의점 간식', 2000, '식비', '초콜릿 구매', '현금', 'pending'),

-- 이서연 내역
('33333333-3333-3333-3333-333333333302', '33333333-3333-3333-3333-333333333302', 'fs-seoyeon-01', CURRENT_DATE - INTERVAL '3 days', '이마트 노원점', 45000, '식비', '식재료 대량 구매', '체크카드', 'confirmed'),
('33333333-3333-3333-3333-333333333302', '33333333-3333-3333-3333-333333333302', 'fs-seoyeon-01', CURRENT_DATE - INTERVAL '1 day', '볼링장에서 즐겁게 놀아요', 12000, '여가활동', '친구들과 볼링 게임', '체크카드', 'confirmed'),

-- 정예린 내역 (지출 많음)
('33333333-3333-3333-3333-333333333303', '33333333-3333-3333-3333-333333333303', 'fs-yerin-01', CURRENT_DATE - INTERVAL '5 days', '백화점 쇼핑', 88000, '생활용품', '겨울 옷 구매', '체크카드', 'confirmed');

-- ============================================================
-- 7. 월별 평가 (Evaluations) - 목업 텍스트 반영
-- ============================================================
INSERT INTO public.evaluations (
  participant_id, month, tried, learned, pleased, concerned, next_step, easy_summary, creator_id
) VALUES 
(
  '33333333-3333-3333-3333-333333333301', 
  date_trunc('month', CURRENT_DATE), 
  '혼자서 카페에 가서 주문하기를 시도했습니다.', 
  '키오스크 사용법을 정확히 익혔습니다.', 
  '스스로 좋아하는 음료를 주문하고 마시는 것을 매우 즐거워했습니다.', 
  '사람이 붐비는 시간에는 조금 긴장하는 모습을 보였습니다.', 
  '다음 달에는 친구와 함께 카페에 가보려고 합니다.', 
  '내 선택으로 즐겁게 생활했어요! 키오스크 주문도 씩씩하게 잘하셨어요. 다음 달에는 친구랑 같이 가볼까요?', 
  '22222222-2222-2222-2222-222222222222'
),
(
  '33333333-3333-3333-3333-333333333302', 
  date_trunc('month', CURRENT_DATE), 
  '계획적인 마트 장보기를 시도했습니다.', 
  '필요한 물건 목록을 미리 적어가면 과소비를 줄일 수 있다는 것을 배웠습니다.', 
  '안정적으로 예산을 잘 쓰고 있어요. 계획한 금액 내에서 장보기를 마쳐서 뿌듯해했습니다.', 
  '특별히 걱정되는 부분은 없습니다.', 
  '다음 달엔 더 잘할 수 있어요! 지금처럼 계획적인 소비를 유지해봐요.', 
  '이번 달에도 똑똑하게 예산을 잘 쓰셨어요! 필요한 물건만 쏙쏙 골라 사는 모습이 멋져요.', 
  '22222222-2222-2222-2222-222222222222'
);

-- ============================================================
-- 8. 서류 링크 (File Links)
-- ============================================================
INSERT INTO public.file_links (
  participant_id, title, url, file_type
) VALUES 
('33333333-3333-3333-3333-333333333301', '3월 자립생활 계획서', 'https://docs.google.com/document/d/demo1', '계획서'),
('33333333-3333-3333-3333-333333333301', '활동 사진 모음', 'https://photos.google.com/album/demo1', '참고자료'),
('33333333-3333-3333-3333-333333333302', '상반기 개별지원 계획', 'https://docs.google.com/document/d/demo2', '계획서');
