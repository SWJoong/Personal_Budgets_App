'use client'

import { Modal } from '@/components/ui/Modal'

interface Props {
  src: string
  alt?: string
  onClose: () => void
}

export default function ImageLightbox({ src, alt, onClose }: Props) {
  // 전체화면 이미지 뷰어. Modal 프리미티브로 role=dialog·포커스 트랩/복원·Esc·scroll-lock 확보.
  // 흰 카드 대신 투명 패널(검은 배경 위 이미지 중앙 배치)로 override.
  return (
    <Modal
      open
      onClose={onClose}
      label={alt ?? '사진 크게 보기'}
      containerClassName=""
      overlayClassName="bg-black/90"
      panelClassName="w-full h-full flex items-center justify-center p-4"
    >
      {/* 배경(이미지 밖) 탭 → 닫기. 패널이 뷰포트를 덮어 Modal 오버레이가 가려지므로 패널 안에 복원.
          이미지의 형제로 두어(자손 아님) 이미지 클릭은 이 레이어로 전파되지 않는다 → stopPropagation 불필요. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-sidebar-strong/10 hover:bg-sidebar-strong/20 flex items-center justify-center text-sidebar-strong text-xl font-bold transition-colors"
        aria-label="닫기"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL(임의 도메인) 라이트박스 원본 표시, next/image 최적화 부적합 */}
      <img
        src={src}
        alt={alt ?? '사진'}
        className="relative max-w-[90vw] max-h-[90dvh] object-contain rounded-xl shadow-2xl"
      />
    </Modal>
  )
}
