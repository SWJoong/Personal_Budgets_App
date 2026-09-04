import type { AnchorHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { buttonClasses, type ButtonVariant, type ButtonSize } from './buttonStyles'

/**
 * LinkButton — 링크형 액션 프리미티브(Button 의 형제). <a>/next-link 로 렌더하되
 * Button 과 '동일 토큰'(buttonClasses)을 공유해 시각 parity 를 유지한다.
 * 서버 컴포넌트(budgets/[id] 등)의 네비게이션 primary 액션에 쓴다(Button 은 <button> 전용).
 * 스모크: src/components/ui/LinkButton.test.tsx.
 */

export interface LinkButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  iconOnly?: boolean
  children?: ReactNode
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  className = '',
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link href={href} className={`${buttonClasses(variant, size, iconOnly)} ${className}`.trim()} {...rest}>
      {children}
    </Link>
  )
}
