# 서울형 개인예산제 온톨로지 — 파일 안내

설계 근거와 결정 사항은 **`Plan&Source/서울형_온톨로지_설계_v1.md`** 를 읽어주세요.
이 폴더는 그 문서의 산출물입니다.

| 파일 | 내용 |
|---|---|
| `seoul_ontology.rdf` | **온톨로지 정본**(영문 라벨). 클래스 26 / 관계 46 / 속성 120 / 고아 노드 0 |
| `seoul_ontology_ko.rdf` | **한글 라벨판** — Playground 로 보기용. `to_korean_labels.py` 가 생성 |
| `to_korean_labels.py` | Playground 내보내기 파일의 라벨을 한글로 변환 |
| `seoul_schema_draft.sql` | SQL 스키마 **초안**. ⚠️ 그대로 실행하지 마세요 |
| `seoul_graph_overlay.sql` | 그래프 오버레이 — 외래키를 트리플로 투영해 경로 탐색을 가능하게 함 |
| `verify_00_stubs.sql` | 검증용 스텁 (`profiles`·`participants`·`auth.uid()` + RLS) |
| `verify_01_behaviour.sql` | 기능 테스트 13종 — 한도·금지항목·동의·배제규칙·기한 계산 |
| `verify_02_rls.sql` | 보안 테스트 15종 — 참여자가 할 수 있어야/없어야 하는 것 |
| `verify_03_graph.sql` | 그래프 테스트 5종 — 엣지 투영·경로 탐색·RDF 내보내기·RLS |
| `make_diagram.py` → `seoul_ontology_diagram.md` | **한글 관계도** (Mermaid). RDF 에서 생성 |
| `make_artifact.py` → `seoul_ontology_view.html` | **한글 관계도** (웹 페이지). RDF 에서 생성 |

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

### 파일이 두 벌인 이유

Playground 검증기에는 이름 규칙이 **세 가지**입니다.

| 규칙 | 한글이 걸리는 지점 |
|---|---|
| ASCII 문자·숫자로 **시작** | `참여자` → 실패 |
| ASCII 문자·숫자로 **끝** | `Participant (참여자)` → `)` 로 끝나 실패 |
| **26자 이내** | `registeredAddress (주민등록상 주소)` = 30자 → 실패 |

이 검증기는 한글을 letter 로 치지 않으므로 시작에도 끝에도 올 수 없습니다.
그래서 용도에 따라 두 벌을 둡니다.

| | `seoul_ontology.rdf` (정본) | `seoul_ontology_ko.rdf` |
|---|---|---|
| 라벨 | 영문 식별자 | **한글** |
| 한글 위치 | `rdfs:comment` (노드 클릭 시 DESCRIPTION) | 라벨과 주석 양쪽 |
| Playground 검증 | 통과 | **오류 표시됨** (그림은 정상) |
| 쓰임 | SQL·문서와 이름을 맞춤, Submit to Catalogue | 실무자와 함께 보기 |

**검증 오류는 표시일 뿐 그림 렌더링을 막지 않습니다.** 실무자와 관계를 함께 읽는 것이
목적이라면 한글판을 쓰시고, 이름을 코드와 대조해야 하면 정본을 쓰십시오.

한글판은 **Playground 에서 [Export RDF] 로 받은 파일**을 변환해 만듭니다.
아이콘·색·카디널리티 같은 Playground 자체 설정이 보존됩니다.

```bash
python3 to_korean_labels.py <내보낸파일.rdf> > seoul_ontology_ko.rdf
```

한글 이름은 `rdfs:comment` 앞부분에서 가져오므로, 이름을 바꾸려면 정본의 주석을 고칩니다.

### 도구 없이 보는 한글 그림

```bash
python3 make_diagram.py  > seoul_ontology_diagram.md   # Mermaid (GitHub 에서 렌더링)
python3 make_artifact.py > seoul_ontology_view.html    # 웹 페이지
```

정본 RDF 에서 생성되므로 어긋날 수 없습니다. RDF 를 고쳤으면 다시 생성하세요.

### 식별자(🔑) — 해결됨

각 엔티티에 `...Id` 속성을 두고 표준 OWL 의 `owl:hasKey` 로 선언했습니다.
**Playground 가 이를 읽어 자기 형식(`ont:isIdentifier`)으로 26개 전부 변환한 것을
내보내기 파일에서 확인했습니다.** 열쇠 아이콘을 일일이 누를 필요가 없습니다.

SQL 에서는 이미 모든 테이블이 `id UUID PRIMARY KEY` 이므로 새로 만든 개념이 아니라
그림에 드러낸 것입니다.

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
