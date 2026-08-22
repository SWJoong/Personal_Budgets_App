# GOAL축 A · 지도 자산 맵핑 — UX·계약 설계 (W)

> 대상 구현: `(supporter)/supporter/map`(현재 ComingSoon stub) · `(participant)/map`(지출장소 지도 live, 확장) ·
> `src/app/actions/serviceProvider.ts`(읽기 `getProviders` 신설) · `src/components/map/KakaoMap.tsx`(자산 마커 확장).
> 계약: `src/utils/assetMap.test.ts`(test-first 골든, §8-4 id 조인 잠금) → **U 초록화**.
> 축 연속성: 예산(영역/domain) → **자산 지도(어디서 쓸 수 있나)** → 지출(어디서 썼나)를 같은 domain_id 로 잇는다.

---

## 1. 자산 맵핑이란 (범위)

"자산 맵핑" = 당사자가 **예산을 쓸 수 있는 실제 장소(제공기관·지역자원)를 지도에** 올려, 돈과 장소를 잇는 것.
사회복지의 자원지도(자산기반) 개념을 개인예산에 적용한다.

**현재 상태(실측):**
- 당사자 `(participant)/map` = **live** — `seoul_service_usages`(provider_id 있는 것)를 provider 좌표로 조인해
  "내가 돈 쓴 장소"를 `KakaoMap` 에 표시.
- 지원자 `(supporter)/supporter/map` = **ComingSoon stub**.
- `serviceProvider.ts` 엔 `findOrCreateProvider`(쓰기)만 — **읽기(`getProviders`) 없음** → 제공기관을 지도에 못 뿌림.
- `KakaoMap` 은 `MapTransaction[]`(지출) 만 받음 — 자산(제공기관) 마커 미지원.

**이 설계가 더하는 것:** ① 제공기관 전체를 "쓸 수 있는 곳" 자산 레이어로 ② **영역(domain)별 필터**("문화·여가 예산 쓸 곳") ③ 지원자 지도 배선 + 지출 오버레이.

---

## 2. 데이터·모델 + 그레인 (핵심)

| 요소 | 출처 | 주의 |
|---|---|---|
| 제공기관 마커 | `seoul_service_providers`(name·category·**lat·lng**·address) | lat·lng 둘 다 있어야 지도에 찍힘. |
| 지출 장소(오버레이) | `seoul_service_usages.provider_id` → provider 좌표 | 이미 당사자 map 이 하는 방식. |
| **제공기관의 "영역"** | **지출 이력에서 파생**: `service_usages`(provider_id, domain_id) | ★providers 엔 domain FK 없음(설계상 유지). |

### ★ 왜 provider 에 domain_id 를 넣지 않나 (§8-5 정신)
- 한 장소는 **여러 영역**에 쓰일 수 있다(카페 = 문화·여가 + 일상). 단일 `provider.domain_id` FK 는 손실적.
- 그래서 영역 태그는 **그 장소에서 실제 일어난 지출의 domain_id 집합**으로 파생한다(emergent asset map).
  스키마 변경 불필요. 조인은 **domain_id(§8-4 id 기준, 라벨 금지)**. 우리가 만든 축과 일관.
- (후속 옵션) 지역자원(제공기관 아닌 공공자원)까지 얹으려면 별도 테이블 — 이번 스코프 밖(§9).

### RLS
`seoul_service_providers` 읽기는 이미 `authenticated` 전원 허용(04). `getProviders` 는 새 정책 불필요.
지출 오버레이는 `seoul_can_access` 로 본인·담당만(기존 usages RLS 그대로).

---

## 3. `getProviders` 읽기 계약 (U 구현)

```ts
// serviceProvider.ts 신설 (U-lane)
export interface ProviderRow {
  id: string; name: string; lat: number | null; lng: number | null; category: string | null
}
/** 좌표 유무 무관 전량 반환(필터는 화면/순수로직에서). RLS: 전원 읽기. */
export async function getProviders(): Promise<{ providers: ProviderRow[]; error?: string }>
```
- 영역 파생을 위해 지출을 함께 쓸 때는 서버컴포넌트에서 `service_usages`(provider_id, domain_id, amount)를
  `seoul_can_access` 스코프로 읽어 `buildProviderAssets` 에 전달(§4).

---

## 4. 순수 로직 계약 — `assetMap.ts` (test-first 골든, §8-4 잠금)

골든 `src/utils/assetMap.test.ts`(W 작성, RED→U green). `domainAxisReport`/`budgetByDomain` 의 형제.

```ts
// src/utils/assetMap.ts (U 구현 대상)
export interface ProviderRow { id: string; name: string; lat: number|null; lng: number|null; category: string|null }
export interface UsageRow { provider_id: string|null; domain_id: string|null; amount: number|null }
export interface AssetMarker {
  id: string; name: string; lat: number; lng: number; category: string|null
  domainIds: string[]   // 지출 이력 파생, 유니크·정렬(§8-4 id)
  usageCount: number     // 이 장소 지출 건수
  totalAmount: number    // 이 장소 지출 합
}
export function buildProviderAssets(providers: ProviderRow[], usages: UsageRow[]): AssetMarker[]
export function providersForDomain(markers: AssetMarker[], domainId: string): AssetMarker[]
```

### 골든이 못박는 불변식
1. **좌표 둘 다 있는 제공기관만** 마커(lat·lng 하나라도 null 이면 제외).
2. **영역 파생**: 태그는 그 장소 지출의 `domain_id` 집합(§8-4 id, 라벨 아님). null domain 은 태그 제외(건수엔 포함).
3. **미사용 제공기관도 남음**(자산 디렉터리) — usageCount 0·domainIds [].
4. null amount→0. 마커에 없는/미존재/null provider 의 지출은 무시.
5. `domainIds` 안정 정렬(UI 결정성). `providersForDomain` 은 domain_id 포함 여부로 필터.

---

## 5. `KakaoMap` 확장 (U 구현)

현재 `transactions: MapTransaction[]` 만. **자산 마커**를 추가로 받게 확장:
```ts
export interface MapPlace {
  id: string; name: string; lat: number; lng: number
  kind: 'asset' | 'spending'          // 자산(쓸 수 있는 곳) vs 지출(쓴 곳)
  category?: string | null; domainIds?: string[]; usageCount?: number; amount?: number
}
// KakaoMap props 에 places?: MapPlace[] 추가(기존 transactions 는 유지/점진 이관)
```
- 마커 구분: 자산=테두리/연한 색 + 카테고리 아이콘, 지출=채운 색. 클릭 시 이름·(자산)영역칩/(지출)금액·날짜.
- 성능: 마커 많으면 클러스터링(카카오 clusterer) — U 판단.

---

## 6. 정보구조(IA)

### 지원자 자산 지도 (`/supporter/map`, stub→구현)
```
[헤더] 지도
[필터바]  영역: (전체·일상·건강·문화…) │ 보기: 쓸 수 있는 곳 / 쓴 곳
[지도]   제공기관(자산) 마커 + (당사자 선택 시) 그 사람 지출 마커 오버레이
[목록]   마커 목록(이름·카테고리·영역칩·이용횟수) — 지도와 연동
```
- 담당자는 당사자를 골라 "이 사람이 쓸 수 있는/쓴 곳"을 지도+목록으로.

### 당사자 지도 (`/map`, live→확장)
```
[헤더 ←] 사용 장소 지도
[탭]  내가 쓴 곳(현행)  |  ＋ 쓸 수 있는 곳(신규)
[영역 고르기]  "무엇에 쓸지 먼저 골라요"  (문화·여가 / 이동 / 일상 …)
[지도]  고른 영역에서 쓸 수 있는 근처 장소(자산) — 큰 마커·이름
```
- "쓸 수 있는 곳" 탭 = `buildProviderAssets`→`providersForDomain`. 예산 영역 → 실제 장소 연결(자기주도 지출).

---

## 7. easy-read 카피 (당사자 — `validate_easy_read` **pass** 실측)
- 탭/질문: `어디서 쓸 수 있어요?` · 영역 고르기 안내: `무엇에 쓸지 먼저 골라요.`
- 자산 마커 팝업: `여기서 돈을 쓸 수 있어요.` · 근처 안내: `이 근처에서 쓸 수 있는 곳이에요.`
- (4문구 errors 0·warnings 0.) 지원자 화면은 "제공기관·자산" 등 표준어 사용 가능.

---

## 8. 당사자 노출범위
| 데이터 | 당사자 | 담당자 |
|---|---|---|
| 장소 이름·위치·카테고리 | ✅ 큰 마커·쉬운말 | ✅ |
| 영역칩(파생) | ✅ "무엇에 쓰는 곳" | ✅ |
| 내 지출 장소·금액 | ✅(본인) | ✅(담당) |
| 사업자번호(business_number)·행정 메타 | ❌ | ✅ |
| 남의 지출 | ❌(RLS) | ✅(담당 범위) |

---

## 9. 구현 노트 (U-lane) · 착수 순서
1. **`getProviders` 읽기 액션**(§3) — 최소 단위, 먼저.
2. **`assetMap.ts` 구현**(§4) → 골든 green.
3. **`KakaoMap` 확장**(§5, `places` 지원).
4. **`/supporter/map` 구현**(§6) — 필터바+지도+목록. ★**진입점 신설 필요**: 지원자 `TabBar`(당사자·확인필요·
   내역관리·더보기)에 지도 탭 없음 → 탭 추가 또는 당사자 상세/대시보드에서 링크(budgets 진입점과 함께 정리).
5. **`/map` 확장**(§6) — "쓸 수 있는 곳" 탭 + 영역 고르기(당사자 map 에 영역필터 추가).
6. 재사용: `geocode`(카카오)·`providers.lat/lng`·기존 `MapTransaction` 경로.

### 후속(이번 스코프 밖)
- 지역자원(제공기관 아닌 공공·커뮤니티 자원) 자산 레이어 = 별도 테이블 설계(필요성 확인 후 W).
- 마커 클러스터링·현위치 기반 "가까운 순" 정렬(geo 거리).
