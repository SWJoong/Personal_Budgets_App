/**
 * TTS(음성 출력) 유틸리티 — Web Speech API 기반
 * 고대비/쉬운 말 모드 사용자를 위한 접근성 기능
 */
export function speak(text: string, rate = 0.85, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ko-KR'
  utterance.rate = rate
  utterance.pitch = 1.0
  // 재생 종료·중단 시 콜백(버튼의 재생상태 리셋용). 기존 호출부(2인자)는 영향 없음.
  if (onEnd) {
    utterance.onend = onEnd
    utterance.onerror = onEnd
  }
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
