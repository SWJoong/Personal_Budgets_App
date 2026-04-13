-- Migration 18: 거래 내역 샘플 위치 데이터 추가
-- 서울 노원구 및 주변 실제 좌표 기반
-- Supabase SQL Editor에서 실행

-- ──────────────────────────────────────────────────────────────
-- 김지수 (11e95b8b...)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '스타벅스 노원점', place_lat = 37.6543, place_lng = 127.0576
WHERE participant_id = '11e95b8b-6806-496d-9f36-88bd04e814b3'
  AND activity_name = '스타벅스 노원점';

UPDATE public.transactions
SET place_name = '다이소 노원점', place_lat = 37.6554, place_lng = 127.0565
WHERE participant_id = '11e95b8b-6806-496d-9f36-88bd04e814b3'
  AND activity_name = '다이소 생활용품';

UPDATE public.transactions
SET place_name = '이마트 노원점', place_lat = 37.6555, place_lng = 127.0520
WHERE participant_id = '11e95b8b-6806-496d-9f36-88bd04e814b3'
  AND activity_name = '이마트 노원점';

-- ──────────────────────────────────────────────────────────────
-- 이다은 (61a94ba0...)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = 'CU 노원역점', place_lat = 37.6547, place_lng = 127.0571
WHERE participant_id = '61a94ba0-d811-4e87-ba1f-daec32292655'
  AND activity_name = '편의점 간식';

UPDATE public.transactions
SET place_name = '노원 스포츠볼링', place_lat = 37.6530, place_lng = 127.0585
WHERE participant_id = '61a94ba0-d811-4e87-ba1f-daec32292655'
  AND activity_name = '볼링장';

UPDATE public.transactions
SET place_name = '동네 슈퍼 노원', place_lat = 37.6560, place_lng = 127.0550
WHERE participant_id = '61a94ba0-d811-4e87-ba1f-daec32292655'
  AND activity_name = '동네 슈퍼';

-- ──────────────────────────────────────────────────────────────
-- 박현준 (8a05bce8...)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '맥도날드 노원점', place_lat = 37.6537, place_lng = 127.0569
WHERE participant_id = '8a05bce8-1378-452b-8287-5173f316dfe5'
  AND activity_name = '맥도날드';

UPDATE public.transactions
SET place_name = 'CGV 노원', place_lat = 37.6548, place_lng = 127.0574
WHERE participant_id = '8a05bce8-1378-452b-8287-5173f316dfe5'
  AND activity_name = 'CGV 영화관';

UPDATE public.transactions
SET place_name = '이마트 상계점', place_lat = 37.6510, place_lng = 127.0610
WHERE participant_id = '8a05bce8-1378-452b-8287-5173f316dfe5'
  AND activity_name = '이마트 장보기';

-- ──────────────────────────────────────────────────────────────
-- 정소연 (d8344b8c...)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '카페 봄봄 노원', place_lat = 37.6541, place_lng = 127.0567
WHERE participant_id = 'd8344b8c-2c0d-4067-b587-3af27d18cb3b'
  AND activity_name = '카페 라떼';

UPDATE public.transactions
SET place_name = '노원 영풍문고', place_lat = 37.6542, place_lng = 127.0572
WHERE participant_id = 'd8344b8c-2c0d-4067-b587-3af27d18cb3b'
  AND activity_name = '서점 방문';

UPDATE public.transactions
SET place_name = '노원 약국', place_lat = 37.6545, place_lng = 127.0568
WHERE participant_id = 'd8344b8c-2c0d-4067-b587-3af27d18cb3b'
  AND activity_name = '약국';

-- ──────────────────────────────────────────────────────────────
-- 최준호 (c0a7c424...)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '김밥천국 노원역점', place_lat = 37.6535, place_lng = 127.0560
WHERE participant_id = 'c0a7c424-b0a5-4749-8fbd-61d4f6f820d2'
  AND activity_name = '김밥천국';

UPDATE public.transactions
SET place_name = '노원 롤링볼', place_lat = 37.6517, place_lng = 127.0523
WHERE participant_id = 'c0a7c424-b0a5-4749-8fbd-61d4f6f820d2'
  AND activity_name = '노원 롤링볼';

UPDATE public.transactions
SET place_name = '롯데마트 노원점', place_lat = 37.6505, place_lng = 127.0615
WHERE participant_id = 'c0a7c424-b0a5-4749-8fbd-61d4f6f820d2'
  AND activity_name = '마트 식재료';

-- ──────────────────────────────────────────────────────────────
-- 윤서희 (39ee5a79...)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '분식집 먹자', place_lat = 37.6538, place_lng = 127.0555
WHERE participant_id = '39ee5a79-d6c8-44fc-ba5f-6678da8d0ea1'
  AND activity_name = '떡볶이 분식';

UPDATE public.transactions
SET place_name = '노원 중앙공원', place_lat = 37.6590, place_lng = 127.0600
WHERE participant_id = '39ee5a79-d6c8-44fc-ba5f-6678da8d0ea1'
  AND activity_name = '공원 산책';

UPDATE public.transactions
SET place_name = '다이소 공릉점', place_lat = 37.6480, place_lng = 127.0735
WHERE participant_id = '39ee5a79-d6c8-44fc-ba5f-6678da8d0ea1'
  AND activity_name = '다이소';

-- ──────────────────────────────────────────────────────────────
-- 조민준 (67b6cae8...)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '교촌치킨 노원점', place_lat = 37.6544, place_lng = 127.0580
WHERE participant_id = '67b6cae8-d910-402c-99e4-366a7f257b8e'
  AND activity_name = '치킨 배달';

UPDATE public.transactions
SET place_name = '노원 PC방 게임존', place_lat = 37.6549, place_lng = 127.0563
WHERE participant_id = '67b6cae8-d910-402c-99e4-366a7f257b8e'
  AND activity_name = '게임방';

UPDATE public.transactions
SET place_name = 'GS25 노원역점', place_lat = 37.6546, place_lng = 127.0570
WHERE participant_id = '67b6cae8-d910-402c-99e4-366a7f257b8e'
  AND activity_name = '편의점 도시락';

-- ──────────────────────────────────────────────────────────────
-- 한아름 (2d83e52d...)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '노원 베이커리', place_lat = 37.6556, place_lng = 127.0558
WHERE participant_id = '2d83e52d-16c3-48ed-86d1-689fb7dde940'
  AND activity_name = '빵집';

UPDATE public.transactions
SET place_name = '문구사 노원', place_lat = 37.6540, place_lng = 127.0575
WHERE participant_id = '2d83e52d-16c3-48ed-86d1-689fb7dde940'
  AND activity_name = '미술 재료';

UPDATE public.transactions
SET place_name = '노원 과일슈퍼', place_lat = 37.6552, place_lng = 127.0545
WHERE participant_id = '2d83e52d-16c3-48ed-86d1-689fb7dde940'
  AND activity_name = '슈퍼마켓';

-- ──────────────────────────────────────────────────────────────
-- 김철수 (33333333-...301)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '한식당 노원', place_lat = 37.6536, place_lng = 127.0562
WHERE participant_id = '33333333-3333-3333-3333-333333333301'
  AND activity_name = '점심식사';

UPDATE public.transactions
SET place_name = 'CGV 노원', place_lat = 37.6548, place_lng = 127.0574
WHERE participant_id = '33333333-3333-3333-3333-333333333301'
  AND activity_name = '영화관람';

UPDATE public.transactions
SET place_name = '홈플러스 노원점', place_lat = 37.6575, place_lng = 127.0590
WHERE participant_id = '33333333-3333-3333-3333-333333333301'
  AND activity_name = '마트장보기';

-- ──────────────────────────────────────────────────────────────
-- 이영희 (33333333-...302)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '카페 커피한잔 노원', place_lat = 37.6543, place_lng = 127.0568
WHERE participant_id = '33333333-3333-3333-3333-333333333302'
  AND activity_name = '커피';

UPDATE public.transactions
SET place_name = '이마트 노원점', place_lat = 37.6555, place_lng = 127.0520
WHERE participant_id = '33333333-3333-3333-3333-333333333302'
  AND activity_name = '생필품';

UPDATE public.transactions
SET place_name = '노원 아트센터', place_lat = 37.6565, place_lng = 127.0540
WHERE participant_id = '33333333-3333-3333-3333-333333333302'
  AND activity_name = '공연티켓';

-- ──────────────────────────────────────────────────────────────
-- 박민수 (33333333-...303)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '노원 삼겹살집', place_lat = 37.6533, place_lng = 127.0582
WHERE participant_id = '33333333-3333-3333-3333-333333333303'
  AND activity_name = '저녁회식';

UPDATE public.transactions
SET place_name = 'GS칼텍스 노원주유소', place_lat = 37.6520, place_lng = 127.0600
WHERE participant_id = '33333333-3333-3333-3333-333333333303'
  AND activity_name = '주유비';

UPDATE public.transactions
SET place_name = '노원 스포츠용품점', place_lat = 37.6527, place_lng = 127.0570
WHERE participant_id = '33333333-3333-3333-3333-333333333303'
  AND activity_name = '운동용품';

-- ──────────────────────────────────────────────────────────────
-- 정수진 (33333333-...304)
-- ──────────────────────────────────────────────────────────────
UPDATE public.transactions
SET place_name = '브런치 카페 하나', place_lat = 37.6539, place_lng = 127.0577
WHERE participant_id = '33333333-3333-3333-3333-333333333304'
  AND activity_name = '브런치';

UPDATE public.transactions
SET place_name = '올리브영 노원점', place_lat = 37.6544, place_lng = 127.0566
WHERE participant_id = '33333333-3333-3333-3333-333333333304'
  AND activity_name = '화장품';

UPDATE public.transactions
SET place_name = '다이소 노원중계점', place_lat = 37.6515, place_lng = 127.0635
WHERE participant_id = '33333333-3333-3333-3333-333333333304'
  AND activity_name = '인테리어소품';
