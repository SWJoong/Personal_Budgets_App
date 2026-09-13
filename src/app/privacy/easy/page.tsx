import type { Metadata } from 'next'
import EasyPrivacyClient from './EasyPrivacyClient'

/**
 * 개인정보 처리방침 — 쉬운 말판 라우트(당사자용). 메타데이터는 서버에서, TTS 상호작용은 클라이언트에서.
 * 전문판: /privacy. 설계: docs/release/11-p0-privacy-compliance.md §3.
 */

export const metadata: Metadata = {
  title: '개인정보 이야기 (쉬운 말)',
  description: '서울형 개인예산제 개인정보 안내 — 쉬운 말',
}

export default function EasyPrivacyPage() {
  return <EasyPrivacyClient />
}
