'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { assertStaff } from '@/utils/supabase/staff'
import { friendlyDbError } from '@/utils/supabase/errors'
import { auditLog } from '@/utils/audit'
import { revalidatePath } from 'next/cache'
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

/** MIME → 확장자(신청서 상세 uploadApplicationDocument 의 DOC_MIME_EXT 와 동일). 미지 타입은 파일명 확장자로 폴백. */
const SHELF_MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'application/haansofthwp': 'hwp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

/**
 * 서류함 직접 업로드 (실무자 전용) — 설계 §2 A3. uploadApplicationDocument 패턴 복제.
 *
 * ★application_id 는 NOT NULL(03) 이라, 참여자 단위 서류함 업로드는 서버가 참여자의 최신 신청
 *   (seoul_applications)을 자동 해결해 그 id 로 넣는다(스키마 변경 회피). 신청이 없으면 파일도
 *   행도 만들지 않고 거부한다 — 첫 서류는 여전히 신청서 상세에서.
 * ★경로 첫 세그먼트 = 참여자 id — 06_storage.seoul_storage_owner()가 소유자를 이 세그먼트로
 *   판별하므로 반드시 '{participantId}/shelf/...' 로 둔다(경로 위조 방지). 인가는 세션(RLS) insert
 *   가 담당하고 admin 은 저장만 한다(보안 계약).
 */
export async function uploadShelfDocument(input: {
  participantId: string
  docType: 'application_form' | 'consent_form' | 'other'
  fileName: string
  base64: string
  mimeType?: string
  note?: string
}) {
  try {
    const { supabase, user } = await assertStaff()

    // NOT NULL application_id 를 최신 신청으로 자동 해결 — 없으면 파일·행 모두 만들지 않고 거부.
    const { data: app } = await supabase
      .from('seoul_applications')
      .select('id')
      .eq('participant_id', input.participantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!app) return { error: '이 당사자의 신청 정보가 없어 서류를 올릴 수 없어요.' }

    const ext = SHELF_MIME_EXT[input.mimeType || ''] || input.fileName.split('.').pop() || 'bin'
    const path = `${input.participantId}/shelf/${crypto.randomUUID()}.${ext}`

    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(path, Buffer.from(input.base64, 'base64'), {
        contentType: input.mimeType || 'application/octet-stream',
        upsert: false,
      })
    if (uploadError) return { error: `파일 저장 실패: ${uploadError.message}` }

    // 인가는 세션 클라이언트(RLS staff-write) insert 가 담당 — admin 아님.
    const { data, error } = await supabase
      .from('seoul_application_documents')
      .insert({
        application_id: (app as { id: string }).id,
        participant_id: input.participantId,
        doc_type: input.docType,
        file_name: input.fileName,
        storage_path: path,
        note: input.note?.trim() || null,
        uploaded_by: user.id,
      })
      .select('id')
      .maybeSingle()

    if (error || !data) {
      // 어떤 행에서도 참조되지 않는 파일이 버킷에 남는 것을 막는다(고아 롤백).
      await admin.storage.from('documents').remove([path])
      return { error: `서류 기록 실패: ${friendlyDbError(error)}` }
    }

    await auditLog(supabase, 'document.upload', {
      targetType: 'document',
      targetId: data.id as string,
      metadata: { participantId: input.participantId, docType: input.docType },
    })
    revalidatePath('/supporter/documents')
    return { success: true, documentId: data.id as string }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}

/**
 * 서류함 서류 삭제 (실무자 전용) — 설계 §2 A3.
 *
 * ★인가는 세션(RLS) 조회·삭제가 담당 — createClient()(assertStaff)로 볼 수 있는 행 = 담당 서류.
 *   조회에서 안 보이면(=담당 아님) 스토리지 파일도 건드리지 않는다. admin 은 이미 인가된 경로의
 *   파일 제거만 한다(보안 계약: admin 이 인가를 대신하지 않음).
 */
export async function deleteShelfDocument(documentId: string) {
  try {
    const { supabase } = await assertStaff()

    // RLS 로 볼 수 있는(=담당) 행만 — 안 보이면 삭제 거부(스토리지 미접촉).
    const { data: doc } = await supabase
      .from('seoul_application_documents')
      .select('storage_path, participant_id')
      .eq('id', documentId)
      .maybeSingle()
    if (!doc) return { error: '지울 수 없는 서류예요.' }

    const { storage_path, participant_id } = doc as { storage_path: string; participant_id: string }

    // 행 삭제도 세션 클라이언트(RLS 가 담당 범위를 강제).
    const { error } = await supabase.from('seoul_application_documents').delete().eq('id', documentId)
    if (error) return { error: friendlyDbError(error) }

    await createAdminClient().storage.from('documents').remove([storage_path])

    await auditLog(supabase, 'document.delete', {
      targetType: 'document',
      targetId: documentId,
      metadata: { participantId: participant_id },
    })
    revalidatePath('/supporter/documents')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '오류가 발생했습니다.' }
  }
}
