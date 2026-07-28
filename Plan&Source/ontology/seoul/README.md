# 서울형 개인예산제 온톨로지 — 파일 안내

설계 근거와 결정 사항은 **`Plan&Source/서울형_온톨로지_설계_v1.md`** 를 읽어주세요.
이 폴더는 그 문서의 산출물입니다.

| 파일 | 내용 |
|---|---|
| `seoul_ontology.rdf` | 온톨로지 정본. 클래스 26 / 관계 46 / 속성 120 / 고아 노드 0 |
| `seoul_schema_draft.sql` | SQL 스키마 **초안**. ⚠️ 그대로 실행하지 마세요 |
| `seoul_graph_overlay.sql` | 그래프 오버레이 — 외래키를 트리플로 투영해 경로 탐색을 가능하게 함 |
| `verify_00_stubs.sql` | 검증용 스텁 (`profiles`·`participants`·`auth.uid()` + RLS) |
| `verify_01_behaviour.sql` | 기능 테스트 13종 — 한도·금지항목·동의·배제규칙·기한 계산 |
| `verify_02_rls.sql` | 보안 테스트 15종 — 참여자가 할 수 있어야/없어야 하는 것 |
| `verify_03_graph.sql` | 그래프 테스트 5종 — 엣지 투영·경로 탐색·RDF 내보내기·RLS |

> **적용 순서**: `verify_00_stubs` → `seoul_schema_draft` → `seoul_graph_overlay` → 검증 스크립트
> **요구 버전**: PostgreSQL **15 이상** (뷰의 `security_invoker` 옵션이 필요)

---

## 그림으로 보기

[Ontology Playground](https://microsoft.github.io/Ontology-Playground/#/designer) 에서
`seoul_ontology.rdf` 내용을 **[Edit RDF]** 에 붙여넣으면 노드-엣지 다이어그램이 나옵니다.

읽는 법:
- **Entity Types** = 동그라미 (무엇이 있는가)
- **Object Properties** = 화살표 (어떻게 연결되는가)
- **Data Properties** = 속성 (무엇을 기록하는가)

참여자에서 나가는 화살표 8개(신청·동의·계획수립·이용·이의신청 등)가
방사형으로 보이면 제대로 로드된 것입니다.

### 라벨이 `English (한국어)` 인 이유

Playground 검증기는 이름이 **ASCII 문자·숫자로 시작**할 것을 요구합니다.
한글 이름만 쓰면 `must start with a letter or digit` 오류가 납니다.
그렇다고 영어만 남기면 실무자가 화살표를 못 읽으므로 둘을 한 라벨에 넣었습니다.

엣지 라벨이 길어 그림이 복잡하면 한쪽만 남길 수 있습니다.

```bash
# 영어만 남기기 (개발자용)
sed -E 's|(<rdfs:label>[^<(]*) \([^<]*\)</rdfs:label>|\1</rdfs:label>|g' \
    seoul_ontology.rdf > seoul_ontology_en.rdf

# 한글만 남기기 (실무자용 — 단 Playground 검증은 통과하지 못함)
sed -E 's|<rdfs:label>[^<(]*\(([^<]*)\)</rdfs:label>|<rdfs:label>\1</rdfs:label>|g' \
    seoul_ontology.rdf > seoul_ontology_ko.rdf
```

### 식별자(🔑) 지정

각 엔티티에 `...Id` 속성이 하나씩 있습니다. 로드 후 엔티티를 선택해
그 속성의 열쇠 아이콘을 누르면 `has no identifier property` 오류가 사라집니다.
SQL 에서는 이미 모든 테이블이 `id UUID PRIMARY KEY` 이므로 새로 만든 개념이 아니라
그림에 드러낸 것입니다.

> Playground 가 식별자 지정을 RDF 에 어떻게 기록하는지는 표준 OWL 밖의 규약이라
> 파일만으로는 미리 넣을 수 없습니다. 한 엔티티에 지정한 뒤 **[Export RDF]** 로 받아
> 공유해 주시면 나머지 25개도 파일에 미리 반영해 드리겠습니다.

---

## 검증 재현하기

SQL 초안은 실제 PostgreSQL 16 에서 실행·테스트했습니다. 재현 절차입니다.

```bash
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
PGDIR=/var/lib/postgresql/tmpcluster

# 1. 임시 클러스터 기동
mkdir -p "$PGDIR" && chown postgres:postgres "$PGDIR"
su postgres -c "$PGBIN/initdb -D $PGDIR -U postgres --auth=trust"
su postgres -c "$PGBIN/pg_ctl -D $PGDIR -o '-k /tmp -p 55432 -c listen_addresses=\"\"' -l /tmp/pg.log start"

# 2. 데이터베이스 생성 후 순서대로 실행
su postgres -c "$PGBIN/psql -h /tmp -p 55432 -U postgres -c 'CREATE DATABASE t'"
P="su postgres -c \"$PGBIN/psql -h /tmp -p 55432 -U postgres -d t -q\""
eval "$P -v ON_ERROR_STOP=1 -f verify_00_stubs.sql"
eval "$P -v ON_ERROR_STOP=1 -f seoul_schema_draft.sql"
eval "$P -f verify_01_behaviour.sql"    # 기능 13종
eval "$P -f verify_02_rls.sql"          # 보안 15종

# 3. 정리
su postgres -c "$PGBIN/pg_ctl -D $PGDIR stop"
```

`verify_01` 은 차단되어야 할 동작에서 **의도적으로 ERROR 를 냅니다.**
에러가 안 나면 그게 문제입니다. 각 테스트 앞의 `── Tn.` 주석에 기대 동작이 적혀 있습니다.

`verify_02` 는 결과에 `✅ 방어됨` / `❌ 뚫림` 을 직접 출력합니다.
`❌` 가 하나라도 나오면 RLS 정책이 깨진 것입니다.

### 마지막 실행 결과 (2026-07-28, PostgreSQL 16.13)

```
✅ 스키마 실행 · ✅ 그래프 오버레이 실행
기능 T1~T13  : 13종, 의도된 차단 7건
보안 S1~S15  : ✅ 11 / ❌ 0
그래프 G1~G5 : ✅ 3 / ❌ 0, 예기치 못한 오류 0건
객체         : 테이블 26 / 뷰 12 / RLS미적용 0 / security_invoker 미적용 뷰 없음
```

`✅` 개수는 표식을 출력하는 항목 수입니다. S1~S4(참여자가 **할 수 있어야** 하는 것)와
G1~G4(엣지·경로·트리플)는 표식 대신 결과표를 출력하므로 눈으로 확인하세요 —
이의신청이 접수되고 지출이 기록되면 통과입니다.

---

## 온톨로지만 따로 검사하기

```bash
python3 - <<'PY'
import xml.etree.ElementTree as ET
RDF='{http://www.w3.org/1999/02/22-rdf-syntax-ns#}'
RDFS='{http://www.w3.org/2000/01/rdf-schema#}'
OWL='{http://www.w3.org/2002/07/owl#}'
root=ET.parse('seoul_ontology.rdf').getroot()
f=lambda u:u.split('#')[-1] if u else None
cls=set(); touched=set(); n_obj=n_data=0
for el in root:
    if el.tag==OWL+'Class': cls.add(f(el.get(RDF+'about')))
    elif el.tag==OWL+'ObjectProperty':
        n_obj+=1
        for tag in (RDFS+'domain', RDFS+'range'):
            e=el.find(tag)
            if e is not None: touched.add(f(e.get(RDF+'resource')))
    elif el.tag==OWL+'DatatypeProperty': n_data+=1
print(f"클래스 {len(cls)} / 관계 {n_obj} / 속성 {n_data}")
orphans=sorted(cls-touched)
print("고아 노드:", orphans if orphans else "없음")
PY
```

고아 노드 검사가 있는 이유: 3차 작업에서 화살표 없는 노드 5개가
Playground 에 로드한 뒤에야 발견되었습니다. 사람이 그림을 보기 전에 잡기 위한 검사입니다.
