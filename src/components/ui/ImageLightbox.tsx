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
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl font-bold transition-colors"
        aria-label="닫기"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL(임의 도메인) 라이트박스 원본 표시, next/image 최적화 부적합 */}
      <img
        src={src}
        alt={alt ?? '사진'}
        className="max-w-[90vw] max-h-[90dvh] object-contain rounded-xl shadow-2xl"
      />
    </Modal>
  )
}
