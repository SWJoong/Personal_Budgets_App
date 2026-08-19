#!/usr/bin/env python3
"""seoul_ontology.rdf(정본, 영문 라벨) → seoul_ontology_ko.rdf(한글 라벨, Playground 보기용).

정본 RDF 를 한글 라벨판으로 옮긴다. 라벨의 한글은 정본 rdfs:comment 앞부분에서
가져온다 ("참여자 — 설명..." → "참여자"). Playground 가 붙였던 스타일
(ont:icon / ont:color / ont:cardinality / ont:propertyType / from·toEntityId)은
기존 ko 파일에서 이름으로 찾아 그대로 보존하고, 새 개체·관계에는 기본값을 준다.

이렇게 두는 이유: 정본이 바뀌면(클래스·관계·주석) 이 스크립트만 다시 돌리면 한글판이
정본과 어긋나지 않는다. to_korean_labels.py 는 Playground [Export RDF] 파일을 변환하는
경로이고, 이 스크립트는 그런 왕복 없이 정본에서 바로 만드는 오프라인 경로다.

⚠️ 한글 라벨은 Playground 검증기(이름이 ASCII 로 시작·끝, 26자 이내)에서 오류로 표시된다.
   그림은 정상 렌더링된다. 검증까지 통과해야 하면 정본(seoul_ontology.rdf, 영문 라벨)을 쓴다.

사용: python3 make_ko_rdf.py > seoul_ontology_ko.rdf
"""
import xml.etree.ElementTree as ET, sys, html

BASE = 'http://example.org/ontology/seoul-personal-budget-scheme-ontology/'
RDF  = '{http://www.w3.org/1999/02/22-rdf-syntax-ns#}'
RDFS = '{http://www.w3.org/2000/01/rdf-schema#}'
OWL  = '{http://www.w3.org/2002/07/owl#}'
ONT  = '{%s}' % BASE          # ont: 네임스페이스 == base
XSDB = 'http://www.w3.org/2001/XMLSchema#'

# 새 개체·관계에 줄 기본 스타일 (기존 ko 에 없을 때만 쓰인다)
NEW_CLASS_STYLE = {
    'Cohort':              {'icon': '📅', 'color': '#5C2D91'},
    'ApplicationDocument': {'icon': '📄', 'color': '#8764B8'},
}
DEFAULT_ICON, DEFAULT_COLOR = '📦', '#605E5C'

frag = lambda u: u.split('#')[-1] if u else None
def camel(cls):                       # Participant -> participant
    return cls[0].lower() + cls[1:] if cls else cls
def ko_head(txt, fb):                 # "참여자 — 설명" -> "참여자"
    if not txt:
        return fb
    return txt.split(' — ')[0].strip() or fb
def esc(t):
    return html.escape(t or '', quote=True)

def name_of(el):
    about = el.get(RDF + 'about')
    if not about:
        return None
    return about[len(BASE):] if about.startswith(BASE) else frag(about)

def harvest(path):
    """기존 ko 파일에서 이름별 스타일을 수확한다. 없으면 빈 dict."""
    styles = {'class': {}, 'obj': {}, 'data': {}, 'ontology': None}
    try:
        root = ET.parse(path).getroot()
    except Exception:
        return styles
    for el in root:
        if el.tag == OWL + 'Ontology':
            lab = el.find(RDFS + 'label'); cm = el.find(RDFS + 'comment')
            styles['ontology'] = (lab.text if lab is not None else None,
                                  cm.text if cm is not None else None)
            continue
        nm = name_of(el)
        if not nm:
            continue
        g = lambda t: (el.find(ONT + t).text if el.find(ONT + t) is not None else None)
        if el.tag == OWL + 'Class':
            styles['class'][nm] = {'icon': g('icon'), 'color': g('color')}
        elif el.tag == OWL + 'ObjectProperty':
            styles['obj'][nm] = {'card': g('cardinality'), 'from': g('fromEntityId'), 'to': g('toEntityId')}
        elif el.tag == OWL + 'DatatypeProperty':
            styles['data'][nm] = {'ptype': g('propertyType')}
    return styles

def main(canon='seoul_ontology.rdf', ko='seoul_ontology_ko.rdf'):
    root = ET.parse(canon).getroot()
    st = harvest(ko)
    classes, objs, datas, ontology = [], [], [], None

    for el in root:
        if el.tag == OWL + 'Ontology':
            lab = el.find(RDFS + 'label'); cm = el.find(RDFS + 'comment')
            ontology = (lab.text if lab is not None else None, cm.text if cm is not None else None)
        elif el.tag == OWL + 'Class':
            n = frag(el.get(RDF + 'about')); cm = el.find(RDFS + 'comment')
            classes.append((n, cm.text if cm is not None else ''))
        elif el.tag == OWL + 'ObjectProperty':
            n = frag(el.get(RDF + 'about')); cm = el.find(RDFS + 'comment')
            d = el.find(RDFS + 'domain'); r = el.find(RDFS + 'range')
            objs.append((n, cm.text if cm is not None else '',
                         frag(d.get(RDF + 'resource')) if d is not None else None,
                         frag(r.get(RDF + 'resource')) if r is not None else None))
        elif el.tag == OWL + 'DatatypeProperty':
            n = frag(el.get(RDF + 'about')); cm = el.find(RDFS + 'comment')
            d = el.find(RDFS + 'domain'); r = el.find(RDFS + 'range')
            datas.append((n, cm.text if cm is not None else '',
                          frag(d.get(RDF + 'resource')) if d is not None else None,
                          r.get(RDF + 'resource') if r is not None else None))

    o = sys.stdout.write
    o('<?xml version="1.0" encoding="UTF-8"?>\n')
    o('<!-- 자동 생성 파일 — make_ko_rdf.py 가 seoul_ontology.rdf(정본)에서 만든다. 직접 고치지 마세요.\n')
    o('     한글 라벨은 Playground 검증에서 오류로 표시되지만 그림은 정상입니다(README 참조). -->\n')
    o('<rdf:RDF\n')
    o('    xml:base="%s"\n' % BASE)
    o('    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"\n')
    o('    xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"\n')
    o('    xmlns:owl="http://www.w3.org/2002/07/owl#"\n')
    o('    xmlns:xsd="http://www.w3.org/2001/XMLSchema#"\n')
    o('    xmlns:ont="%s">\n\n' % BASE)

    olab, ocm = st['ontology'] or ontology or ('서울형 장애인 개인예산제 온톨로지', '')
    o('    <owl:Ontology rdf:about="%s">\n' % BASE)
    o('        <rdfs:label>%s</rdfs:label>\n' % esc(olab))
    if ocm:
        o('        <rdfs:comment>%s</rdfs:comment>\n' % esc(ocm))
    o('    </owl:Ontology>\n\n')

    o('    <!-- Entity Types (Classes) -->\n')
    for n, cm in classes:
        style = st['class'].get(n) or {}
        icon = style.get('icon') or NEW_CLASS_STYLE.get(n, {}).get('icon', DEFAULT_ICON)
        color = style.get('color') or NEW_CLASS_STYLE.get(n, {}).get('color', DEFAULT_COLOR)
        o('    <owl:Class rdf:about="%s%s">\n' % (BASE, n))
        o('        <rdfs:label>%s</rdfs:label>\n' % esc(ko_head(cm, n)))
        o('        <rdfs:comment>%s</rdfs:comment>\n' % esc(cm))
        o('        <ont:icon>%s</ont:icon>\n' % esc(icon))
        o('        <ont:color>%s</ont:color>\n' % esc(color))
        o('    </owl:Class>\n')
    o('\n    <!-- Object Properties (관계) -->\n')
    for n, cm, dom, rng in objs:
        style = st['obj'].get(n) or {}
        card = style.get('card') or 'one-to-many'
        fe = style.get('from') or (camel(dom) if dom else '')
        te = style.get('to') or (camel(rng) if rng else '')
        o('    <owl:ObjectProperty rdf:about="%s%s">\n' % (BASE, n))
        o('        <rdfs:label>%s</rdfs:label>\n' % esc(ko_head(cm, n)))
        if dom: o('        <rdfs:domain rdf:resource="%s%s"/>\n' % (BASE, dom))
        if rng: o('        <rdfs:range rdf:resource="%s%s"/>\n' % (BASE, rng))
        o('        <rdfs:comment>%s</rdfs:comment>\n' % esc(cm))
        o('        <ont:cardinality>%s</ont:cardinality>\n' % esc(card))
        if fe: o('        <ont:fromEntityId>%s</ont:fromEntityId>\n' % esc(fe))
        if te: o('        <ont:toEntityId>%s</ont:toEntityId>\n' % esc(te))
        o('    </owl:ObjectProperty>\n')
    o('\n    <!-- Data Properties (속성) -->\n')
    for n, cm, dom, rng in datas:
        camel_dom = camel(dom) if dom else ''
        uri = '%s_%s' % (camel_dom, n) if camel_dom else n
        ptype = (st['data'].get(uri) or {}).get('ptype') or (rng.split('#')[-1] if rng else 'string')
        is_id = n.endswith('Id')
        o('    <owl:DatatypeProperty rdf:about="%s%s">\n' % (BASE, uri))
        o('        <rdfs:label>%s</rdfs:label>\n' % esc(ko_head(cm, n)))
        if dom: o('        <rdfs:domain rdf:resource="%s%s"/>\n' % (BASE, dom))
        if rng: o('        <rdfs:range rdf:resource="%s"/>\n' % rng)
        o('        <rdfs:comment>%s</rdfs:comment>\n' % esc(cm))
        if is_id:
            o('        <ont:isIdentifier rdf:datatype="%sboolean">true</ont:isIdentifier>\n' % XSDB)
        o('        <ont:propertyType>%s</ont:propertyType>\n' % esc(ptype))
        o('    </owl:DatatypeProperty>\n')
    o('\n</rdf:RDF>\n')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'seoul_ontology.rdf')
