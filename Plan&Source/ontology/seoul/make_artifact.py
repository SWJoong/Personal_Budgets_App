#!/usr/bin/env python3
"""seoul_ontology.rdf → 한글 관계도 HTML.

RDF 가 정본이므로 이 페이지는 손으로 고치지 않는다. 다시 생성한다.
사용: python3 make_artifact.py > seoul_ontology_view.html
"""
import xml.etree.ElementTree as ET, collections, sys, html

RDF='{http://www.w3.org/1999/02/22-rdf-syntax-ns#}'
RDFS='{http://www.w3.org/2000/01/rdf-schema#}'
OWL='{http://www.w3.org/2002/07/owl#}'

GROUPS=[("제도·차수",["Cohort"],"금액·기간·기한을 코드가 아닌 데이터로"),
        ("참여자와 자격",["Participant","Proxy","DisabilityProfile","BenefitStatus"],"신청서 인적사항에서 나온 것들"),
        ("신청",["Application","ApplicationDocument","ConsentRecord","SelectionDecision"],"절차 1·2단계"),
        ("이용계획",["UtilizationPlan","SelfNarrative","RequestedService","ServiceDomain"],"절차 3단계"),
        ("심의와 권리구제",["PlanReview","ReviewCommittee","Notification","Appeal"],"절차 4·5단계"),
        ("예산과 집행",["BudgetAllocation","ServiceUsage","Receipt","ServiceProvider"],"절차 6단계"),
        ("규칙과 정산",["SpendingRule","RuleCheck","Settlement","MonitoringRecord"],"절차 7단계, 이용 제한 요건"),
        ("기관과 담당자",["AdministeringBody","ExecutingAgency","Caseworker"],"동의서에 열거된 기관들")]

FLOW=[("Application","SelectionDecision","선정한다"),("SelectionDecision","UtilizationPlan","계획을 세운다"),
      ("UtilizationPlan","PlanReview","심의한다"),("PlanReview","Notification","통지한다"),
      ("Notification","Appeal","이의신청할 수 있다"),("PlanReview","BudgetAllocation","예산을 배정한다"),
      ("BudgetAllocation","ServiceUsage","집행한다"),("ServiceUsage","MonitoringRecord","모니터링한다"),
      ("ServiceUsage","Settlement","정산한다")]

def load(path):
    root=ET.parse(path).getroot(); frag=lambda u:u.split('#')[-1] if u else None
    names={}; desc={}; edges=[]; props=collections.defaultdict(list)
    for el in root:
        n=frag(el.get(RDF+'about')); cm=el.find(RDFS+'comment')
        raw=(cm.text or '').strip() if cm is not None else ''
        ko=raw.split(' — ')[0].strip() or n
        rest=raw.split(' — ',1)[1].strip() if ' — ' in raw else ''
        if el.tag==OWL+'Class': names[n]=ko; desc[n]=rest
        elif el.tag==OWL+'ObjectProperty':
            d,r=el.find(RDFS+'domain'),el.find(RDFS+'range')
            if d is not None and r is not None:
                edges.append((frag(d.get(RDF+'resource')),frag(r.get(RDF+'resource')),ko))
        elif el.tag==OWL+'DatatypeProperty':
            d=el.find(RDFS+'domain')
            if d is not None and not n.endswith('Id'):
                props[frag(d.get(RDF+'resource'))].append((n,ko))
    return names,desc,edges,props

def mermaid_full(names,edges):
    L=["flowchart LR"]
    for gi,(g,ms,_) in enumerate(GROUPS,1):
        L.append(f'  subgraph g{gi}["{g}"]')
        for c in ms:
            if c in names: L.append(f'    {c}["{names[c]}"]')
        L.append("  end")
    for a,b,lab in edges:
        if a in names and b in names: L.append(f'  {a} -->|"{lab}"| {b}')
    L.append('  style Participant fill:#b3352c,stroke:#7d211a,color:#fff')
    return "\n".join(L)

def mermaid_person(names,edges):
    L=["flowchart LR",f'  Participant["{names.get("Participant","참여자")}"]']
    for a,b,lab in edges:
        if a=="Participant" and b in names: L.append(f'  Participant -->|"{lab}"| {b}["{names[b]}"]')
    for a,b,lab in edges:
        if b=="Participant" and a in names: L.append(f'  {a}["{names[a]}"] -->|"{lab}"| Participant')
    L.append('  style Participant fill:#b3352c,stroke:#7d211a,color:#fff')
    return "\n".join(L)

def mermaid_flow(names):
    L=["flowchart TD"]
    for a,b,lab in FLOW: L.append(f'  {a}["{names.get(a,a)}"] -->|"{lab}"| {b}["{names.get(b,b)}"]')
    L.append('  Appeal -.->|"재심 결과 반영"| PlanReview')
    L.append('  style Appeal fill:#b3352c,stroke:#7d211a,color:#fff')
    return "\n".join(L)

def main(path='seoul_ontology.rdf'):
    names,desc,edges,props=load(path)
    e=html.escape
    nprop=sum(len(v) for v in props.values())
    o=sys.stdout.write
    o('<title>서울형 개인예산제 온톨로지 관계도</title>\n<style>\n')
    o('''
:root{
  --paper:#faf8f5; --surface:#ffffff; --ink:#1a1614; --ink-soft:#6f665e;
  --seal:#b3352c; --seal-wash:#f5e9e7; --rule:#e4dcd2; --sheet:#fbf9f6;
}
@media (prefers-color-scheme:dark){:root{
  --paper:#141110; --surface:#1d1917; --ink:#ece6dd; --ink-soft:#9c9289;
  --seal:#d9645c; --seal-wash:#2c1e1c; --rule:#2f2823; --sheet:#fbf9f6;
}}
:root[data-theme="dark"]{
  --paper:#141110; --surface:#1d1917; --ink:#ece6dd; --ink-soft:#9c9289;
  --seal:#d9645c; --seal-wash:#2c1e1c; --rule:#2f2823; --sheet:#fbf9f6;
}
:root[data-theme="light"]{
  --paper:#faf8f5; --surface:#ffffff; --ink:#1a1614; --ink-soft:#6f665e;
  --seal:#b3352c; --seal-wash:#f5e9e7; --rule:#e4dcd2; --sheet:#fbf9f6;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;
  line-height:1.75; -webkit-font-smoothing:antialiased;
}
code,.mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace}
.wrap{max-width:74rem;margin:0 auto;padding:clamp(2rem,5vw,4.5rem) clamp(1.1rem,4vw,2.5rem) 6rem}
header{border-bottom:2px solid var(--ink);padding-bottom:1.6rem;margin-bottom:2.5rem}
.eyebrow{
  font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;color:var(--seal);
  font-weight:700;margin:0 0 .7rem
}
h1{font-size:clamp(1.75rem,4.2vw,2.7rem);line-height:1.25;margin:0 0 .8rem;text-wrap:balance;letter-spacing:-.02em}
.lede{color:var(--ink-soft);max-width:60ch;margin:0;font-size:1.02rem}
.stats{display:flex;flex-wrap:wrap;gap:2.4rem;margin-top:1.9rem}
.stat b{display:block;font-size:1.85rem;line-height:1.1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.stat span{font-size:.8rem;color:var(--ink-soft);letter-spacing:.04em}
section{margin-top:3.4rem}
h2{
  font-size:1.32rem;margin:0 0 .5rem;letter-spacing:-.01em;
  display:flex;align-items:baseline;gap:.7rem
}
h2::before{
  content:"";width:.62rem;height:.62rem;background:var(--seal);
  border-radius:50%;flex:none;transform:translateY(-.1em)
}
.note{color:var(--ink-soft);margin:0 0 1.3rem;max-width:62ch;font-size:.95rem}
.sheet{
  background:var(--sheet);border:1px solid var(--rule);border-radius:3px;
  padding:1.4rem 1.2rem;overflow-x:auto;
  box-shadow:0 1px 2px rgba(26,22,20,.06),0 8px 22px -14px rgba(26,22,20,.22)
}
.sheet pre.mermaid{margin:0;min-width:max-content}
.groups{display:grid;gap:1.1rem;grid-template-columns:repeat(auto-fill,minmax(19rem,1fr));margin-top:1.4rem}
.card{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:1.15rem 1.25rem 1.3rem}
.card h3{font-size:1.02rem;margin:0 0 .15rem;letter-spacing:-.01em}
.card .sub{font-size:.78rem;color:var(--ink-soft);margin:0 0 .95rem}
.ent{padding:.62rem 0;border-top:1px solid var(--rule)}
.ent:first-of-type{border-top:none;padding-top:.2rem}
.ent .nm{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap}
.ent .nm b{font-size:.94rem;font-weight:600}
.ent .nm code{font-size:.73rem;color:var(--ink-soft)}
.ent ul{margin:.45rem 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:.3rem}
.ent li{
  font-size:.76rem;background:var(--seal-wash);color:var(--ink);
  padding:.14rem .5rem;border-radius:2px;white-space:nowrap
}
.ent .none{font-size:.76rem;color:var(--ink-soft);margin:.4rem 0 0}
footer{margin-top:4rem;padding-top:1.4rem;border-top:1px solid var(--rule);color:var(--ink-soft);font-size:.85rem}
footer code{font-size:.8rem}
@media (max-width:34rem){.stats{gap:1.5rem}}
''')
    o('</style>\n')
    o('<div class="wrap">\n<header>\n')
    o('<p class="eyebrow">서울형 장애인 개인예산제 시범사업</p>\n')
    o('<h1>온톨로지 관계도</h1>\n')
    o('<p class="lede">신청부터 정산까지, 무엇이 있고 무엇이 무엇과 이어지는지를 한글로 봅니다. '
      'Ontology Playground 는 이름이 ASCII 로 시작·끝나고 26자 이내여야 해서 한글을 받지 않습니다. '
      '그래서 RDF 라벨은 영문으로 두고, 사람이 읽을 그림은 여기서 봅니다.</p>\n')
    o('<div class="stats">')
    for v,l in [(len(names),"개체"),(len(edges),"관계"),(nprop,"기록 항목"),(0,"연결 안 된 개체")]:
        o(f'<div class="stat"><b>{v}</b><span>{l}</span></div>')
    o('</div>\n</header>\n')

    o('<section>\n<h2>당사자에서 시작하는 그림</h2>\n')
    o('<p class="note">신청·동의·계획수립·이용·이의신청이 모두 당사자에서 출발합니다. '
      '이 화살표 방향이 곧 제도의 전제입니다 — 당사자가 스스로 계획하고 선택하고 구매한다. '
      '담당자는 <b>돕는</b> 사람이지 대신 세우는 사람이 아닙니다.</p>\n')
    o(f'<div class="sheet"><pre class="mermaid">\n{e(mermaid_person(names,edges))}\n</pre></div>\n</section>\n')

    o('<section>\n<h2>절차 흐름</h2>\n')
    o('<p class="note">신청접수 → 참여자선정 → 계획수립 → 심의·통지 → 이의신청 → 서비스이용 → 모니터링·정산. '
      '이의신청은 심의가 아니라 <b>통지</b>를 대상으로 겁니다 — 통지일이 기한의 기산점이기 때문입니다.</p>\n')
    o(f'<div class="sheet"><pre class="mermaid">\n{e(mermaid_flow(names))}\n</pre></div>\n</section>\n')

    o('<section>\n<h2>전체 관계도</h2>\n')
    o('<p class="note">개체 26개와 관계 46개 전부입니다. 연결이 하나도 없는 개체는 없습니다 — '
      '고아 노드가 생기면 설계가 빠진 것이므로 검사로 막고 있습니다.</p>\n')
    o(f'<div class="sheet"><pre class="mermaid">\n{e(mermaid_full(names,edges))}\n</pre></div>\n</section>\n')

    o('<section>\n<h2>각 개체가 기록하는 것</h2>\n')
    o('<p class="note">회색 칸이 실제로 저장되는 항목입니다. 영문 이름은 RDF·DB 에서 쓰는 식별자입니다.</p>\n')
    o('<div class="groups">\n')
    for g,ms,sub in GROUPS:
        o(f'<div class="card"><h3>{e(g)}</h3><p class="sub">{e(sub)}</p>\n')
        for c in ms:
            if c not in names: continue
            o(f'<div class="ent"><div class="nm"><b>{e(names[c])}</b><code>{e(c)}</code></div>')
            if props.get(c):
                o('<ul>'+''.join(f'<li>{e(l)}</li>' for _,l in props[c])+'</ul>')
            else:
                o('<p class="none">식별자 외 기록 항목 없음</p>')
            o('</div>\n')
        o('</div>\n')
    o('</div>\n</section>\n')
    o('<footer><p>이 페이지는 <code>seoul_ontology.rdf</code> 에서 <code>make_artifact.py</code> 가 생성합니다. '
      'RDF 가 정본이므로 여기를 고치지 말고 RDF 를 고친 뒤 다시 생성하세요.</p></footer>\n</div>\n')

if __name__=='__main__':
    main(sys.argv[1] if len(sys.argv)>1 else 'seoul_ontology.rdf')
