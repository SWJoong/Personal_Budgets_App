# QA 실행 기록 (사람 자리 · U 세션에서도)

- 정본 체크리스트: `../16-functional-qa-checklist.md`(경로별 기능 QA), `../08-persona-qa-findings.md`(페르소나 QA 형식).
- 실행 1회 = 파일 1개: `YYYY-MM-DD-<범위>.md` — 표 `# | 항목 | 결과(PASS/FAIL/SKIP) | 증거 | 비고`(`qa-run.sh new` 스캐폴드와 같다 — **결과는 3번째 칸**, `qa-run.sh close` 가 그 칸을 센다), 끝에 요약(건수)과 발견사항(doc16 표 형식).
- 역할: **사람이 실행**(로그인·뮤테이션 클릭은 사람), 오케스트레이터는 준비(체크리스트·프리뷰 URL·시드 상태·재현 절차)와 기록·증거 수집(브라우저 관찰만).
- 끝나면 `bash scripts/agent-sync.sh post w "[QA by user] <범위> PASS n / FAIL m — docs/release/qa-runs/<파일>"`.
- FAIL 은 doc14 백로그 행 또는 GitHub 이슈로. 에이전트의 로컬 스모크(렌더·콘솔 오류 스윕)는 검증 증거이지 사람 QA 를 대체하지 않는다.
- **접근성 감사 유형**: 체크리스트 `../07-a11y-kwcag-1st-eval.md` + `swwa:a11y-audit`. 분업은 같다(사람이 로그인·조작, 오케스트레이터가 관찰·증거·기록). 파일명 `YYYY-MM-DD-a11y-<범위>.md`, 끝나면 `post w "[QA by user] a11y …"`. doc14 W 백로그의 KWCAG 3차 감사 실행 주체 = 사람 + 오케스트레이터 기록.
