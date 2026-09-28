# 기술 스택 상세

## 프론트엔드
- **프레임워크**: Next.js 15 (App Router)
- **UI 라이브러리**: React 19
- **언어**: TypeScript (strict mode)
- **스타일**: Tailwind CSS v4
- **상태관리**: 서버 컴포넌트 조회 + 서버 액션 뮤테이션(`useTransition`). 전역 UI 는 React state/context. 외부 상태 라이브러리 없음
- **폼**: 네이티브 `<form action={서버액션}>` + FormData 파싱(`src/app/actions/`). 외부 폼·스키마 라이브러리 없음

## 백엔드 / 데이터베이스
- **BaaS**: Supabase
  - PostgreSQL (RLS 적용 필수)
  - Supabase Auth (이메일/소셜 로그인)
  - Edge Functions: 미사용(서버 로직은 Next 서버 액션)
  - Storage: receipts·activity-photos·documents 버킷(private + signed URL)
- **ORM**: Supabase JS Client v2

## 배포 / 인프라
- **호스팅**: Vercel (자동 프리뷰 배포)
- **환경변수**: Vercel 대시보드 + `.env.local`
- **CI/CD**: GitHub Actions → Vercel

## 개발 도구
- **패키지 매니저**: npm (`npm ci`, CI 와 동일)
- **린터**: ESLint(eslint-config-next + jsx-a11y recommended, CI blocking). Prettier 없음
- **테스트**: Vitest + Testing Library(jsdom) 단위·렌더 계약. E2E 미도입(수동 QA 체크리스트 `docs/release/16`)
- **타입 생성**: supabase gen types typescript

## 폴더 구조 (현행)
```
src/
├── app/             # App Router — (auth)·(participant)·(supporter) 라우트 그룹, actions/ 서버 액션
├── components/      # admin·home·layout·map·plan·help 영역별 + ui/ 프리미티브
├── content/         # 정적 콘텐츠
├── data/            # 정적 데이터·상수
├── hooks/           # 커스텀 훅(useAccessibility 등)
├── utils/           # supabase/ 클라이언트·copay·ai 등 순수 로직
├── test/            # 테스트 셋업·정적 계약(W 레인)
├── types/           # database.ts(generate-types 산출물)
└── proxy.ts         # 인증 경계 프록시
```

## 브랜치 전략 (하네스)
- `main`: 항상 그린, 브랜치 보호(strict: quality-check + db-verify required). 직접 push 금지, 머지는 사람
- `feat/<태스크>`: U 구현 → `[HANDOFF→W]` PR
- `test/w-<주제>`: W RED 계약 → `[HANDOFF→U]` PR
- `fix/*`·`docs/*`: 버그·문서. `develop`·스테이징 브랜치는 없다
- `agent-sync`: 상태 채널 전용(코드 없음, main 에 병합하지 않음)

## 커밋 메시지 컨벤션
```
feat: 새 기능
fix: 버그 수정
refactor: 코드 리팩토링
style: 스타일 변경 (기능 변경 없음)
test: 테스트 추가/수정
docs: 문서 수정
chore: 빌드·설정 변경
```
