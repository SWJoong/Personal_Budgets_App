# KRDS UX·접근성 — 검증 결과서 & 설계 결정 (W)

> **작성**: W(설계·검증 축). 단, 이 판은 **W 사용량 한도로 U 가 대행 작성** — W 복귀 시 §2 판정·§3 결정·§5 문구를
> 리뷰·보정 바람. **정오표**: 관련 스킬 레퍼런스 `.claude/skills/ux-ui/references/krds-checklist.md`(W1),
> 프리미티브 RED 계약 `src/components/ui/{Modal,LiveRegion,FormField}.test.tsx`(W3).
> **범위**: 자체상징 + 공통 계층만(정부전용 N/A). 미보유 컴포넌트(브레드크럼·페이지네이션) 신규 도입 안 함(사용자 확정).

---

## 1. 적용 범위 & N/A 원장

KRDS 1단계 311항목(스타일 21·컴포넌트 170·기본패턴 47·서비스패턴 73)을 3계층으로 스코핑.

### 1.1 N/A (근거 명시)
| 항목 | 근거 |
|------|------|
| 공식 배너 / 운영기관 식별자 | 정부 상징 전용 — 자체상징 서비스 |
| Pretendard **GOV** / 본문 17px | 정부 상징 전용 → **Pretendard·본문 16px↑** 로 대체 준수 |
| 정부 색상 팔레트(Primary/Secondary/Gray/System 색상값) | 자체 팔레트 + 공통 규칙(일관성·대비 4.5:1↑) 준수 |
| 브레드크럼 / 콘텐츠 내 탐색(목차) / 페이지네이션 | 탐색 depth ≤2·목록 짧음 — 사용자 확정 “도입 안 함” |
| 서비스패턴: 방문·검색·정책정보 확인 | 해당 플로우 없음 |

### 1.2 우리가 KRDS보다 엄격히 유지 (다운그레이드 금지)
- 터치 타깃 **44×44px**(KRDS 최소 24px) · 줄간격 **1.85**(최소 1.5) · 아이콘 항상 텍스트/레이블 동반.

---

## 2. 검증 결과서 (P / F / E / N/A) — 스켈레톤

> 판정: **P**(충족) · **F**(미충족) · **E**(부분/의도적 예외, 근거) · **N/A**(해당 없음, 근거).
> 준수율 = P/(P+F+E). 아래는 감사(2026-08-26) 기준 **초기 판정 seed** — W6 수동 스윕에서 확정/보정.

### 2.1 스타일
| # | 항목 | 판정 | 근거·위치 |
|---|------|:---:|-----------|
| S1 | `<html lang="ko">` | **P** | `app/layout.tsx:18` |
| S2 | 포커스 표시 `:focus-visible` | **P** | `globals.css:312` |
| S3 | 본문 줄간격 1.85 | **P** | `globals.css:42` (body) |
| S4 | 색상 대비 4.5:1 (보조문구) | **F→진행** | `text-zinc-400` 다수 → 500/600/700 (브랜치 in-flight, 잔여 배지·`text-[8~11px]`) |
| S5 | 색상 단독 의존 금지 | **F** | 상태 배지 일부 색만 — 텍스트/형태 병행 필요 |
| S6 | 축소 텍스트 지양 | **E** | `text-xs`~`text-[8px]` 과다(달력·배지) — 최소화 대상 |

### 2.2 컴포넌트 — 폼
| # | 항목 | 판정 | 근거·위치 |
|---|------|:---:|-----------|
| F1 | label 연결(htmlFor/id) | **F** | 주 플로우 `ReceiptClient`(`:194,215,226,241,252,306`)·Onboarding·ProfileEdit·applications/new·admin/participants/new 미연결 |
| F2 | 필수 `aria-required` + 시각표시 | **F** | 0건 |
| F3 | 오류 `aria-invalid`+`describedby`+`role=alert` | **F** | 0건 |
| F4 | 도움말/형식 힌트 연결 | **F** | 날짜(transactions/new) 등 힌트 없음 |
| F5 | 라디오 `fieldset/legend` | **F** | ProfileEdit 라디오 그룹 |
| F6 | onChange 자동제출 금지 | **E** | 셀렉트 자동제출 여부 C4 에서 확인 |
| F7 | 기연결 폼(정렬만) | **P** | `NewTransactionClient`·`AssessmentClient` (getByLabelText 통과) |
| → | **공용 `FormField` 로 통일** | 계약 | `src/components/ui/FormField.test.tsx` (RED) |

### 2.3 컴포넌트 — 모달
| # | 항목 | 판정 | 근거·위치 |
|---|------|:---:|-----------|
| M1 | role=dialog·aria-modal·이름 | **E** | `NavDropdown` 만 있음; FaqModal·HelpSlideshow·AdminHelpModal·ImageLightbox·login 이스터에그 없음 |
| M2 | 포커스 이동/트랩/복원 | **F** | **어느 모달도 안 함**(NavDropdown 포함) |
| M3 | Esc·오버레이·scroll-lock | **E** | NavDropdown P, 나머지 F |
| → | **공용 `Modal` 로 통일** | 계약 | `src/components/ui/Modal.test.tsx` (RED) |

### 2.4 컴포넌트 — 탐색
| # | 항목 | 판정 | 근거·위치 |
|---|------|:---:|-----------|
| N1 | 각 nav `aria-label` | **F** | AdminSidebar·NavDropdown 내부 nav 무명 |
| N2 | 현재 위치 `aria-current` | **E** | NavDropdown/TabBar P, AdminSidebar F(시각만, `:104,147,185`) |
| N3 | 토글 `aria-expanded`+키보드 | **F** | AdminSidebar 서브메뉴 |
| N4 | 당사자 상시 탐색 존재 | **F** | TabBar 죽은 코드·NavDropdown 3화면만 → **§3 결정** |

### 2.5 컴포넌트 — 알림/상태
| # | 항목 | 판정 | 근거·위치 |
|---|------|:---:|-----------|
| A1 | `role=status`/`alert`·`aria-live` | **F** | 앱 전체 0건(`ReceiptClient:210` OCR·`ProfileEditClient:43` 토스트·`DisplaySettingsClient:87` 저장) |
| → | **공용 `LiveRegion`/`useToast`** | 계약 | `src/components/ui/LiveRegion.test.tsx` (RED) |

### 2.6 컴포넌트 — 버튼·링크 / 파일업로드
| # | 항목 | 판정 | 근거·위치 |
|---|------|:---:|-----------|
| B1 | 터치 44px | **E** | 대부분 P; FaqButton·HelpButton·AdminSidebar 토글·모달 ✕ sub-44 |
| B2 | 아이콘 버튼 `aria-label` | **E** | 다수 P, 일부 누락 |
| B3 | 외부/새창 링크 표시 | **F** | `MoreMenuClient:264`·`login:207` 표시 없음 |
| B4 | 이모지 `aria-hidden` | **E** | 브랜치 in-flight 로 정리 중, 불일치 잔존 |
| U1 | 영수증 업로드 안내/재시도/구체오류 | **F** | C2 대상 |

### 2.7 기본 패턴
| # | 항목 | 판정 | 근거·위치 |
|---|------|:---:|-----------|
| G1 | skip-link 목적지 `id`+`tabIndex` | **F→진행** | home/calendar 4곳만 → 전 `<main>` ~44곳(A1) |
| G2 | main 단일(중첩 없음) | **P** | `SupporterLayoutClient.tsx:106`, skip-nav 커밋 ef30e56 |
| G3 | 페이지별 `metadata.title` | **F→진행** | 브랜치 in-flight 지속(A4) |
| G4 | 헤딩 순서 | **F** | `/more` h1→h3, login h1→h3 (A5) |
| G5 | 오류/빈 상태 다음행동 제시 | **P** | 빈 상태 문구 양호(“담당 선생님에게…”) |

### 2.8 서비스 패턴
| # | 항목 | 판정 | 근거 |
|---|------|:---:|------|
| SV1 | 로그인 접근성 | **E** | 레이블·오류 점검 대상 |
| SV2 | 신청(applications/new) 단계·되돌리기 | **E** | 폼 접근성(C1)과 함께 |
| SV3 | 방문·검색·정책정보 | **N/A** | 해당 플로우 없음 |

---

## 3. W4 결정 — 당사자 상시 탐색(nav)

**문제**: 당사자는 상시 탐색 랜드마크가 사실상 없다. 유일하게 `aria-label`+`aria-current` 를 갖춘
`src/components/layout/TabBar.tsx` 는 **어디서도 import 안 됨(죽은 코드)**. `NavDropdown`(햄버거)은
`/more`·`/guide`·`/settings/profile` **3화면만** 마운트.

**결정: TabBar 를 당사자 레이아웃의 상시 하단 탭바로 부활한다.** (택1 중: 부활 ✅ / 햄버거 전용 / 제거)

**근거**
- 발달장애인 인지 접근성: **항상 보이는·예측 가능한** 탐색이 숨은 햄버거(추상 아이콘+한 번 더 탭)보다 부하가 낮다.
- ux-ui SKILL.md 원칙과 일치: “핵심 기능은 탭바/홈에서 1번 탭으로 접근”, “탐색 depth 최대 2단계”.
- TabBar 는 이미 최선의 a11y 기반(`<nav aria-label>`·`aria-current`) 보유 → 되살리는 비용이 가장 작다.

**U 구현 지침**
1. 당사자 레이아웃(`(participant)/layout`)에 `<TabBar/>` 마운트. (TabBar 는 이미 `/login`·`/supporter`·`/admin` 자가 숨김.)
2. 탭 3개 유지(홈·영수증·더보기) — 인지부하 최소. 나머지(달력·갤러리·지도·계획)는 `/more` 허브가 담당.
3. a11y 보정: 탭 이모지 `aria-hidden="true"`(뒤 텍스트 레이블이 이름 제공), 활성 상태는 색+굵기+지시점 등 **비색 큐 병행**, 중복 클래스 `min-w-[64px] … min-w-[44px]` 정리.
4. **햄버거 중복 제거**: 상시 탭바 도입 후 당사자용 `NavDropdown` 은 역할 축소(전체메뉴는 `/more`). NavDropdown 의 focus-trap 미비는 §4 `Modal` 로 흡수하거나, 당사자 상시 nav 에서 제외.
5. TabBar 내 supporter/admin 탭 배열은 라우트 가드로 죽은 분기 → 제거해 표면 축소(담당자·관리자는 AdminSidebar 사용).

---

## 4. 프리미티브 계약 요약 (W3, RED)

U 가 초록화할 공용 프리미티브 3종. 계약 상세는 각 테스트 파일이 정본.

| 프리미티브 | 파일(신규) | 계약(RED) | 리트로핏 대상 |
|-----------|-----------|-----------|--------------|
| **Modal** | `src/components/ui/Modal.tsx` | role=dialog·aria-modal·이름 / **focus move-in·trap·restore** / Esc·scroll-lock / 닫힘 시 미렌더 | FaqModal·HelpSlideshow·AdminHelpModal·ImageLightbox·login 이스터에그·NavDropdown |
| **LiveRegion + useToast** | `src/components/ui/LiveRegion.tsx` | status(polite)·alert(assertive) **상시 마운트** / `announce(msg, politeness='polite')` 라우팅 | ProfileEdit 토스트·ReceiptClient OCR·DisplaySettings 저장·전 폼 오류 |
| **FormField** | `src/components/ui/FormField.tsx` | label 연결·`aria-required`·오류 시 `aria-invalid`+`describedby`→`role=alert`·help 연결(render-prop) | §2.2 폼 전부(기연결 폼은 정렬만) |

> 재사용: 포털·마운트 가드는 기존 `useMounted()`(45ba9bd)·NavDropdown 포털 패턴. 아이콘 라이브러리 없음(이모지) → 신규 의존성 불필요.

---

## 5. easy-read 검수 시드 (W5)

신규/변경 레이블·오류문·도움말은 `easy-read-review` 기준으로 확정. 초안 문구(예시, 확정 전):
- 저장 성공(status): “저장했어요.” · 진행(status): “사진을 읽고 있어요…”
- 오류(alert): 무엇이·어떻게를 구체적으로 — “이름을 적어 주세요.” “사진이 너무 커요. 더 작은 사진을 올려 주세요.”
- 형식 힌트(help): “숫자만 적어요.” “예: 2026-08-26”
- 새 창 링크: 보이는 텍스트 뒤 “↗”, `aria-label` 에 “(새 창)”.

> 원칙: 짧은 한 문장·능동태·다음 행동 제시. 전문용어·이중부정 금지.

---

## 6. 수동 DevTools 스윕 (W6) — 체크리스트

각 항목 실측 후 §2 판정 확정. 도구법 상세는 스킬 레퍼런스 §6.
- [ ] Computed `font-size` 16px↑ / `line-height` 1.5↑(목표 1.85) — 대표 화면 5종
- [ ] 대비 4.5:1↑ (CSS Overview + 실화면) — 잔여 `text-zinc-400`·배지
- [ ] Tab 순서 논리성 · 포커스 링 가시성 · Esc · 모달 포커스 트랩/복원
- [ ] 터치 타깃 Computed `height`/`width` 44px — FaqButton·HelpButton·토글·모달 ✕
- [ ] `:hov`/`:focus` 강제 상태 색 대비
- [ ] 접근성 트리: main 단일 · 헤딩 순서 · nav 이름

---

## 7. 핸드오프 & Open items

**핸드오프(→U)**: §4 RED 계약 초록화(프리미티브) + §2 F 항목 구현(Phase A~C) + §3 TabBar 부활 + jsx-a11y CI.
**게이트**: `npm test`(계약 초록) + `npm run lint`(jsx-a11y) + `npm run build` + CI quality-check.

**Open items (W 판단 — 사용자 개입 불요)**
- (W4 결정됨) 죽은 TabBar → **부활**. 단 3·4·5번 U 구현 시 세부 확인.
- 개인정보처리방침·서비스정보 링크 위치(모바일 푸터 대체 — `/more` 또는 설정) — 후속.
- 공급자 원장(supporter 거래장부) `<ul>`카드 → `<table scope>` 전환 여부 — 선택·후속.
