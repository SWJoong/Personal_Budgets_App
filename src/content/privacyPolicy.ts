/**
 * 개인정보 처리방침 — 콘텐츠(사실 데이터). `/privacy`(전문)·`/privacy/easy`(쉬운 말) 공용 단일 출처.
 * 근거: docs/release/11-p0-privacy-compliance.md §2 (코드 스키마 기준 인벤토리) · 10-disability-law-a11y-eval.md.
 *
 * ⚠️ DRAFT — 기관(수행기관/서울시) 검토·확정 전. 확정 전까지 PRIVACY_DRAFT=true 유지
 *    → 페이지 상단 초안 배너 + 내비게이션 미연결(미확정 법적 문구의 실사용자 노출 차단).
 * ★확정 시 할 일: (1) 아래 [기관결정]/[확인필요] 값 확정 (2) PRIVACY_DRAFT=false
 *    (3) 더보기·로그인 등에 링크 추가 (4) EFFECTIVE_DATE 기입.
 */

/** 초안 상태 플래그 — 기관 확정 전 true. 페이지 초안 배너·내비 미연결의 단일 스위치. */
export const PRIVACY_DRAFT = true
/** [기관결정] 확정 시 시행일 기입(예: '2026-00-00'). 초안 중에는 빈 문자열. */
export const EFFECTIVE_DATE = ''

export interface DataCategory {
  /** 구분 */
  label: string
  /** 세부 항목 */
  items: string
  /** 민감정보(개인정보보호법 §23) 여부 — 별도 동의·강화 보호 대상 */
  sensitive?: boolean
  /** 확인/결정 대기 표시 */
  note?: string
}

/** 수집하는 개인정보 — supabase/seoul 스키마 실측(11 §2-1). */
export const DATA_CATEGORIES: DataCategory[] = [
  { label: '일반 개인정보', items: '이름, 이메일, 생년월일' },
  {
    label: '건강·장애 정보(민감정보)',
    items: '장애 유형·정도, 중복·후천 장애, 지원등급, 삶에서 겪는 어려움(자기서술)',
    sensitive: true,
  },
  { label: '고유식별정보', items: '고유식별정보 처리 동의 항목', note: '[확인필요] 실제 수집·보관 여부·위치' },
  { label: '대리인 정보', items: '대리인(보호자) 성명 등' },
  { label: '지출·금융 정보', items: '지출 내역·금액, 영수증 이미지, 예산 배정·정산' },
  { label: '사진', items: '활동 사진' },
  { label: '신청·행정 기록', items: '신청서·서류, 통지, 모니터링·평가, 이의신청' },
  { label: '자동 수집', items: '접속·이용 기록, 서비스 이용 분석' },
  { label: '위치', items: '지출처·장소 검색어' },
]

export interface Processor {
  /** 수탁자(받는 곳) */
  name: string
  /** 위탁 업무 */
  purpose: string
  /** 처리 위치 */
  location: string
  /** 국외이전(개인정보보호법 §28의8) 해당 여부 — 'unknown'=리전/수집범위 미확정(단정 금지) */
  overseas: 'yes' | 'no' | 'unknown'
  /** 보호 조치 */
  safeguard: string
  /** 확인/결정 대기 표시 */
  note?: string
}

/** 처리위탁·국외이전 현황 — src/utils/ai.ts·ocr.ts·geocode.ts·package.json·.env 실측(11 §2-4). */
export const PROCESSORS: Processor[] = [
  {
    name: 'Supabase',
    purpose: '데이터베이스·로그인·파일 저장',
    location: '서버 리전 [확인필요]',
    overseas: 'unknown', // 리전 미확정 → 국외이전 '아니오' 단정 금지(리전 국외 시 §28의8 누락 위험)
    safeguard: '접근권한 분리(RLS)·비공개 저장소·암호화 전송',
    note: '리전이 국외이면 국외이전 대상 — 확인 후 반영',
  },
  {
    name: 'Anthropic (Claude)',
    purpose: '영수증 자동 인식(OCR)·기록 요약·활동 제안',
    location: '미국',
    overseas: 'yes',
    safeguard: '이름·기관명 가명처리(대체) 후 전송, 대응표 미저장',
  },
  {
    name: 'Vercel',
    purpose: '앱 호스팅·이용/성능 분석',
    location: '미국(추정)',
    overseas: 'yes',
    safeguard: '수집 범위 [확인필요]',
  },
  {
    name: 'Kakao',
    purpose: '지출처 장소 검색',
    location: '국내',
    overseas: 'no',
    safeguard: '장소 검색어만 전송(참여자 식별정보 미전송)',
  },
]

/** 보유기간 근거값 — seoul_consent_records.retention_period_note 기본값. [기관결정] 정확 보존연한. */
export const RETENTION_NOTE = '서울형 장애인 개인예산제 시범사업 및 성과평가에 필요한 기간'

/** 정보주체의 권리(개인정보보호법 §35~§37) — 쉬운 말 겸용. */
export const RIGHTS: string[] = [
  '내 정보를 볼 수 있어요(열람).',
  '틀린 정보를 고칠 수 있어요(정정).',
  '내 정보를 지워 달라고 할 수 있어요(삭제).',
  '정보 처리를 멈춰 달라고 할 수 있어요(처리정지).',
  '동의를 취소할 수 있어요(철회).',
]
