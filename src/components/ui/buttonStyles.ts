/**
 * Button/LinkButton 공유 토큰 — variant/size className 단일 진실원천.
 * <button>(Button)과 <a>/next-link(LinkButton)가 '동일 토큰'을 공유해 시각 parity 를 보장한다.
 * 전부 P2 시맨틱 토큰(raw 팔레트 0). 색 교체는 html.dark/high-contrast/yellow 가 토큰만 바꿔 처리.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'positive' | 'warning'
export type ButtonSize = 'sm' | 'md'

export const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-card text-foreground ring-1 ring-border hover:bg-muted-hover',
  ghost: 'bg-transparent text-foreground hover:bg-muted-hover',
  danger: 'bg-danger text-danger-foreground hover:bg-danger-hover',
  positive: 'bg-positive text-positive-foreground hover:bg-positive-hover',
  warning: 'bg-warning text-warning-foreground hover:bg-warning-hover',
}

export const BUTTON_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3 text-sm',
  md: 'min-h-[44px] px-4 text-base',
}

const BUTTON_BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100'

/** variant/size(+iconOnly) → 공통 className. Button 과 LinkButton 이 동일 토큰 공유. */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  iconOnly = false
): string {
  const sizeClass = iconOnly ? 'min-h-[44px] min-w-[44px] px-0' : BUTTON_SIZE_CLASS[size]
  return `${BUTTON_BASE_CLASS} ${sizeClass} ${BUTTON_VARIANT_CLASS[variant]}`
}
