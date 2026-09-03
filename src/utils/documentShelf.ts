/**
 * 서류 보관함 집계 — supporter/documents(B2). 계약: src/utils/documentShelf.test.ts.
 * 설계: Plan&Source/goala_documents_shelf_W.md. orgLedger.ts 형제(순수 집계).
 *
 * ★스코핑: 이 함수는 "보이는 행"만 집계한다 — documents 인가는 RLS(seoul_can_access) + 나열 액션의
 *   createClient() 조회가 담당(application.ts 정본). 여기 들어온 rows 는 이미 RLS 스코프된 것뿐,
 *   함수는 스코프를 넓히지 않는다. signed URL 은 이 집계 밖(RLS 인가된 경로에만 admin 발급). 순수·결정성.
 */

export interface ShelfDocRow {
  id: string
  participantId: string
  participantName: string
  docType: string
  fileName: string
  note: string | null
  createdAt: string
}

export interface ShelfDoc {
  id: string
  docType: string
  docTypeLabel: string
  fileName: string
  note: string | null
  createdAt: string
}

export interface ShelfParticipant {
  participantId: string
  participantName: string
  count: number
  latestDate: string | null
  docs: ShelfDoc[]
}

export interface DocumentShelf {
  totalDocuments: number
  participants: ShelfParticipant[]
}

const DOC_TYPE_LABEL: Record<string, string> = {
  application_form: '신청서',
  consent_form: '동의서',
  other: '기타',
}

/** 표준 3종은 한글 라벨, 미지값은 '기타'로 안전 강제(누락·크래시 없음). */
export function documentTypeLabel(docType: string): string {
  return DOC_TYPE_LABEL[docType] ?? '기타'
}

/**
 * 당사자별 서류 그룹 집계. 불변식(골든):
 * 1) participantId 그룹핑(count·이름 대표값·docs) 2) docType 라벨(미지→기타) 3) latestDate=그룹 내 최신 createdAt
 * 4) participants latestDate 내림차순→동률 이름 오름차순 / docs createdAt 내림차순→동률 fileName 오름차순
 * 5) 빈 입력→0·빈 그룹 6) totalDocuments == Σ count == Σ docs.length(유실·중복 없음).
 */
export function buildDocumentShelf(rows: ShelfDocRow[]): DocumentShelf {
  const groups = new Map<string, ShelfParticipant & { _latestMs: number }>()

  for (const r of rows) {
    let g = groups.get(r.participantId)
    if (!g) {
      g = {
        participantId: r.participantId,
        participantName: r.participantName,
        count: 0,
        latestDate: null,
        docs: [],
        _latestMs: -Infinity,
      }
      groups.set(r.participantId, g)
    }
    g.count += 1
    g.docs.push({
      id: r.id,
      docType: r.docType,
      docTypeLabel: documentTypeLabel(r.docType),
      fileName: r.fileName,
      note: r.note,
      createdAt: r.createdAt,
    })
    const ms = Date.parse(r.createdAt)
    if (!Number.isNaN(ms) && ms > g._latestMs) {
      g._latestMs = ms
      g.latestDate = r.createdAt
    }
  }

  const participants: ShelfParticipant[] = [...groups.values()]
    .map((g) => ({
      participantId: g.participantId,
      participantName: g.participantName,
      count: g.count,
      latestDate: g.latestDate,
      // 그룹 내 docs: createdAt 내림차순 → 동률 fileName 오름차순.
      docs: [...g.docs].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.fileName.localeCompare(b.fileName),
      ),
    }))
    // participants: latestDate 내림차순 → 동률 이름 오름차순.
    .sort((a, b) => {
      const am = a.latestDate ? Date.parse(a.latestDate) : -Infinity
      const bm = b.latestDate ? Date.parse(b.latestDate) : -Infinity
      return bm - am || a.participantName.localeCompare(b.participantName)
    })

  return { totalDocuments: rows.length, participants }
}
