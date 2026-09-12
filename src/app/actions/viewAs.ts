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

/**
 * 슈퍼관리자 역할 화면 전환 — 우측 상단 전환기(SuperAdminSwitcher)의 서버 진입점.
 * 설계: Plan&Source/goala_balance_widget_roleswitch_W.md §2-1. 계약: SuperAdminSwitcher.test.tsx.
 *
 * ★안전: 권한 확장이 아니라 '표시 대상 전환'이다. 슈퍼관리자는 이미 admin 역할이라 /admin·/supporter
 *   (requireStaff 통과)·당사자(view-as) 화면에 도달 가능. 이 액션은 그 사이를 오갈 뿐이며 assertAdmin
 *   으로 관리자만 호출할 수 있다(비관리자가 UI 를 위조해 호출해도 여기서 throw).
 *  - 'admin'/'supporter': view-as 쿠키를 지우고 해당 스태프 화면으로.
 *  - 'participant': 첫 당사자(이름순)로 view-as 쿠키를 세팅하고 당사자 홈(/)으로(0명이면 관리자 목록).
 */
export async function superAdminSwitch(target: 'admin' | 'supporter' | 'participant'): Promise<void> {
  await assertAdmin() // 슈퍼관리자는 admin 역할 — 아니면 throw

  if (target === 'admin' || target === 'supporter') {
    const store = await cookies()
    store.delete(VIEW_AS_ID_COOKIE)
    store.delete(VIEW_AS_NAME_COOKIE)
    redirect(target === 'admin' ? '/admin' : '/supporter')
  }

  // target === 'participant' — enterParticipantView 와 동일한 쿠키 패턴으로 첫 당사자 미리보기 진입
  const supabase = await createClient()
  const { data: participant } = await supabase
    .from('participants')
    .select('id, name')
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!participant) redirect('/admin/participants')

  const store = await cookies()
  store.set(VIEW_AS_ID_COOKIE, participant.id, COOKIE_OPTS)
  // 이름은 raw 로 저장(Next 쿠키 스토어가 직렬화 시 한 번 인코딩 — 이중 인코딩 방지, enterParticipantView 참조).
  store.set(VIEW_AS_NAME_COOKIE, participant.name ?? '이름 미등록', COOKIE_OPTS)

  redirect('/')
}
