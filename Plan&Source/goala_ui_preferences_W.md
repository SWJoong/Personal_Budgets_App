# GOAL축 A · 화면 개인화 (ui_preferences) — UX·계약 설계 (W)

> 대상 구현: `src/utils/uiPreferences.ts`(타입·상수·`sanitize`, 신설) · `src/app/actions/preferences.ts`(신설) ·
> `(participant)/settings/display`(설정 화면) · 당사자 홈(`enabled_blocks` 조건부 렌더) · 담당자 `participants/[id]`(대리 설정).
> 계약: `src/utils/uiPreferences.test.ts`(순수 골든) + `Plan&Source/ontology/seoul/verify_ui_preferences_rls.sql`(RLS 보안) → **U 초록화/배선**.
> ★DB·RLS 는 **이미 준비됨** — 이식 비용 최저. 액션·정규화·설정 UI 만 추가한다.

---

## 1. 목적·범위

당사자마다 인지·필요가 달라 **홈에 보이는 것**과 **잔액 보는 방식**이 달라야 한다. 화면 개인화는
`participants.ui_preferences`(JSONB)에 **어떤 블록을 켤지 + 잔액 위젯 기본 스타일**을 저장해,
당사자 본인이(또는 담당자가 대신) 홈을 자기에게 맞게 고른다. Easy Read 원칙("필요한 것만") 직결.

**이미 있는 것(실측):** `participants.ui_preferences JSONB`(01_core) + 본인 편집 RLS(02_core_rls:
`protect_participant_fields` 트리거가 **본인 UPDATE 는 ui_preferences 만 통과**, 나머지 행정필드 되돌림).
**없는 것:** 정규화 로직·서버 액션·설정 UI(레거시 `preferences.ts`·`ui-preferences.ts` 는 리빌드에서 소멸).

---

## 2. 데이터·보안

- 저장 위치: **`participants.ui_preferences`**(profiles 아님).
- 쓰기 경로:
  - **당사자 본인**: `UPDATE participants SET ui_preferences=… WHERE id=self` → RLS `participants_update`
    (USING `seoul_can_access`) 통과, 트리거가 ui_preferences 외 필드 되돌림 = **화면 설정만** 가능.
  - **담당/관리자**: 전 필드 편집 가능(트리거 미적용).
  - **비담당·비본인**: `seoul_can_access` FALSE → UPDATE 차단.
- ★`ui_preferences` 는 **신뢰할 수 없는 클라이언트 JSON** → 저장·읽기 모두 `sanitizeUIPreferences`(§4)로
  정규화(알 수 없는 블록·조작 값 제거). 클라이언트가 보낸 원본을 그대로 믿지 않는다.

---

## 3. 블록·스타일 정의 (서울형 홈 기준)

레거시 블록을 그대로 쓰지 않고 **현재 서울형 당사자 홈·라우트에 있는 것만** 정의한다.

- **REQUIRED(항상 표시, 토글 불가)**: `balance_widget`(잔액 위젯) · `record_button`(내가 쓴 돈 적기 FAB) ·
  `copay`(본인부담금 — 해당 차수일 때만, 재정 의무라 숨김 금지).
- **OPTIONAL(당사자/담당 토글) — 정본 순서**:
  | BlockId | 아이콘 | 라벨(easy-read) | 설명 | 연결 |
  |---|---|---|---|---|
  | `domain_breakdown` | 🧭 | 어디에 썼는지 | 영역별 남은 돈 | 홈 §영역별 |
  | `recent_usages` | 🕐 | 최근에 쓴 돈 | 최근 쓴 목록 | 홈 |
  | `calendar_shortcut` | 📅 | 달력 | 이번 달 활동 | /calendar |
  | `plan_shortcut` | 🤔 | 나의 계획 | 내 이용계획 | /my-plan |
  | `map_shortcut` | 🗺️ | 지도 | 쓸 수 있는·쓴 곳 | /map |
  | `gallery` | 🖼️ | 활동 사진 | 사진 모아보기 | /gallery |
- **스타일 필드**: `balance_widget_style: 'pie'|'water'|'cash'|'emoji'|'text'`(기본 `pie`) · `balance_emoji`(기본 `🍎`).
  → 잔액 위젯 복원(피자/물컵/현금/이모지/숫자)과 **한 저장소로 연결**. 레거시 `'pouch'` 는 `'pie'` 로 이관.

---

## 4. 순수 정규화 계약 — `sanitizeUIPreferences` (골든)

`src/utils/uiPreferences.ts`(U 구현), 골든 `uiPreferences.test.ts`(W, RED→green).

```ts
export type BlockId = 'domain_breakdown'|'recent_usages'|'calendar_shortcut'|'plan_shortcut'|'map_shortcut'|'gallery'
export type BalanceWidgetStyle = 'pie'|'water'|'cash'|'emoji'|'text'
export interface UIPreferences {
  enabled_blocks: BlockId[]
  balance_widget_style: BalanceWidgetStyle
  balance_emoji?: string
}
export const OPTIONAL_BLOCKS: BlockId[]         // 정본 순서(위 표)
export const REQUIRED_BLOCKS: readonly string[] // ['balance_widget','record_button','copay']
export const BLOCK_METADATA: Record<BlockId, {icon:string; label:string; description:string}>
export const DEFAULT_PREFERENCES: UIPreferences // 자기 정규화 불변
export function sanitizeUIPreferences(raw: unknown): UIPreferences
```
**골든 불변식**: null/garbage→기본값 · 알 수 없는·필수 블록 제거 · 중복 제거 · **정본 순서 정규화** ·
스타일 유효성(+`pouch→pie`) · **멱등**(sanitize∘sanitize=sanitize) · DEFAULT 자기 정규화 불변.

---

## 5. 서버 액션 계약 (U 구현) — `preferences.ts`

```ts
export async function getUIPreferences(participantId: string): Promise<UIPreferences> // 읽고 sanitize
export async function saveUIPreferences(participantId: string, raw: unknown): Promise<{success?:true; error?:string}>
```
- `saveUIPreferences`: 본인 or 담당(친절 사전확인) → `sanitizeUIPreferences(raw)` → `UPDATE participants.ui_preferences`
  (RLS·트리거가 최종 방어). `revalidatePath('/')`.
- 홈 서버컴포넌트: `getUIPreferences` 로 `enabled_blocks`·`balance_widget_style` 읽어 **조건부 렌더**.

---

## 6. RLS 보안 계약 — `verify_ui_preferences_rls.sql` (W 작성, U 가 CI 배선)

"당사자 본인 UPDATE 는 **ui_preferences 만** 반영, 이름 등 행정필드는 되돌림 / 비담당 차단 / 담당 전필드"를
못박는다(트리거·정책 존재라 **지금 green = 회귀 잠금**). role `alice`+`jwt.claim.sub` 로 사용자 흉내.
→ **U**: `.github/workflows/db-verify.yml` 의 verify 목록에 `verify_ui_preferences_rls` 추가.

---

## 7. 설정 화면 (IA·easy-read)

- 위치: 당사자 **`(participant)/settings/display`** (헤더 ⚙ "더보기"→화면 설정). 담당자는 `participants/[id]` 에서 대리.
- 구성:
  ```
  [헤더 ←] 화면 설정
  ── 남은 돈을 어떻게 볼까요?   → 잔액 위젯 스타일 선택기(🍕🥤💵✨🔢) — 미리보기와 연동
  ── 무엇을 볼지 골라요.        → OPTIONAL 블록 토글 목록(아이콘·라벨·설명, 큰 스위치 44px)
       각 항목: [이 칸을 보여줄까요?]  켜기/끄기
  (변경 즉시 저장: "바꾸면 바로 저장해요.")
  ```
- 카피(당사자 노출, `validate_easy_read` **pass** 실측): `무엇을 볼지 골라요.` · `이 칸을 보여줄까요?` ·
  `남은 돈을 어떻게 볼까요?` · `바꾸면 바로 저장해요.`
- REQUIRED 블록(잔액·영수증·부담금)은 목록에 **끄기 불가**로 표시하거나 아예 노출하지 않음(혼란 방지).

---

## 8. 당사자 노출·self-service
- 당사자 **본인이 직접** 화면 설정 가능(RLS 가 이미 허용). 담당자도 대리 설정(미리보기 겸).
- 화면 설정은 개인 취향 → 담당자에게 굳이 감출 것 없음. 단 REQUIRED(재정·핵심)은 끌 수 없음.

---

## 9. 구현 노트·착수 순서 (U-lane)
1. `src/utils/uiPreferences.ts`(타입·상수·`sanitizeUIPreferences`) → 골든 green.
2. `preferences.ts`(`get`/`save`) — participants.ui_preferences.
3. 당사자 홈: `getUIPreferences` 로 `enabled_blocks` 조건부 렌더 + `balance_widget_style` 를 잔액 위젯 기본값으로.
4. `(participant)/settings/display` 설정 화면(+ ⚙ 헤더 진입점) · 담당자 대리 설정.
5. `db-verify.yml` 에 `verify_ui_preferences_rls` 추가(§6).
- 잔액 위젯 복원(#별도)과 **스타일 저장을 공유** — 위젯 스타일 선택 = 이 pref 에 기록.
