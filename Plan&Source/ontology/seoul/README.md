# 서울형 개인예산제 온톨로지 — 파일 안내

설계 근거와 결정 사항은 **`Plan&Source/서울형_온톨로지_설계_v1.md`** 를 읽어주세요.
이 폴더는 그 문서의 산출물입니다.

| 파일 | 내용 |
|---|---|
| `seoul_ontology.rdf` | 온톨로지 정본. 클래스 26 / 관계 46 / 속성 94 / 고아 노드 0 |
| `seoul_schema_draft.sql` | SQL 스키마 **초안**. ⚠️ 그대로 실행하지 마세요 |
| `verify_00_stubs.sql` | 검증용 스텁 (`profiles`·`participants`·`auth.uid()`) |
| `verify_01_behaviour.sql` | 기능 테스트 13종 — 한도·금지항목·동의·배제규칙·기한 계산 |
| `verify_02_rls.sql` | 보안 테스트 15종 — 참여자가 할 수 있어야/없어야 하는 것 |

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
✅ 스키마 — 에러 0
기능 테스트 : 13종 실행, 의도된 차단 7건
보안 테스트 : ✅ 11건 / ❌ 0건
객체       : 테이블 26 / 뷰 7 / 정책 74 / RLS미적용 0
```

`보안 테스트 ✅ 11건`은 `❌/✅` 표식을 출력하는 항목 수입니다.
S1~S4(참여자가 **할 수 있어야** 하는 것)는 표식 대신 건수를 출력하므로 눈으로 확인하세요 —
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
