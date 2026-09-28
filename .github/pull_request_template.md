<!-- 하네스 PR 템플릿 — 머지 게이트와 검증 워크플로가 아래 항목을 읽는다. 줄머리 "- 항목:" 형식을 유지한다. -->
## 요약


## 하네스
- 유형: feat | test(계약) | docs | harness
- 검증 티어: docs | small | high — 근거(경로군·규모)
  <!-- 값은 docs·small·high 중 한 단어로 시작한다(T0/T1/T2·굵게·따옴표 금지 — 게이트가 못 읽는다). 계산 티어보다 낮게 선언해도 게이트는 높은 쪽을 적용한다. 당사자 화면·공통 컴포넌트의 접근성 동작(aria·role·포커스·터치 타깃) 변경은 문구가 없어도 high 로 선언한다. -->
- 계약 PR: #NNN | 없음
- 게이트: contract ✓/✗ · all(tsc·lint·test·build) ✓/✗
- VERIFY REPORT: <코멘트 링크> | 해당 없음(docs)
- Manual-Ops: 없음 | 머지 후 사용자가 대시보드에서 할 수동 작업(순서·되돌림)
- 사용자 결정: D-YYYYMMDD-nn | 없음
