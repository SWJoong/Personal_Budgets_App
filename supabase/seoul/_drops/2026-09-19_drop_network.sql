-- ─────────────────────────────────────────────────────────────────────────────
-- 관계망(Track B) 제거 — 라이브 DB 드롭 (Manual-Ops · 대시보드 SQL Editor 에서 수동 실행)
-- ─────────────────────────────────────────────────────────────────────────────
-- 사유: 온톨로지 구축 미완 + 서울형 개인예산제 특수성으로, 앱을 3축(당사자 자기주도성 ·
--       실무자 행정 간소화/계획 공유 · 관리자 파악/슈퍼비전)에 집중해 완성하기로 결정.
--       관계망 빌드 파일 13/14/15 는 저장소에서 제거됨(번호 결번). 이 스크립트는 이미
--       적용된 라이브 객체를 드롭한다(빌드 파일 삭제만으로는 라이브 DB 가 정리되지 않음).
--
-- 대상:
--   14  v_seoul_graph_edges_curated / v_seoul_graph_nodes_curated  (오버레이 큐레이션 뷰)
--   13  seoul_network_entities                                     (관계망 CRUD 테이블 + RLS·인덱스)
--   15  (시드 행)                                                  → 테이블 드롭 시 함께 소멸
--
-- ★유지: 05_seoul_graph.sql 의 v_seoul_graph_nodes / v_seoul_graph_edges (코어 온톨로지 그래프,
--        11_provider_domains 도 의존) — 이 스크립트는 건드리지 않는다.
--
-- 멱등: 모두 IF EXISTS → 재실행 안전. 되돌림: 이 커밋 이전의 13/14/15 를 다시 실행하면 복구.
-- ─────────────────────────────────────────────────────────────────────────────

-- ① 큐레이션 뷰(14) 먼저 — seoul_network_entities 에 의존하므로 테이블보다 먼저 드롭.
DROP VIEW IF EXISTS public.v_seoul_graph_edges_curated;
DROP VIEW IF EXISTS public.v_seoul_graph_nodes_curated;

-- ② 관계망 테이블(13) — CASCADE 로 RLS 정책·인덱스·시드 행(15)까지 함께 제거.
DROP TABLE IF EXISTS public.seoul_network_entities CASCADE;
