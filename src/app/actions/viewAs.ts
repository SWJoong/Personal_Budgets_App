'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { assertAdmin } from '@/utils/supabase/staff'
import { VIEW_AS_ID_COOKIE, VIEW_AS_NAME_COOKIE, getViewAsParticipantId } from '@/utils/supabase/viewAs'

const COOKIE_OPTS = {
  path: '/',
  httpOnly: false, // 배너/FAB(클라이언트)가 즉시 상태를 읽어야 함 — 위조는 서버 admin 검증으로 무력화
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 8, // 8시간이면 QA 세션에 충분, 무기한 방치 방지
}

/**
 * 관리자 둘러보기 시작 — 대상 당사자로 view-as 쿠키를 설정하고 당사자 홈(/)으로 보낸다.
 * 관리자만 호출 가능(assertAdmin). 존재하지 않는 당사자면 아무것도 하지 않고 관리자 목록으로.
 */
export async function enterParticipantView(participantId: string): Promise<void> {
  await assertAdmin() // 관리자가 아니면 throw — 진입점 자체가 관리자 UI 이므로 정상 경로에선 안 걸림

  const supabase = await createClient()
  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .eq('id', participantId)
    .maybeSingle()

  if (!participant) redirect('/admin/participants')

  const store = await cookies()
  store.set(VIEW_AS_ID_COOKIE, participant.id, COOKIE_OPTS)
  // 이름은 raw 로 저장한다 — Next 쿠키 스토어가 Set-Cookie 직렬화 시 한 번 인코딩하므로, 여기서
  // encodeURIComponent 를 또 걸면 이중 인코딩되어 배너에 "%EC%..." 로 새어 나온다.
  store.set(VIEW_AS_NAME_COOKIE, participant.name ?? '이름 미등록', COOKIE_OPTS)

  redirect('/')
}

/**
 * 관리자 둘러보기 종료 — view-as 쿠키를 지우고 관리자 화면으로 돌아간다.
 * (일반 당사자·실무자 세션에는 애초에 쿠키가 없으므로 무해하다.)
 */
export async function exitParticipantView(): Promise<void> {
  const id = await getViewAsParticipantId()
  const store = await cookies()
  store.delete(VIEW_AS_ID_COOKIE)
  store.delete(VIEW_AS_NAME_COOKIE)
  redirect(id ? `/admin/participants/${id}` : '/admin/participants')
}
