#!/usr/bin/env python3
"""seoul_ontology.rdf 로부터 한글 다이어그램(Mermaid)을 생성한다.

Ontology Playground 는 라벨이 ASCII 로 시작·끝나고 26자 이내여야 해서
한글 이름을 넣을 수 없다. 그래서 RDF 는 영문 라벨 + 한글 주석으로 두고,
사람이 볼 그림은 여기서 만든다. RDF 가 정본이므로 둘이 어긋날 일이 없다.

사용: python3 make_diagram.py > seoul_ontology_diagram.md
"""
import xml.etree.ElementTree as ET, collections, sys

RDF ='{http://www.w3.org/1999/02/22-rdf-syntax-ns#}'
RDFS='{http://www.w3.org/2000/01/rdf-schema#}'
OWL ='{http://www.w3.org/2002/07/owl#}'

# 7개 군 — 설계 문서 §3.1 과 같은 분류
GROUPS = [
    ("제도·차수",   ["Cohort"]),
    ("참여자·자격", ["Participant","Proxy","DisabilityProfile","BenefitStatus"]),
    ("신청",       ["Application","ApplicationDocument","ConsentRecord","SelectionDecision"]),
    ("이용계획",   ["UtilizationPlan","SelfNarrative","RequestedService","ServiceDomain"]),
    ("심의·권리구제",["PlanReview","ReviewCommittee","Notification","Appeal"]),
    ("예산·집행",  ["BudgetAllocation","ServiceUsage","Receipt","ServiceProvider"]),
    ("규칙·정산",  ["SpendingRule","RuleCheck","Settlement","MonitoringRecord"]),
    ("기관",       ["AdministeringBody","ExecutingAgency","Caseworker"]),
]

def ko(text, fallback):
    """주석에서 한글 이름만 뽑는다. '참여자 — 설명...' → '참여자'"""
    if not text: return fallback
    return text.split(' — ')[0].strip() or fallback

def main(path='seoul_ontology.rdf'):
    root = ET.parse(path).getroot()
    frag = lambda u: u.split('#')[-1] if u else None
    names, edges, props = {}, [], collections.defaultdict(list)

    for el in root:
        n = frag(el.get(RDF+'about'))
        cm = el.find(RDFS+'comment')
        label = ko(cm.text if cm is not None else None, n)
        if el.tag == OWL+'Class':
            names[n] = label
        elif el.tag == OWL+'ObjectProperty':
            d, r = el.find(RDFS+'domain'), el.find(RDFS+'range')
            if d is not None and r is not None:
                edges.append((frag(d.get(RDF+'resource')), frag(r.get(RDF+'resource')), label))
        elif el.tag == OWL+'DatatypeProperty':
            d = el.find(RDFS+'domain')
            if d is not None and not n.endswith('Id'):     # 식별자는 표에서 생략
                props[frag(d.get(RDF+'resource'))].append((n, label))

    o = sys.stdout.write
    o("# 서울형 개인예산제 온톨로지 — 한글 관계도\n\n")
    o("> 이 파일은 `make_diagram.py` 가 `seoul_ontology.rdf` 에서 자동 생성합니다. 직접 고치지 마세요.\n")
    o("> RDF 가 정본이고 이 문서는 사람이 읽기 위한 투영입니다.\n\n")
    o("Ontology Playground 는 이름이 ASCII 로 시작·끝나고 26자 이내여야 해서 한글 이름을 받지 않습니다.\n")
    o("그래서 RDF 라벨은 영문으로 두고, 한글 그림은 여기서 봅니다.\n\n---\n\n## 전체 관계도\n\n")

    o("```mermaid\nflowchart LR\n")
    placed = set()
    for gi, (gname, members) in enumerate(GROUPS, 1):
        o(f'  subgraph g{gi}["{gname}"]\n')
        for c in members:
            if c in names:
                o(f'    {c}["{names[c]}"]\n'); placed.add(c)
        o("  end\n")
    for c in names:                                   # 군에 안 들어간 클래스 방지
        if c not in placed: o(f'  {c}["{names[c]}"]\n')
    o("\n")
    for s_, t_, lab in edges:
        if s_ in names and t_ in names:
            o(f'  {s_} -->|"{lab}"| {t_}\n')
    o('\n  style Participant fill:#2e7d32,stroke:#1b5e20,color:#fff\n')
    o("```\n\n---\n\n## 당사자 중심으로 본 그림\n\n")
    o("신청·동의·계획수립·이용·이의신청이 모두 당사자에서 출발합니다.\n")
    o("이 방향이 곧 개인예산제의 전제입니다 — 당사자가 스스로 계획하고 선택하고 구매한다.\n\n")
    o("```mermaid\nflowchart LR\n")
    o(f'  Participant["{names.get("Participant","참여자")}"]\n')
    for s_, t_, lab in edges:
        if s_ == 'Participant' and t_ in names:
            o(f'  Participant -->|"{lab}"| {t_}["{names[t_]}"]\n')
    for s_, t_, lab in edges:
        if t_ == 'Participant' and s_ in names:
            o(f'  {s_}["{names[s_]}"] -->|"{lab}"| Participant\n')
    o('  style Participant fill:#2e7d32,stroke:#1b5e20,color:#fff\n```\n\n---\n\n')

    o("## 절차 흐름 (신청부터 정산까지)\n\n```mermaid\nflowchart TD\n")
    flow = [("Application","SelectionDecision","선정한다"),
            ("SelectionDecision","UtilizationPlan","계획을 세운다"),
            ("UtilizationPlan","PlanReview","심의한다"),
            ("PlanReview","Notification","통지한다"),
            ("Notification","Appeal","이의신청할 수 있다"),
            ("PlanReview","BudgetAllocation","예산을 배정한다"),
            ("BudgetAllocation","ServiceUsage","집행한다"),
            ("ServiceUsage","MonitoringRecord","모니터링한다"),
            ("ServiceUsage","Settlement","정산한다")]
    for i,(a,b,lab) in enumerate(flow, 1):
        o(f'  {a}["{names.get(a,a)}"] -->|"{lab}"| {b}["{names.get(b,b)}"]\n')
    o('  Appeal -.->|"재심 결과 반영"| PlanReview\n')
    o("```\n\n---\n\n## 각 개체가 기록하는 것\n\n")
    for gname, members in GROUPS:
        o(f"### {gname}\n\n")
        for c in members:
            if c not in names: continue
            o(f"**{names[c]}** `{c}`\n\n")
            if props.get(c):
                for pn, plab in props[c]:
                    o(f"- {plab} `{pn}`\n")
            else:
                o("- (식별자 외 속성 없음)\n")
            o("\n")

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv)>1 else 'seoul_ontology.rdf')
