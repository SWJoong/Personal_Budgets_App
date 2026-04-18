# 인프라 구성

## 전체 아키텍처

```
사용자 브라우저
    │
    ▼
[Vercel Edge Network]
    │ Next.js SSR/SSG/ISR
    ▼
[Vercel Functions]
    │ API Routes / Server Actions
    ▼
[Supabase]
├── PostgreSQL (데이터베이스)
├── Auth (인증)
├── Edge Functions (서버리스)
├── Storage (파일 저장)
└── Realtime (실시간 알림)
```

## Vercel 설정

- **프레임워크**: Next.js
- **Node 버전**: 20.x
- **빌드 커맨드**: `pnpm build`
- **출력 디렉토리**: `.next`
- **루트 디렉토리**: `/`

## Supabase 플랜 및 제한

| 항목 | 무료 티어 제한 |
|------|--------------|
| DB 크기 | 500MB |
| 대역폭 | 5GB/월 |
| 스토리지 | 1GB |
| Edge Functions | 500K 호출/월 |
| 동시 연결 | 60개 |
| Auth MAU | 50,000명 |

## GitHub Actions 사용 비용

- 공개 저장소: 무료
- 비공개 저장소: 월 2,000분 무료

## 모니터링 도구

- **오류 추적**: Vercel Analytics (기본 내장)
- **성능**: Vercel Speed Insights
- **DB 모니터링**: Supabase 대시보드
- **알림**: Slack Webhook 연동
