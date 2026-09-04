'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import type { ShelfDocRow } from '@/utils/documentShelf'

/**
 * 서류 보관함(B2) 나열·열람 — 설계 Plan&Source/goala_documents_shelf_W.md §2. 열람 우선(업로드는 스코프 밖).
 *
 * ★보안 계약: documents signed URL 은 admin(서비스롤)이라 Storage RLS 를 우회한다. 그래서 나열·인가는
 *   반드시 createClient()(세션·RLS)로 하고, admin 은 RLS 가 이미 인가한 경로에 '서명만' 한다.
 *   admin 클라이언트로 행을 조회해 인가를 대신하면 남의 당사자 서류가 샌다 — 금지(application.ts 정본).
 */

/** 담당 당사자 전원 서류 나열 — 무인자, RLS(seoul_can_access)가 범위를 정한다(admin=전체·supporter=담당분). */
export async function getDocumentShelf(): Promise<{ error?: string; rows: ShelfDocRow[] }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { rows: [] }

  // ★RLS 로 스코프된 행만 — admin 클라이언트 아님.
  const { data: docs, error } = await supabase
    .from('seoul_application_documents')
    .select('id, participant_id, doc_type, file_name, note, created_at')
    .order('created_at', { ascending: false })
  if (error) return { error: error.message, rows: [] }

  const list = (docs ?? []) as {
    id: string
    participant_id: string
    doc_type: string
    file_name: string
    note: string | null
    created_at: string
  }[]
  if (list.length === 0) return { rows: [] }

  // 이름도 RLS(세션) 로 — 볼 수 있는 서류의 당사자만 조회된다.
  const ids = [...new Set(list.map((d) => d.participant_id))]
  const { data: parts } = await supabase.from('participants').select('id, name').in('id', ids)
  const nameById = new Map<string, string>()
  for (const p of (parts ?? []) as { id: string; name: string | null }[]) {
    nameById.set(p.id, p.name ?? '이름 없음')
  }

  const rows: ShelfDocRow[] = list.map((d) => ({
    id: d.id,
    participantId: d.participant_id,
    participantName: nameById.get(d.participant_id) ?? '이름 없음',
    docType: d.doc_type,
    fileName: d.file_name,
    note: d.note,
    createdAt: d.created_at,
  }))
  return { rows }
}

/**
 * 서류 열람 URL — RLS 조회로 '인가'한 뒤에만 admin 서명(application.ts:339 정본 복제).
 * createClient() 로 storage_path 를 찾으면 = RLS 가 볼 수 있는 행 = 열람 권한 있음. 그 다음에만 admin 서명.
 */
export async function getDocumentSignedUrl(
  documentId: string,
): Promise<{ error?: string; url: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', url: null }

  const { data: doc } = await supabase
    .from('seoul_application_documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle()
  if (!doc) return { error: '볼 수 없는 서류예요.', url: null }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('documents')
    .createSignedUrl((doc as { storage_path: string }).storage_path, 3600)
  if (error) return { error: error.message, url: null }
  return { url: data.signedUrl }
}
