# GOAL축 A · AI 공급자 교체 + 비용 최적화 — 설계 (W → U)

> 대상 구현(U-lane): `src/utils/ai.ts`(신설, `callOpenAI` 대체) · `src/app/actions/ocr.ts`(교체) ·
> `src/app/actions/easyReadSummary.ts`(신설) · `src/app/actions/activitySuggestion.ts`(신설) · `src/utils/openai.ts`(제거).
> 배경: **GPT-4o 토큰 중단** → 현재 `ocr.ts`(영수증 OCR) 런타임 실패 중. 공급자 = **Claude(Anthropic)** 확정(사용자).
> 목표 비용: **기관당 월 ₩10,000 이내**(현실 평균 기준) — 최적화 스택 필수(§4).

---

## 1. `callAI` 추상화 (공급자 단일화)

`@anthropic-ai/sdk` 로 **하나의 클라이언트**를 만들고 OCR·요약·활동제안이 공유한다. 공급자·모델 교체는 여기 한 곳.

```ts
// src/utils/ai.ts
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic() // ANTHROPIC_API_KEY (env)

export interface AIImage { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' }
export interface CallAIOptions {
  system?: string
  model?: string          // 기본 env AI_MODEL_DEFAULT
  maxTokens?: number      // 기본 1024
  image?: AIImage         // 비전(OCR)
  json?: boolean          // 구조화 출력 강제
  cacheSystem?: boolean   // 공통 지침 프롬프트 캐싱
}
export async function callAI(userText: string, opts?: CallAIOptions): Promise<string>
```
- 구현: `client.messages.create({ model, max_tokens, system, messages:[{role:'user', content:[ (image?){type:'image',source:{type:'base64',media_type,data}}, {type:'text',text:userText} ]}] })` → 첫 text 블록 반환.
- **JSON**: `output_config: { format: { type:'json_schema', schema } }`(권장) 또는 프롬프트로 JSON 강제 후 `JSON.parse`. `output_format` 구파라미터 쓰지 말 것.
- **모델 상수/env**(용도별 티어 교체를 코드수정 없이):
  - `AI_MODEL_OCR`(기본 `claude-haiku-4-5`) · `AI_MODEL_SUMMARY`(기본 `claude-sonnet-5`) · `AI_MODEL_SUGGEST`(기본 `claude-sonnet-5`).
  - 모델 ID 는 **날짜 접미사 없이** 정확히(`claude-sonnet-5`·`claude-haiku-4-5`). Sonnet 5 도입가(~2026-08-31) 이후 정상가.
- **에러**: 타입드 예외(`Anthropic.RateLimitError`/`APIError`) 분기 → 친절 메시지. AI 실패 시 DB 미변경(기존 easyReadSummary 원칙).
- `src/utils/openai.ts`·`ocr.ts` 의 OpenAI fetch 는 제거/치환.

---

## 2. 영수증 OCR (`ocr.ts` 교체)
- 비전: `callAI(prompt, { image, model: AI_MODEL_OCR, json:true, maxTokens: 400 })`.
- 출력 스키마: `{ store: string|null, amount: number|null, date: string|null }`(기존과 동일 필드).
- ★**이미지 다운스케일**(§4-1) 후 전송. 실시간(촬영 즉시 자동채움) → 배치 불가.

## 3. easyReadSummary (신설) — 쉬운말 자동 생성
- 입력: 이용계획(자기서술 5항목) + 요청서비스 + 예산 배정 요약(참여자·월).
- `callAI(sourceText, { system: EASY_READ_SYSTEM, model: AI_MODEL_SUMMARY, maxTokens: 700, cacheSystem:true })`.
- **EASY_READ_SYSTEM 프롬프트(쉬운 정보 규칙 내장 — W 저작)**: 아래 규칙을 반드시 포함.
  > "너는 발달장애 당사자를 위한 '쉬운 정보(Easy Read)' 작성자다. 규칙: ①한 문장 한 가지 내용, 짧게(어절 15↓)
  > ②쉬운 낱말(어려운 말·한자어·전문어 금지: '지출'→'쓴 돈', '잔액'→'남은 돈', '본인부담금'→'내가 낼 돈')
  > ③능동태, 피동('-되다') 지양 ④숫자는 '원' 붙여 또렷이, 큰 수는 쉽게 ⑤부정보다 긍정, 위협어 금지
  > ⑥원문의 금액·날짜·사실을 절대 바꾸지 말 것. 존댓말('~요')."
- ★검증: 생성 프롬프트·샘플 출력은 **개발 시 easyread MCP(`validate_easy_read`)로 W 가 감수**(런타임 아님, §설계노트).
  민감 내용이라 초기엔 Sonnet 5 권장.
- 저장: 결과를 참여자·기간 키로 저장(권한: 담당/관리자). 저장 테이블은 U 판단(경량 `seoul_easy_read_summaries` 또는 monitoring row 확장) — W 계약 필요 시 요청.
- 비실시간 → **Batch API(−50%)** + system 프롬프트 **캐싱**.

## 4. AI 활동 제안 (신설) — activitySuggestion
- 입력: 참여자의 지원영역(domain)·남은 예산(영역별)·관심/이력 + 근처 제공기관(자산지도 §연계).
- `callAI(context, { system: SUGGEST_SYSTEM, model: AI_MODEL_SUGGEST, maxTokens: 500, json:true, cacheSystem:true })`.
- 출력: `{ suggestions: [{ title, domain_id, why, est_cost? }] }` (1~3개). **쉬운말**(easyRead 규칙 공유).
- 비실시간 → Batch + 캐싱. 자산지도의 `providersForDomain` 과 연계 가능(어디서 할 수 있는지).

---

## 5. 비용 최적화 스택 (기관당 월 ₩10,000 이내 — 현실 평균)
1. ★**OCR 이미지 다운스케일** — OCR 비용 대부분이 이미지 토큰. 전송 전 **긴 변 ~800px·JPEG 품질↓**(글자 판독엔 충분). 입력 토큰 ~절반. (클라이언트 canvas 또는 서버 sharp.)
2. **모델 티어**: OCR=**Haiku 4.5**(물량) / 요약·제안=**Sonnet 5**(품질). env 로 조정.
3. **Batch API −50%**: 요약·활동제안은 야간 배치(`client.messages.batches`). OCR 은 실시간 제외.
4. **프롬프트 캐싱**: 요약·제안의 공통 EASY_READ/SUGGEST system 접두를 `cache_control:{type:'ephemeral'}`(반복분 ~90%↓). OCR 은 이미지가 매번 달라 효과 작음.
5. **출력 상한**: OCR 400·요약 700·제안 500 토큰(과생성 방지).
- 실측 기준(현실 평균, Haiku OCR+다운스케일, 요약 주간, 배치): **20명 기관 ≈ ₩6,700~9,300/월**. 상한(peak) 지속 시 초과 → 평균 전제.

---

## 6. 환경변수·마이그레이션
- `ANTHROPIC_API_KEY`(신규, 서버 전용) 추가. `OPENAI_API_KEY` 제거(문서·CLAUDE.md 환경변수표 갱신 = 공유 CLAUDE.md 구조변경이라 U).
- 착수 순서: ①`ai.ts`(`callAI`) → ②`ocr.ts` 교체(+다운스케일) → ③easyReadSummary → ④activitySuggestion → ⑤Batch·캐싱 적용 → ⑥openai.ts 제거.
- 검증: OCR 은 실 영수증 1건으로 정확도 확인(Haiku vs Sonnet). 요약·제안 샘플은 W 가 easyread MCP 로 감수.

## 설계 노트 (easyread MCP 위치)
easyread MCP 는 **개발·감수 도구**(에이전트/CI)이지 배포 앱 런타임이 부르는 API 가 아니다. 런타임 쉬운말 보장은
**규칙 내장 프롬프트 + (선택) 2차 검토 패스**로 한다. 런타임/CI 자동 검증이 필요하면 easyread 규칙셋을 앱 내
경량 검증기로 포팅(후속 W 설계).
