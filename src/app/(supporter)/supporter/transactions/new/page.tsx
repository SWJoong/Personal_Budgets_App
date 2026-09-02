import { redirect } from 'next/navigation'

/**
 * (D3) 무맥락 지출 등록 폼은 성립하지 않는다(§1) — 실제 지출폼은 supporter/[participantId]/transactions/new
 * (당사자 컨텍스트 필수). 여기로 온 사람은 먼저 당사자를 고르도록 org 거래장부(A1)로 리다이렉트한다.
 */
export default async function NewTransactionRedirect() {
  redirect('/supporter/transactions')
}
