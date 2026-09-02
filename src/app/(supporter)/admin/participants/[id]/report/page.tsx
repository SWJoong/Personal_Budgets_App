import { redirect } from 'next/navigation'

/**
 * (D2) admin 월간 보고서 = supporter/[participantId]/report 와 동일 기능 중복(§1). 정본으로 리다이렉트한다.
 * 별도 화면을 두지 않고 canonical 경로로 포워딩(관리자도 같은 보고서를 본다). 대상 화면이 스태프 권한을 건다.
 */
export default async function AdminParticipantReportRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/supporter/${id}/report`)
}
