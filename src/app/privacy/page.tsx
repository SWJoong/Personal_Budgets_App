import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import {
  PRIVACY_DRAFT,
  EFFECTIVE_DATE,
  DATA_CATEGORIES,
  PROCESSORS,
  RETENTION_NOTE,
  RIGHTS,
} from '@/content/privacyPolicy'

/**
 * 개인정보 처리방침(전문) — 최상위 라우트(인증 밖: 누구나 열람 가능해야 하는 법적 문서).
 * 설계: docs/release/11-p0-privacy-compliance.md. 쉬운 말판은 /privacy/easy.
 * ★DRAFT: PRIVACY_DRAFT=true 인 동안 상단 초안 배너 + 내비 미연결(콘텐츠 모듈에서 스위치).
 * 접근성: skip-link(루트 레이아웃) → main#main-content, PageHeader(banner), Card heading 위계,
 *         처리위탁은 caption+th scope 표(KWCAG 5.3.1), 가로 스크롤은 컨테이너 안에서만.
 */

export const metadata: Metadata = {
  title: '개인정보 처리방침',
  description: '서울형 개인예산제 개인정보 처리방침',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PageHeader
        title="개인정보 처리방침"
        backHref="/"
        action={
          <Link
            href="/privacy/easy"
            className="inline-flex min-h-11 items-center rounded-xl bg-muted px-3 text-sm font-bold text-foreground hover:bg-muted-hover"
          >
            쉬운 말로 보기
          </Link>
        }
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 leading-relaxed"
      >
        {PRIVACY_DRAFT && (
          <Card variant="warning" title="초안 안내" className="mb-6" role="note">
            <p>
              이 개인정보 처리방침은 <strong>초안</strong>입니다. 기관 검토·확정 전이라
              법적 효력이 없으며, 확정되면 안내드립니다.
            </p>
          </Card>
        )}

        <p className="mb-6 text-muted-foreground break-keep">
          서울형 장애인 개인예산제 서비스(이하 &lsquo;서비스&rsquo;)는 이용자의 개인정보를 소중히
          다루며, 개인정보 보호법 등 관련 법령을 준수합니다. 본 방침은 서비스가 어떤 정보를 왜
          수집하고 어떻게 지키는지 알려 드립니다.
        </p>

        <div className="flex flex-col gap-4">
          {/* 1. 수집 항목 */}
          <Card as="section" title="1. 수집하는 개인정보">
            <dl className="flex flex-col gap-3">
              {DATA_CATEGORIES.map((c) => (
                <div key={c.label}>
                  <dt className="font-bold text-foreground">
                    {c.label}
                    {c.sensitive && (
                      <span className="ml-2 rounded-md bg-warning-bg px-1.5 py-0.5 text-xs font-bold text-warning-fg">
                        민감정보
                      </span>
                    )}
                  </dt>
                  <dd className="text-muted-foreground break-keep">
                    {c.items}
                    {c.note && <span className="ml-1 text-warning-fg">· {c.note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* 2. 목적 */}
          <Card as="section" title="2. 처리 목적">
            <p className="text-muted-foreground break-keep">
              서울형 장애인 개인예산제의 신청·선정, 이용계획 수립, 지출 관리·정산, 모니터링·평가,
              성과평가 및 이용자 본인의 예산 관리 지원을 위해 개인정보를 처리합니다.
            </p>
          </Card>

          {/* 3. 보유·파기 */}
          <Card as="section" title="3. 보유 및 파기">
            <p className="text-muted-foreground break-keep">
              보유기간: <strong className="text-foreground">{RETENTION_NOTE}</strong>. 처리 목적을
              달성하면 지체 없이 파기하며, 법령·사업지침상 보존의무가 있는 경우 그 기간 동안 보관합니다.
            </p>
            {PRIVACY_DRAFT && (
              <p className="mt-2 text-sm text-warning-fg">· 정확한 보존연한은 확정 전입니다.</p>
            )}
          </Card>

          {/* 4. 처리위탁·국외이전 — 접근성 있는 표 */}
          <Card as="section" title="4. 처리위탁 및 국외이전">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">개인정보 처리위탁 및 국외이전 현황</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="py-2 pr-3 font-bold">받는 곳</th>
                    <th scope="col" className="py-2 pr-3 font-bold">하는 일</th>
                    <th scope="col" className="py-2 pr-3 font-bold">처리 위치</th>
                    <th scope="col" className="py-2 pr-3 font-bold">국외 이전</th>
                    <th scope="col" className="py-2 font-bold">보호 조치</th>
                  </tr>
                </thead>
                <tbody>
                  {PROCESSORS.map((p) => (
                    <tr key={p.name} className="border-b border-border align-top">
                      <th scope="row" className="py-2 pr-3 font-bold text-foreground whitespace-nowrap">
                        {p.name}
                      </th>
                      <td className="py-2 pr-3 text-muted-foreground break-keep">{p.purpose}</td>
                      <td className="py-2 pr-3 text-muted-foreground break-keep">{p.location}</td>
                      <td className="py-2 pr-3 font-bold">
                        {p.overseas === 'yes' ? (
                          <span className="text-warning-fg">예</span>
                        ) : p.overseas === 'unknown' ? (
                          <span className="text-warning-fg">확인 중</span>
                        ) : (
                          <span className="text-muted-foreground">아니오</span>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground break-keep">
                        {p.safeguard}
                        {p.note && <span className="block text-warning-fg">· {p.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground break-keep">
              영수증 자동 인식(OCR)은 영수증 이미지 원본이 전송될 수 있습니다. 이름·기관명이 포함될 수
              있는 텍스트는 전송 전에 가명처리(대체)합니다. 인공지능 기능을 원하지 않으면 직접 입력으로
              대체할 수 있습니다.
            </p>
          </Card>

          {/* 5. 권리 */}
          <Card as="section" title="5. 정보주체의 권리">
            <ul className="flex flex-col gap-1.5 text-muted-foreground">
              {RIGHTS.map((r) => (
                <li key={r} className="break-keep">• {r}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground break-keep">
              권리 행사는 담당 실무자 또는 기관에 요청할 수 있습니다.
            </p>
          </Card>

          {/* 6. 안전조치 */}
          <Card as="section" title="6. 안전조치">
            <p className="text-muted-foreground break-keep">
              접근권한 분리(이용자는 본인 정보만 열람), 파일의 비공개 저장 및 서명된 임시 링크(signed URL),
              암호화 전송(HTTPS), 인공지능 전송 전 가명처리, 관리자만 열람 가능한 접근 기록을 적용합니다.
            </p>
          </Card>

          {/* 7. 문의 */}
          <Card as="section" variant="muted" title="7. 문의처">
            <p className="text-muted-foreground break-keep">
              개인정보 관련 문의는 담당 실무자 또는 수행기관에 연락해 주세요.
              {PRIVACY_DRAFT && <span className="text-warning-fg"> (연락처는 확정 전입니다.)</span>}
            </p>
          </Card>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {EFFECTIVE_DATE ? `시행일: ${EFFECTIVE_DATE}` : '시행일: 확정 전(초안)'}
        </p>
      </main>
    </div>
  )
}
