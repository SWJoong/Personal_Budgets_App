# 개인예산제 앱 팀 Skills

발달장애인을 위한 개인예산제 앱 개발팀의 Claude Code Skill 패키지입니다.

## 설치

```bash
# 전체 팀 skills를 ~/.claude/skills/ 에 복사
cp -r personal-budget-team/* ~/.claude/skills/

# 또는 프로젝트 로컬 설치
cp -r personal-budget-team/* [프로젝트루트]/.claude/skills/
```

## 포함된 Skills

| Skill | 역할 | 주요 트리거 키워드 |
|-------|------|-------------------|
| `pm` | PM / 프로젝트 관리자 | 일정, 마일스톤, 리스크, 보고서 |
| `pl` | PL / 리드 개발자 | 아키텍처, 코드 리뷰, 기술 결정 |
| `frontend` | 프론트엔드 개발자 | 컴포넌트, UI 코드, 렌더링, 훅 |
| `backend` | 백엔드 개발자 | DB 설계, API, Supabase, RLS |
| `qa` | QA 엔지니어 | 테스트, 버그, 품질, 릴리스 |
| `ux-ui` | UX/UI 디자이너 | UX, 화면 구조, 사용성, 디자인 |
| `devops` | DevOps 엔지니어 | 배포, CI/CD, 인프라, 모니터링 |
| `easy-read-review` | 쉬운 정보 검수 | 쉬운 언어, 접근성 평가, easy read |

## 사용법

Claude Code에서 자연어로 역할을 호출합니다:

```
"PM 입장에서 이번 스프린트 계획을 잡아줘"
"PL로서 이 컴포넌트 구조를 코드 리뷰해줘"
"QA 관점에서 예산 입력 기능의 테스트 케이스를 작성해줘"
"UX 디자이너로서 지출 입력 화면의 사용성을 검토해줘"
"DevOps 엔지니어로 GitHub Actions 워크플로를 설정해줘"
```

## 팀 Skill + easy-read-review 연계

```
"FE 개발자로서 BudgetCard 컴포넌트를 구현하고,
 easy-read-review로 텍스트 접근성도 함께 검수해줘"
```

## 폴더 구조

```
personal-budget-team/
├── pm/
│   ├── SKILL.md
│   └── references/project-context.md
├── pl/
│   ├── SKILL.md
│   └── references/tech-stack.md
├── frontend/
│   └── SKILL.md
├── backend/
│   ├── SKILL.md
│   └── references/data-models.md
├── qa/
│   └── SKILL.md
├── ux-ui/
│   ├── SKILL.md
│   └── references/design-system.md
└── devops/
    ├── SKILL.md
    └── references/infrastructure.md
```
