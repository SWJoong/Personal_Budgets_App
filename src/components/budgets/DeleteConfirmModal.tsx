'use client'

interface DeleteConfirmModalProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({
  title,
  message,
  onConfirm,
  onCancel
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-red-600">{title}</h2>
        <p className="text-zinc-700 mb-6">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg font-semibold hover:bg-zinc-300"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
