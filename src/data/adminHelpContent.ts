export interface AdminHelpItem {
  icon: string
  title: string
  desc: string
}

export interface AdminHelpPage {
  pageTitle: string
  items: AdminHelpItem[]
  storageNote?: boolean
}

export const ADMIN_HELP: Record<string, AdminHelpPage> = {
  dashboard: {
    pageTitle: '관리자 대시보드',
    items: [
      { icon: '📊', title: '요약 카드', desc: '등록된 당사자 수, 이번 달 총 지출, 미확인 영수증 건수를 한눈에 확인합니다.' },
      { icon: '⚠️', title: '주의 필요 항목', desc: '예산 잔액이 설정한 기준액 미만인 당사자를 자동으로 표시합니다. 당사자 설정에서 경보 기준액을 변경할 수 있습니다.' },
      { icon: '👁️', title: '실무자 뷰 전환', desc: '상단 토글에서 "실무자" 또는 "당사자"를 선택하면 해당 역할의 화면을 미리 볼 수 있습니다.' },
    ],
  },
  participants: {
    pageTitle: '당사자 관리',
    items: [
      { icon: '➕', title: '당사자 등록', desc: '"새 당사자 추가" 버튼으로 이름, 이메일, 연락처를 입력해 당사자를 등록합니다.' },
      { icon: '💳', title: '재원 설정', desc: '당사자 상세 페이지에서 재원(예: 활동지원급여, 자립생활비)을 추가하고 월 예산과 연간 예산을 설정합니다.' },
      { icon: '🔔', title: '경보 기준액', desc: '잔액이 이 금액 미만으로 떨어지면 대시보드에 경보가 표시됩니다.' },
    ],
  },
  review: {
    pageTitle: '영수증 검토 대기',
    items: [
      { icon: '📸', title: '미확인 영수증', desc: '당사자가 올린 영수증 중 아직 확인되지 않은 항목이 표시됩니다.' },
      { icon: '✅', title: '확정 처리', desc: '영수증을 확인하고 "확정" 처리하면 예산 잔액에서 해당 금액이 차감됩니다.' },
      { icon: '✏️', title: '내용 수정', desc: '금액, 날짜, 분류 등 잘못된 정보가 있으면 수정 후 확정할 수 있습니다.' },
    ],
  },
  transactions: {
    pageTitle: '회계/거래장부',
    items: [
      { icon: '📋', title: '거래 목록', desc: '날짜·당사자·분류·상태로 필터링할 수 있습니다. 항목 클릭 → 상세 수정 화면으로 이동합니다.' },
      { icon: '📤', title: 'CSV 가져오기', desc: '카카오뱅크 CSV 파일을 업로드하면 기존 거래와 자동 대조합니다. 미매칭 항목은 선택해서 일괄 등록할 수 있습니다.' },
      { icon: '🖨️', title: '인쇄/PDF', desc: '거래 상세 화면에서 "인쇄" 버튼을 누르면 영수증 이미지 포함 인쇄가 가능합니다.' },
      { icon: '🗺️', title: '지도 탭', desc: '장소 정보가 등록된 거래를 지도에서 확인할 수 있습니다. 거래 등록 시 "결제 장소"를 검색하면 자동으로 위치가 저장됩니다.' },
    ],
  },
  documents: {
    pageTitle: '증빙/서류 보관함',
    items: [
      { icon: '📁', title: '서류 업로드', desc: '계획서, 평가서, 동의서 등 각종 서류를 PDF 또는 이미지로 업로드해 보관합니다.' },
      { icon: '📝', title: 'SIS-A 작성', desc: '당사자별 지원요구척도(SIS-A)를 입력하면 표준점수, 지원요구지수, 백분위를 자동 계산합니다.' },
      { icon: '🖼️', title: 'SIS-A 이미지 저장·인쇄', desc: '결과 화면에서 "이미지 저장" 버튼을 누르면 PNG 파일로 저장됩니다. "인쇄" 버튼으로 출력할 수도 있습니다.' },
    ],
  },
  evaluations: {
    pageTitle: '계획과 평가',
    items: [
      { icon: '📋', title: '월별 평가 선택', desc: '당사자와 월을 선택하면 해당 월의 평가를 바로 작성하거나 이미 작성된 내용을 확인합니다.' },
      { icon: '🔀', title: '양식 선택', desc: 'PCP 4+1, 서울시형, 보건복지부형, 자체 양식 중 평가 목적에 맞는 양식을 선택합니다. 기저장된 내용과 다른 양식을 고르면 덮어쓰기 경고가 표시됩니다.' },
      { icon: '🤖', title: 'AI 자동 요약', desc: '저장 후 AI 버튼을 누르면 입력한 내용을 바탕으로 쉬운 말 요약과 다음 계획을 자동 생성합니다. OpenAI API 키가 필요합니다.' },
    ],
  },
  settings: {
    pageTitle: '시스템 설정',
    storageNote: true,
    items: [
      { icon: '🏢', title: '기관 정보', desc: '기관명과 기본 연락처를 설정합니다. 인쇄물 헤더에 표시됩니다.' },
      { icon: '📋', title: '평가 양식 기본값', desc: '새 평가 작성 시 기본으로 선택될 양식을 지정합니다. 각 평가에서 개별 변경이 가능합니다.' },
      { icon: '📦', title: '저장 용량', desc: 'Supabase 무료 티어는 1 GB 스토리지를 제공합니다. 영수증 이미지 평균 100~200 KB 기준으로 약 5,000~10,000장을 저장할 수 있습니다. 용량 확인: Supabase 대시보드 → Storage 섹션.' },
    ],
  },
}
