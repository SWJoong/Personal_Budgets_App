# 기술 스택 상세

## 프론트엔드
- **프레임워크**: Next.js 15 (App Router)
- **UI 라이브러리**: React 19
- **언어**: TypeScript (strict mode)
- **스타일**: Tailwind CSS v4
- **상태관리**: Zustand (클라이언트), TanStack Query (서버 상태)
- **폼**: React Hook Form + Zod

## 백엔드 / 데이터베이스
- **BaaS**: Supabase
  - PostgreSQL (RLS 적용 필수)
  - Supabase Auth (이메일/소셜 로그인)
  - Edge Functions (서버리스 로직)
  - Realtime (예산 변경 알림)
- **ORM**: Supabase JS Client v2

## 배포 / 인프라
- **호스팅**: Vercel (자동 프리뷰 배포)
- **환경변수**: Vercel 대시보드 + `.env.local`
- **CI/CD**: GitHub Actions → Vercel

## 개발 도구
- **패키지 매니저**: pnpm
- **린터**: ESLint + Prettier
- **테스트**: Vitest (단위), Playwright (E2E)
- **타입 생성**: supabase gen types typescript

## 폴더 구조 컨벤션
```
src/
├── app/             # Next.js App Router 페이지
├── components/
│   ├── ui/          # 범용 UI 컴포넌트
│   └── features/    # 기능별 컴포넌트
├── lib/
│   ├── supabase/    # Supabase 클라이언트
│   └── utils/       # 유틸 함수
├── hooks/           # 커스텀 훅
├── types/           # TypeScript 타입 정의
└── constants/       # 상수 정의
```

## 브랜치 전략
- `main`: 프로덕션 (Vercel 자동 배포)
- `develop`: 개발 통합 브랜치
- `feature/[이슈번호]-[기능명]`: 기능 개발
- `fix/[이슈번호]-[버그명]`: 버그 수정
- `chore/[작업명]`: 설정, 의존성 업데이트

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
