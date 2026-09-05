# P7 웨이브1 — 당사자 대면 문구 신뢰·쉬운말(Easy-Read) 교정 설계 (W)

> test-first 계약: `src/test/p7CopyWave1.test.ts` (RED). U(app-6c)가 아래 매핑표대로
> **소스 문자열만** 교체하면 green. src 구현 문구 변경은 U 레인, 이 설계·계약은 W 저작.
> 저자(W)는 이 코드를 쓰지 않은 독립 검증자다.

## 배경

P7 폴리시 웨이브1. 당사자(발달장애인) 대면 화면의 문구를 (1) **신뢰(사실 정합)**,
(2) **쉬운말(Easy-Read)**, (3) **비위협** 세 축으로 교정한다. 감사(evidence) 7개 항목,
총 15개 문자열. 각 후보는 `mcp__easyread__validate_easy_read` 로 실측해 SEN/VOC/STR
경고 0으로 수렴시켰다(초안 4건에서 나온 SEN-02 복문·VOC-01 '확인'·SEN-03 피동 경고는
재작성으로 제거). B8은 원문 대조(fact-preservation)까지 pass.

## Easy-Read 원칙(적용)

능동·짧게·`~해요`체·한자어/외국어(특히 'AI') 회피·비위협. 발달장애 당사자 최우선.

---

## 문구 매핑표 (old → new)

| ID | 파일 | old | new | 근거 |
|----|------|-----|-----|------|
| **B1** | `src/components/layout/MoreMenuClient.tsx` | `이용계획 작성하고 심의 결과 보기` | `계획과 결과를 봐요` | ★**사실오류 교정**. my-plan 은 **열람 전용**(MyPlanClient.tsx L75-83 docstring '열람 전용', 저장/제출 버튼 없음). 계획서는 담당 사회복지사가 작성 → '작성'은 거짓 라벨이라 제거. '심의'는 한자 행정어 제거. 상위 카드 제목이 이미 '내 이용계획'이라 '내' 중복 회피. |
| **B2-pending** | `.../receipt/ReceiptClient.tsx` | `확인 중` | `선생님이 살펴봐요` | SETTLEMENT_LABEL.pending. '확인 중'은 행정톤·무주어 → 검토 주체(선생님)를 드러내 능동·비위협. VOC-01('확인') 회피. |
| **B2-accepted** | 〃 | `인정됨` | `괜찮아요` | 지출 인정(정상). 한자 피동어 → 평가화면 안심톤('괜찮아요, 잘못한 게 아니에요') 계승. |
| **B2-rejected** | 〃 | `반려됨` | `다시 봐야 해요` | 한자+피동, 잘못 지적 톤 → '한 번 더 확인 필요'만 능동·비위협 전달. |
| **B2-recovered** | 〃 | `환수됨` | `선생님과 이야기해요` | '환수'는 위협적 행정어('돈 내놓으라') → 대화 경로로 안내(비위협). |
| **B8** | `.../my-plan/MyPlanClient.tsx` | `요청한다고 불이익이 생기지 않아요.` | `요청해도 나쁜 일은 생기지 않아요.` | 이의신청 안심 문구. '불이익' 한자+위협 → 쉬운 '나쁜 일'. 권리 행사에 불이익 없음을 보존(원문 대조 pass). |
| **B9-submitted** | 〃 | `제출 완료 — 선생님들이 확인할 거예요` | `선생님들이 계획을 냈어요. 곧 살펴볼 거예요.` | STATUS_LABEL.submitted. '제출 완료' 한자+em대시. 계획은 담당자가 작성·제출(열람전용)하므로 당사자 거짓 행위성 없이 '선생님들이' 주어 명시. 짧은 두 문장, '확인' 회피. |
| **B9-approved** | 〃 | `승인됐어요` | `계획대로 해도 좋대요` | STATUS_LABEL.approved(plan.status·latestReview.decision 배너 공용 L179·L184). '승인' 한자+피동 → 따뜻한 능동. |
| **B9-conditional** | 〃 | `조건부로 승인됐어요` | `조금 바꾸면 계획대로 할 수 있어요` | '조건부'·'승인' 한자어 → 실제 의미(일부 수정 시 진행 가능)를 쉬운 말·비위협으로. |
| **B9-rejected** | 〃 | `반려됐어요` | `이번에는 어렵대요` | '반려' 한자+피동+위협 → 부드럽게. 바로 아래 '다시 봐달라고 요청하기'(이의신청) 경로 연결. |
| **B7** | `.../evaluations/page.tsx` | `aria-label="뒤로 가기"` | `더보기로 가기` | 뒤로가기 링크 `href="/more"`(L35). 형제 화면(my-plan·receipt)은 `href="/"`라 '홈으로 가기'를 쓴다 → 이 화면은 홈이 아님. 라벨=실제 목적지로 정확화. |
| **B4-step2** | `.../guide/page.tsx` | `AI가 자동으로 금액과 날짜를 읽어줘요.` | `컴퓨터가 금액과 날짜를 자동으로 읽어줘요.` | 참여자 문구 'AI' 리터럴 금지(선례 ActivitySuggestions.tsx:87 '컴퓨터가 만든'). |
| **B4-step3** | 〃 | `AI가 남은 돈으로 할 수 있는 재미있는 활동을 추천해줘요.` | `컴퓨터가 남은 돈으로 할 수 있는 재미있는 활동을 알려줘요.` | 'AI'→'컴퓨터가', '추천'(한자)→'알려'. |
| **B11-heading** | `.../page.tsx` | `영역별로 보기` | `어디에 썼는지` | 홈 domain_breakdown 제목을 설정 라벨과 통일(uiPreferences BLOCK_METADATA.domain_breakdown.label='어디에 썼는지', 정본 easy 라벨). '영역별로'는 추상·행정톤. |
| **B11-sub** | 〃 | `어디에 썼는지 봐요.` | `무엇에 얼마나 썼는지 봐요.` | 제목이 '어디에 썼는지'가 되면 부제와 중복 → 부제는 설명 문장으로 차별화(능동·`~해요`). |

**수정 불필요**: `src/utils/uiPreferences.ts` — 이미 easy 라벨('어디에 썼는지')이라 page.tsx를
설정 라벨 쪽으로 통일한다. STATUS_LABEL draft/under_review/under_appeal,
APPEAL_OUTCOME_LABEL 4종은 이미 쉬운말이라 변경 없음.

---

## forbid 규칙 (참여자 대면 파일 금칙 리터럴)

계약 `p7CopyWave1.test.ts` 가 negative 단언으로 강제:

- 참여자 문구에 `심의`·`환수`·`불이익` 리터럴 금지(주석 포함 — 재발 방지).
- 참여자 문구에 `AI` 리터럴 금지 — 식별자(`DOMAIN_ICON` 등)의 "AI" 부분문자열은
  정규식 `/(?<![A-Za-z_])AI(?![A-Za-z_])/` 로 제외하고 copy 의 `AI가` 만 잡는다.
- 참여자 문구에 `제출 완료`·`조건부`·`인정됨`·`반려`(반려됨/반려됐어요) 금지.
- MoreMenu 내 이용계획 부제에 `작성` 리터럴 금지(열람 전용 화면 → 거짓 라벨).

---

## 계약 구조 (`src/test/p7CopyWave1.test.ts`)

소스 텍스트 골든(기존 `tokenFoundation.test.ts` 와 동일 패턴, `readFileSync`). 각 대상:
1. **새 문구 존재** 단언(문자열 리터럴/JSX 텍스트 노드).
2. **옛 한자어/AI/거짓 라벨 부재** 단언(forbidRules).
3. **불변식 가드**: B1 열람전용 정합(저장/제출 버튼 부재·docstring), B7 목적지 `/more` 보존,
   B11 uiPreferences easy 라벨 유지 — 회귀 방지.

현재 상태: **28 fail(RED) / 9 pass(불변식 가드)**. 옛 문구가 아직 소스에 있어 RED.
tsc `--noEmit` clean. 기존 스위트 무손상(전체 429 pass, 이 파일만 28 RED).

## Easy-Read 실측 결과

전 15개 후보 `validate_easy_read` **pass(warn 0)**. 초안 교정 이력:
- B1 초안 '계획을 보고 결과를 확인해요' → SEN-02(복문)+VOC-01('확인') → `계획과 결과를 봐요`.
- B2-pending 초안 '선생님이 보고 있어요' → '-고' SEN-02 오탐 → `선생님이 살펴봐요`.
- B9-submitted 초안 '계획이 다 됐어요' → SEN-03(피동 '됐') → 주어 명시 능동으로.
- B8 원문 대조(fact-preservation)까지 pass.

## 핸드오프

U(app-6c): 위 매핑표대로 각 `file`의 소스 문자열만 교체 → `npx vitest run
src/test/p7CopyWave1.test.ts` green + `npm run build`. src/test 는 건드리지 않는다.
