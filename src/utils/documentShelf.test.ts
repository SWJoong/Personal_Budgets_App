import { describe, it, expect } from 'vitest'
import { buildDocumentShelf, type ShelfDocRow } from './documentShelf'

/**
 * 서류 보관함 집계 골든 — GOAL축 B · `supporter/documents` (B2).
 * 설계: Plan&Source/goala_documents_shelf_W.md (test-first, W). 트리아지 §4-6 확장.
 *
 * 순수함수라 DB·Storage·렌더 없이 당사자별 그룹핑·doc_type 라벨·정렬·무결성을 못박는다.
 * 입력 ShelfDocRow 는 DB 행 shape 과 분리(U 가 나열 액션 결과를 이 형태로 매핑).
 *
 * ★스코핑 불변식(orgLedger 와 동일 철학): 이 함수는 "보이는 행"만 집계한다.
 *   documents 버킷/테이블 접근 인가는 RLS(seoul_can_access) + 나열 액션의 createClient() 조회가
 *   담당한다(application.ts:344 정본 패턴). 즉 여기 들어오는 rows 는 이미 RLS 로 스코프된 것뿐이며,
 *   함수는 절대 스코프를 넓히지 않는다. signed URL 은 이 집계 밖(RLS 인가된 경로에만 admin 발급).
 */

// 짧은 헬퍼 — 테스트 가독성용
const row = (
  id: string,
  participantId: string,
  participantName: string,
  docType: string,
  fileName: string,
  createdAt: string,
  note: string | null = null,
): ShelfDocRow => ({ id, participantId, participantName, docType, fileName, note, createdAt })

describe('buildDocumentShelf — 당사자별 그룹핑 (불변식 1)', () => {
  it('같은 participantId 행이 한 그룹으로 묶이고 count·이름 대표값', () => {
    const out = buildDocumentShelf([
      row('d1', 'p1', '김지수', 'application_form', '신청서.pdf', '2026-08-01T09:00:00Z'),
      row('d2', 'p1', '김지수', 'consent_form', '동의서.pdf', '2026-08-03T09:00:00Z'),
      row('d3', 'p2', '이서준', 'application_form', '신청서.pdf', '2026-08-02T09:00:00Z'),
    ])
    expect(out.participants).toHaveLength(2)
    const p1 = out.participants.find(p => p.participantId === 'p1')!
    expect(p1.count).toBe(2)
    expect(p1.participantName).toBe('김지수')
    expect(p1.docs).toHaveLength(2)
    const p2 = out.participants.find(p => p.participantId === 'p2')!
    expect(p2.count).toBe(1)
  })
})

describe('buildDocumentShelf — doc_type 라벨 (불변식 2)', () => {
  it('표준 3종은 한글 라벨, 미지 문자열은 기타로(누락·크래시 없음)', () => {
    const out = buildDocumentShelf([
      row('d1', 'p1', 'A', 'application_form', 'a.pdf', '2026-08-01T09:00:00Z'),
      row('d2', 'p1', 'A', 'consent_form', 'b.pdf', '2026-08-01T09:00:00Z'),
      row('d3', 'p1', 'A', 'other', 'c.pdf', '2026-08-01T09:00:00Z'),
      row('d4', 'p1', 'A', 'weird_unknown_type', 'd.pdf', '2026-08-01T09:00:00Z'),
    ])
    const labels = out.participants[0].docs.map(d => d.docTypeLabel).sort()
    // 신청서·동의서·기타·기타(미지 흡수) — 4건 전부 살아 있고 미지값이 '기타'로 안전 강제
    expect(out.participants[0].count).toBe(4)
    expect(labels.filter(l => l === '기타')).toHaveLength(2)
    expect(labels).toContain('신청서')
    expect(labels).toContain('동의서')
  })
})

describe('buildDocumentShelf — latestDate (불변식 3)', () => {
  it('그룹 내 최신 createdAt(Date 파싱 기준)', () => {
    const out = buildDocumentShelf([
      row('d1', 'p1', 'A', 'other', 'a.pdf', '2026-08-01T09:00:00Z'),
      row('d2', 'p1', 'A', 'other', 'b.pdf', '2026-08-15T09:00:00Z'),
      row('d3', 'p1', 'A', 'other', 'c.pdf', '2026-08-09T09:00:00Z'),
    ])
    expect(out.participants[0].latestDate).toBe('2026-08-15T09:00:00Z')
  })
})

describe('buildDocumentShelf — 정렬 결정성 (불변식 4)', () => {
  it('participants: latestDate 내림차순 → 동률 시 이름 오름차순(localeCompare)', () => {
    const out = buildDocumentShelf([
      // 최신 서류일 기준으로 그룹을 정렬: 가장 최근에 서류가 올라온 당사자를 먼저 본다.
      row('d1', 'p-old', '나래', 'other', 'a.pdf', '2026-07-01T09:00:00Z'),   // 최구 → 마지막
      row('d2', 'p-new', '한별', 'other', 'b.pdf', '2026-09-01T09:00:00Z'),   // 최신 → 첫째
      // 동률(같은 최신일)인 두 명 — 이름 오름차순: '가온' < '다온'(ㄱ<ㄷ)
      row('d3', 'p-tieB', '다온', 'other', 'c.pdf', '2026-08-10T09:00:00Z'),
      row('d4', 'p-tieA', '가온', 'other', 'd.pdf', '2026-08-10T09:00:00Z'),
    ])
    expect(out.participants.map(p => p.participantId)).toEqual(['p-new', 'p-tieA', 'p-tieB', 'p-old'])
  })

  it('그룹 내 docs: createdAt 내림차순 → 동률 시 fileName 오름차순', () => {
    const out = buildDocumentShelf([
      row('d1', 'p1', 'A', 'other', 'zebra.pdf', '2026-08-05T09:00:00Z'),  // 동률
      row('d2', 'p1', 'A', 'other', 'apple.pdf', '2026-08-05T09:00:00Z'),  // 동률 → 이름 앞
      row('d3', 'p1', 'A', 'other', 'later.pdf', '2026-08-20T09:00:00Z'),  // 최신 → 첫째
    ])
    expect(out.participants[0].docs.map(d => d.fileName)).toEqual(['later.pdf', 'apple.pdf', 'zebra.pdf'])
  })
})

describe('buildDocumentShelf — 빈 입력 (불변식 5)', () => {
  it('빈 배열 → totalDocuments 0·빈 그룹', () => {
    const out = buildDocumentShelf([])
    expect(out.totalDocuments).toBe(0)
    expect(out.participants).toEqual([])
  })
})

describe('buildDocumentShelf — 교차 합치성 (불변식 6, 무결성)', () => {
  it('totalDocuments == Σ group.count == Σ docs.length (그룹핑에서 유실·중복 없음)', () => {
    const rows: ShelfDocRow[] = [
      row('d1', 'p1', 'A', 'application_form', 'a.pdf', '2026-08-01T09:00:00Z'),
      row('d2', 'p2', 'B', 'consent_form', 'b.pdf', '2026-08-02T09:00:00Z'),
      row('d3', 'p2', 'B', 'other', 'c.pdf', '2026-08-03T09:00:00Z'),
      row('d4', 'p3', 'C', 'mystery', 'd.pdf', '2026-08-04T09:00:00Z'),
    ]
    const out = buildDocumentShelf(rows)
    const byCount = out.participants.reduce((s, p) => s + p.count, 0)
    const byDocs = out.participants.reduce((s, p) => s + p.docs.length, 0)
    expect(out.totalDocuments).toBe(4)
    expect(byCount).toBe(out.totalDocuments)
    expect(byDocs).toBe(out.totalDocuments)
  })
})
