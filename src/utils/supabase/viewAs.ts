import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { VIEW_AS_ID_COOKIE, VIEW_AS_NAME_COOKIE } from '@/utils/viewAsCookies'

// 쿠키 이름은 클라이언트도 쓰므로 별도 모듈에 두고 여기서 재export 한다(서버 전용 viewAs.ts 를
// 클라이언트가 import 하지 않도록).
export { VIEW_AS_ID_COOKIE, VIEW_AS_NAME_COOKIE }

/**
 * 관리자 '둘러보기(view-as)' 모드 — 관리자가 특정 당사자를 골라 그 사람의 당사자 화면 전체를
 * 읽기전용으로 순회한다. 설계: 사용자 결정 2026-09-07(관리자 구글 계정 3역할 접근).
 *
 * 저장 방식: 쿠키 두 개.
 *  - view_as_participant = 대상 participants.id (서버가 해석에 쓰는 값)
 *  - view_as_name        = 대상 이름(배너 표시용, URI 인코딩)
 * 둘 다 httpOnly 가 아니다 — 배너/FAB(클라이언트 컴포넌트)가 즉시 상태를 알아야 하기 때문.
 *
 * ★보안: 쿠키만으로는 아무 권한도 안 생긴다. resolveViewAs() 는 로그인 사용자가 실제 admin
 * (profiles.role='admin') 일 때만 active 로 판정한다. 비관리자가 쿠키를 위조해도 서버는 무시하고
 * 자기 데이터만 보여준다. 또 admin RLS 는 이미 전 당사자 행을 읽을 수 있으므로(관리자 대시보드와
 * 동일) 이 모드는 '권한 확장'이 아니라 '표시 대상 전환'이다.
 */

/** 쿠키에 담긴 view-as 대상 participantId (검증 전 raw 값). 없으면 null. */
export async function getViewAsParticipantId(): Promise<string | null> {
  try {
    const store = await cookies()
    return store.get(VIEW_AS_ID_COOKIE)?.value ?? null
  } catch {
    // 요청 스코프 밖(단위 테스트 등)에서 cookies() 는 throw 한다 → view-as 아님으로 취급.
    // 실제 서버액션·페이지는 항상 요청 스코프 안이라 가드는 정상 작동한다.
    return null
  }
}

export interface ViewAsContext {
  /** 로그인 사용자가 admin 이고 실제 미리보기 중인가. */
  active: boolean
  /** active 일 때만 유효한 대상 participants.id. */
  participantId: string | null
}

/**
 * view-as 활성 여부를 '관리자 검증까지' 마쳐서 돌려준다.
 * 쿠키가 있어도 로그인 사용자가 admin 이 아니면 무효(active:false).
 */
export async function resolveViewAs(): Promise<ViewAsContext> {
  const id = await getViewAsParticipantId()
  if (!id) return { active: false, participantId: null }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { active: false, participantId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') return { active: false, participantId: null }
  return { active: true, participantId: id }
}

/**
 * 참여자 화면 뮤테이션 서버액션용 읽기전용 가드.
 * 미리보기 중이면 사용자 친화적 에러 문구를, 아니면 null 을 돌려준다.
 * 액션 첫머리(로그인 확인 직후)에서 `const blocked = await viewAsWriteBlock(); if (blocked) return { error: blocked }`.
 */
export async function viewAsWriteBlock(): Promise<string | null> {
  const { active } = await resolveViewAs()
  return active
    ? '지금은 관리자 미리보기 중이에요. 저장하려면 먼저 “미리보기 나가기”를 눌러 주세요.'
    : null
}
