#!/usr/bin/env python3
"""Ontology Playground 내보내기 파일의 rdfs:label 을 한글로 바꾼다.

한글 이름은 rdfs:comment 앞부분에서 가져온다 ("참여자 — 설명..." → "참여자").
Playground 가 붙인 ont:icon / ont:color / ont:cardinality / ont:propertyType 과
fromEntityId / toEntityId 는 그대로 보존한다 — 지우면 다시 올릴 때 아이콘·색·
카디널리티가 초기화된다.

⚠️ Playground 검증기는 이름이 ASCII 로 시작·끝나야 하고 26자 이내여야 하므로
   한글 라벨은 검증 오류를 낸다. 그림은 정상 렌더링되며 오류는 표시만 된다.
   검증을 통과해야 하면(예: Submit to Catalogue) 영문판을 쓰라.

사용: python3 to_korean_labels.py <내보낸파일.rdf> > seoul_ontology_ko.rdf
"""
import re, sys, collections

# 클래스와 이름이 겹치는 관계는 동사형으로 바꾼다.
# 그림에서 동그라미(개체)와 화살표(관계)가 같은 이름이면 읽는 사람이 헷갈린다.
DISAMBIGUATE = {
    'conductedBy': '심의를 맡는다',      # 클래스 ReviewCommittee 가 이미 "심의 주체"
    'decidedBy':   '선정을 결정한다',    # 속성 decidedBySelf 가 이미 "결정 주체"
}


def korean_name(comment: str, fallback: str) -> str:
    """주석 앞부분에서 한글 이름을 뽑는다."""
    if not comment:
        return fallback
    head = comment.split(' — ')[0].strip()
    # 설명만 있고 이름이 없는 경우(문장으로 시작) 는 원래 라벨을 유지한다
    if not head or len(head) > 40 or head.endswith('.'):
        return fallback
    return head

def convert(text: str):
    stats = collections.Counter()
    labels = []

    def one(m):
        block = m.group(0)
        lm = re.search(r'<rdfs:label>([^<]*)</rdfs:label>', block)
        cm = re.search(r'<rdfs:comment>(.*?)</rdfs:comment>', block, re.S)
        if not lm:
            stats['nolabel'] += 1
            return block
        old = lm.group(1)
        iri = re.search(r'rdf:about="([^"]*)"', block)
        local = iri.group(1).rsplit('/', 1)[-1] if iri else ''
        ko = DISAMBIGUATE.get(local) or korean_name(cm.group(1) if cm else '', old)
        if ko == old:
            stats['kept'] += 1
        else:
            stats['changed'] += 1
        labels.append(ko)
        return block.replace(lm.group(0), f'<rdfs:label>{ko}</rdfs:label>', 1)

    out = re.sub(r'<owl:(Class|ObjectProperty|DatatypeProperty)\b.*?</owl:\1>',
                 one, text, flags=re.S)
    # 문서 제목도 한글로 (Playground 상단에 표시된다)
    out = re.sub(r'(<owl:Ontology\b.*?<rdfs:label>)[^<]*(</rdfs:label>)',
                 r'\g<1>서울형 장애인 개인예산제 온톨로지\g<2>', out, flags=re.S)
    return out, stats, labels

def main():
    if len(sys.argv) < 2:
        sys.exit("사용: python3 to_korean_labels.py <내보낸파일.rdf> > 출력.rdf")
    src = open(sys.argv[1], encoding='utf-8').read()
    out, stats, labels = convert(src)
    dupes = [l for l, c in collections.Counter(labels).items() if c > 1]
    sys.stderr.write(f"한글로 변경 {stats['changed']} / 원래 라벨 유지 {stats['kept']} / 라벨 없음 {stats['nolabel']}\n")
    if dupes:
        sys.stderr.write(f"⚠️ 중복 라벨 {len(dupes)}건: {', '.join(dupes[:8])}\n")
    sys.stdout.write(out)

if __name__ == '__main__':
    main()
