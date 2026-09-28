---
name: a11y-verification-probes
description: 당사자·사이드바 a11y PR 검증 보조 체크 — 모드별 강제 배경색으로 대비 계산, 포커스 재마운트 돌연변이(key=state), 고대비 사이드바 포커스링 2.19:1, worktree Turbopack build 실패, 안내문이 이름 댄 메뉴 실존 grep
metadata:
  type: reference
---

[[a11y-class-contract-probes]]·[[a11y-contract-mutation-gaps]] 에 더해 반복 확인할 것.

- **대비 계산은 모드별 강제 배경 기준**: 다크 #1a2540, 고대비 #fff(2px 검정 테두리). 노랑 모드는 bg-card 를 덮지 않아 라이트 값과 같다. 계산은 python colorsys + WCAG 휘도 공식으로 트랙·손잡이·체크 표시·포커스링을 각각 한다.
- **포커스 재마운트 돌연변이**: 세터가 vi.fn 이면 토글해도 상태가 바뀌지 않는다. 그래서 `key={String(state)}` 재마운트(포커스 소실) 돌연변이가 살아남는다. 상태를 가진 모킹 + `document.activeElement` 단언을 제안한다. 같은 요소 참조로 클릭 뒤 속성을 단언하는 테스트는 재마운트를 암묵적으로 잡는다(AdminSidebar 토글 계약이 그 예).
- **고대비 사이드바 포커스링**: 전역 `:focus-visible` 은 --color-primary 를 쓴다. 고대비 값 hsl(207 100% 25%) 는 --color-sidebar #000 위에서 2.19:1 이다(기존 결함). 사이드바 컨트롤을 바꾸는 PR 에서 다시 본다.
- **worktree build**: node_modules 심볼릭 링크 worktree 에서 `next build`(Turbopack)는 "Symlink node_modules is invalid, it points out of the filesystem root" 로 실패한다. PR 결함이 아니다. build 는 CI quality-check 로 확인하고, 리포트 GATE_LOCAL 에 그 사실을 적는다.
- **문구 대조**: 안내문이 이름을 댄 메뉴·버튼이 실제로 있는지 grep 한다(쉬운 글 A-06 일관성). 스위치 aria-label 이 보이는 라벨과 어긋나면 2.5.3 과 A-06 을 함께 위반한다.

**Why:** jsdom 계약은 CSS·포커스 이동을 보지 않는다. 모드별 대비 회귀와 재마운트 포커스 소실은 계약을 통과한 채 남는다.
**How to apply:** 당사자 화면·사이드바 시각 변경 PR 이면 위 항목을 차례로 돌린다.
