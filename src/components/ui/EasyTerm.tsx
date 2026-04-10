/**
 * EasyTerm — 쉬운 용어 on/off 기능
 *
 * globals.css의 .term-formal / .term-easy CSS 클래스를 활용합니다.
 * html.easy-terms 클래스가 있을 때 easy 텍스트가 표시되고, formal 텍스트는 숨겨집니다.
 */
export function EasyTerm({
  formal,
  easy,
  className,
}: {
  formal: string
  easy: string
  className?: string
}) {
  return (
    <>
      <span className={`term-formal${className ? ` ${className}` : ''}`}>{formal}</span>
      <span className={`term-easy${className ? ` ${className}` : ''}`}>{easy}</span>
    </>
  )
}
