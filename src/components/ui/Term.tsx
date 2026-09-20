import { EasyTerm } from '@/components/ui/EasyTerm'
import { easyTerm } from '@/utils/easyTerms'

/**
 * <Term formal="이용계획" /> — 쉬운 용어 사전(easyTerms) 기반 편의 래퍼.
 * 사전에 easy 매핑이 있으면 EasyTerm(토글 시 쉬운 말) 으로, 없으면 formal 원문 그대로 렌더한다.
 * easy 문자열을 화면마다 다시 쓰지 않고 사전 한 곳에서 관리(일관성). 설계: docs/release/14 P1.
 *
 * 커스텀 easy 를 직접 주고 싶으면 easy prop 으로 사전보다 우선 지정 가능(예: 문맥별 다른 쉬운 말).
 */
export function Term({
  formal,
  easy,
  className,
}: {
  formal: string
  easy?: string
  className?: string
}) {
  const resolved = easy ?? easyTerm(formal)
  if (!resolved) return <>{formal}</>
  return <EasyTerm formal={formal} easy={resolved} className={className} />
}
