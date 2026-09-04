# 자산지도 "쓸 수 있는 곳" — 전역 제공기관→영역 발견 계약 (W → U)

> 대상 구현(U-lane): `supabase/seoul/`(신규 `SECURITY DEFINER` 함수 `seoul_provider_domains()`) ·
> `src/utils/assetMap.ts`(`buildDiscoveryAssets` 추가 + `providersForDomain` 제네릭화) ·
> `(participant)/map` "쓸 수 있는 곳" 탭 · `.github/workflows/db-verify.yml`(verify 배열에 1줄 추가).
> 계약: `src/utils/assetMapDiscovery.test.ts`(TS 골든, test-first RED) +
> `Plan&Source/ontology/seoul/verify_provider_domains.sql`(SQL 계약, U 가 배열 배선 시 발동).

---

## 1. 문제 — 본인 지출만으로는 자산지도가 sparse 하다

`buildProviderAssets`(#46, 이미 배포)는 **당사자 본인의 지출 이력**에서 제공기관 마커를 만든다 —
"**내가 쓴 곳**". 좋다. 그러나 자산지도의 진짜 값어치는 "**쓸 수 있는 곳**"(discovery)이다:
*아직 안 가봤지만 다른 사람들이 이 예산으로 실제로 이용한 장소*. 본인 지출로만 파생하면 이제 막
시작한 당사자에게는 마커가 한두 개뿐이라 지도가 비어 보인다.

→ 필요한 것은 **전역 소스**: 전체 참여자의 지출 이력을 제공기관×영역으로 집계해 "이 장소는
[사회생활]에 쓸 수 있어요(커뮤니티가 실제로 그렇게 씀)"를 보여준다.

---

## 2. ★ 왜 뷰가 아니라 `SECURITY DEFINER` 함수인가 (핵심 설계 결정 — 이전 메모 정정)

이전 핸드오프에서 `v_seoul_provider_domains` **뷰**로 적었으나 **함수로 바꾼다**. 이유는 이 프로젝트의
가장 강한 보안 컨벤션 때문이다:

- `supabase/seoul/05_seoul_graph.sql` §5 와 모든 seoul 뷰는 **반드시 `WITH (security_invoker = true)`**
  를 가진다. "뷰는 기본값이 소유자 권한 실행이라 이 옵션이 없으면 하위 테이블 RLS 가 통째로
  우회된다 — 실제로 이 초안에서 발견된 결함"이라고 §5 가 명시한다.
- 그런데 이 기능은 **의도적으로 RLS 를 넘어** 전 참여자 지출을 집계해야 한다(§1). 즉:
  - `security_invoker=true` 뷰 → RLS 적용 → 당사자는 **본인 것만** → 다시 sparse. 기능이 성립 안 함.
  - `security_invoker=false`(평범한) 뷰 → RLS 우회는 되지만 **§5 가 경고한 바로 그 안티패턴**.
    grep 으로 안 드러나고 리뷰에서 놓치기 쉬운 "조용한 우회". W 리뷰에서 **거부 대상**이다.

→ 올바른 답은 **명시적 `SECURITY DEFINER` 함수**다. 코드베이스가 이미 감사기록 트리거
(`seoul_flag_criteria`)에서 쓰는, **의도적·검증가능한 RLS 우회**의 정본 관용구다. 안전성은
함수의 **RETURNS 컬럼만 보면 증명**된다(신원·금액 컬럼이 없음). Supabase RPC 로 그대로 호출된다
(`supabase.rpc('seoul_provider_domains')`).

---

## 3. 함수 계약 — `seoul_provider_domains()` (U 구현, verify 로 못박음)

```sql
CREATE OR REPLACE FUNCTION public.seoul_provider_domains()
RETURNS TABLE (
  provider_id    UUID,
  provider_name  TEXT,
  category       TEXT,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  domain_id      UUID,
  domain_code    TEXT,
  domain_label   TEXT,
  program        TEXT,
  usage_count    BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER                       -- ★ 의도적 전역 집계: 발견을 위해 RLS 를 넘되, 신원은 반환하지 않는다
SET search_path = public, pg_temp     -- ★ definer 함수는 search_path 고정 필수(권한상승 방지)
AS $$
  SELECT
    p.id, p.name, p.category, p.lat, p.lng,
    d.id, d.code, d.label, d.program,
    count(*) AS usage_count
  FROM public.seoul_service_usages u
  JOIN public.seoul_service_providers p ON p.id = u.provider_id   -- INNER: 장소 없는 지출 제외
  JOIN public.seoul_service_domains   d ON d.id = u.domain_id     -- INNER: 영역 없는 지출 제외
  GROUP BY p.id, p.name, p.category, p.lat, p.lng, d.id, d.code, d.label, d.program;
$$;

REVOKE ALL ON FUNCTION public.seoul_provider_domains() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seoul_provider_domains() TO authenticated;
-- ★ Supabase 기본권한(ALTER DEFAULT PRIVILEGES)은 새 함수마다 anon 에게 EXECUTE 를 '직접' 부여한다.
--   REVOKE FROM PUBLIC 은 그 직접 부여를 지우지 못하므로 anon 을 별도로 회수해야 authenticated 전용이 된다(멱등).
REVOKE EXECUTE ON FUNCTION public.seoul_provider_domains() FROM anon;
```

**계약이 못박는 불변식**(`verify_provider_domains.sql`):
1. 함수가 존재하고 **`prosecdef = true`**(SECURITY DEFINER)이며 **search_path 고정**.
2. **EXECUTE 는 `authenticated` 에게만**(PUBLIC 회수 + **anon 회수** — Supabase 기본권한이 anon 에 직접
   부여하므로 `REVOKE ... FROM anon` 을 별도로 해야 익명 실행이 막힌다. plain-PG 엔 anon 롤이 없어 이
   판정은 Supabase 에서만 실효하되 verify 에 회귀잠금으로 못박는다).
3. ★ **반환 계약에 PII 컬럼이 없다** — `participant_id`·`amount`·`usage_date`·`created_by`·
   `description` 그 어느 것도 RETURNS 에 없다. **집계 수치만**. (안전성의 핵심 증명.)
4. **전역 집계**: 같은 장소·같은 영역을 **서로 다른 두 참여자**가 이용하면 `usage_count` 에 **합산**된다.
5. ★ **참여자 권한으로 호출해도 전역이 보인다** — `SET ROLE`+`request.jwt.claim.sub` 로 참여자를
   흉내내 호출해도 남의 이용까지 합산된 값이 나온다(SECURITY DEFINER 확인). 이는 `v_seoul_graph_edges`
   (security_invoker)가 교차참여자를 **차단**하는 것과 **의도적으로 대비**된다.
6. **음성**: provider 가 NULL 이거나 domain 이 NULL 인 지출은 링크 행을 만들지 않는다(INNER JOIN).
   아무도 안 쓴 제공기관은 결과에 없다(링크가 없음 — 미사용 장소 디렉터리는 §5 참조).

**grain**: 한 행 = 한 (제공기관, 영역) 쌍. `v_seoul_domain_flow`(participant×domain)와 같은 결이되
**참여자 축을 제거**해 전역·신원제거 집계로 만든 것.

---

## 4. TS 소비 계약 — `buildDiscoveryAssets` (골든 `assetMapDiscovery.test.ts`, RED)

함수 결과(제공기관×영역 행)를 지도 마커(제공기관 단위, `domainIds[]`)로 접는 순수 로직.

```ts
/** seoul_provider_domains() RPC 한 행. PII 없음(신원·금액·날짜 없음). */
export interface ProviderDomainRow {
  provider_id: string
  provider_name: string
  category: string | null
  lat: number | null
  lng: number | null
  domain_id: string
  domain_code: string
  domain_label: string
  program: string
  usage_count: number
}

/** 발견(쓸 수 있는 곳) 마커 — 금액 없음(전역·신원제거 소스라 본인 금액이라는 개념이 없다). */
export interface DiscoveryMarker {
  id: string
  name: string
  lat: number
  lng: number
  category: string | null
  domainIds: string[]  // §8-4 id 기준, 유니크·정렬
  usageCount: number   // 이 장소의 전 영역 이용 합(전역)
}

export function buildDiscoveryAssets(rows: ProviderDomainRow[]): DiscoveryMarker[]

// ★ providersForDomain 을 제네릭화 — 발견 마커에도 재사용(§8-4 id 필터). 기존 AssetMarker 도 만족(후방호환).
export function providersForDomain<T extends { domainIds: string[] }>(markers: T[], domainId: string): T[]
```

**골든 불변식**:
1. 한 제공기관의 여러 (provider,domain) 행 → **한 마커로 접힘**. `domainIds` = 그 영역 id 집합(유니크·정렬),
   `usageCount` = 그 제공기관의 `usage_count` **합**(카페 사회5+일상2 = 7).
2. 좌표(lat·lng) **둘 다 있어야** 마커(하나라도 null → 지도에 못 찍음, 제외).
3. `domainIds` 는 라벨 아니라 **domain_id**(§8-4, program 스코프 라벨 충돌 방지).
4. `providersForDomain(markers, id)` 는 발견 마커에도 동작(제네릭).
5. 결정적 정렬(마커 id, domainIds). 6. 빈 입력 → 빈 배열.

**두 소스는 지도에서 이렇게 만난다**(§1):
- **내가 쓴 곳** = `buildProviderAssets`(본인 usages, RLS 스코프, 금액 있음) — 기존 #46.
- **쓸 수 있는 곳** = `buildDiscoveryAssets`(전역 RPC, 금액 없음) — 이 계약.
- 탭/토글로 겹쳐 본다. 같은 `domain_id` 로 예산 영역 필터와 이어진다(예산→자산→지출 한 축).

---

## 5. 범위 밖(의도적으로 안 하는 것)

- **미사용 제공기관 디렉터리**(좌표는 있는데 아무도 안 쓴 곳)는 이 함수가 안 낸다 — 링크(영역)가
  없기 때문. 필요하면 별도의 평범한 `seoul_service_providers` 조회(security_invoker 경로)로
  나열하면 된다. 이 계약은 **영역 링크가 있는** 발견 소스에 집중한다.
- **금액·건별 상세·누가 썼는지**는 전역 소스에 절대 넣지 않는다(§3-3). 본인 금액은 "내가 쓴 곳"
  (RLS 경로)에서만.

### ★ 프라이버시 잔여위험 (정직하게)
이 기능은 본질적으로 "**≥1 명의 참여자가 장소 X 를 영역 D 로 이용했다**"를 전 사용자에게 공개한다 —
그게 발견의 정의다. 신원·금액·날짜는 노출하지 않는다. 남는 것은 **소셀(small-cell)**: 어떤
(장소,영역)을 딱 한 명만 이용했다면 `usage_count = 1` 이 그 사실을 드러낸다. 그러나 (a) 누구인지는
안 나오고 (b) 지도의 목적이 커뮤니티 공용 장소(카페·체육관 등) 발견이라 실무상 위험이 낮다.
- 완화 옵션(기본 꺼짐): 함수에 `HAVING count(*) >= :floor` 를 두면 소셀을 억제할 수 있으나,
  실제 장소를 가려 발견을 다시 sparse 하게 만든다. 기관 정책으로 켤 수 있게 남겨두되 기본은
  **끔**(신원 미노출이므로 발견 유용성 우선). 이 판단은 사용자·기관 확인 사항으로 남긴다.

---

## 6. 착수 순서 (U-lane)
1. `seoul_provider_domains()` 함수 구현(§3) — `supabase/seoul/` 빌드 SQL 에 추가(05 부근 또는 신규
   `11_*`; db-verify build 배열에 신규 파일이면 함께 추가). REVOKE PUBLIC + GRANT authenticated.
2. `src/utils/assetMap.ts` — `buildDiscoveryAssets` + `providersForDomain` 제네릭화(§4) → 골든 green.
3. `.github/workflows/db-verify.yml` verify 배열에 `verify_provider_domains` 1줄 추가 → SQL 계약 발동.
4. `(participant)/map` "쓸 수 있는 곳" 탭 — `supabase.rpc('seoul_provider_domains')` → `buildDiscoveryAssets`
   → 마커. "내가 쓴 곳"과 탭/토글. 영역 필터는 `providersForDomain(markers, domainId)`.
   (지도 목업: 아티팩트 "자산 지도" — 탭 구조·색 그대로.)
- 재사용: 기존 `buildProviderAssets`·`providersForDomain`(제네릭화 후 공용). 카카오 SDK 는 기존 지도 화면 그대로.
