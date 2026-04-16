다음 단계로 새 Supabase 마이그레이션 파일을 생성해 주세요.

1. `supabase/migrations/` 폴더의 파일 목록을 확인하여 현재 가장 높은 번호를 파악하세요.
2. 다음 번호로 파일명을 결정합니다 (예: 현재 최고가 20이면 → `21_설명.sql`).
3. 마이그레이션 목적을 물어보고, 그에 맞는 SQL을 작성합니다.

### SQL 작성 시 따를 규칙

- 테이블 생성 시 RLS 활성화 포함: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- RLS 정책은 역할별로 분리 (SELECT / INSERT·UPDATE·DELETE 분리)
  - 읽기: `TO authenticated USING (true)` 또는 조건부
  - 쓰기: admin 역할 확인 `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`
- 컬럼 추가 시 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` 사용
- Storage 버킷은 항상 `public = false` (private)
- 멱등성 보장: `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING` 활용

### 파일 생성 후 안내

생성된 파일은 **Supabase 대시보드 > SQL Editor**에서 직접 실행해야 합니다.
`supabase db push` 또는 로컬 CLI는 사용하지 않습니다.

```
Supabase 대시보드 → SQL Editor → 파일 내용 붙여넣기 → Run
```
