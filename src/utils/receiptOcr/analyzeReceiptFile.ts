// 영수증 분석 진입점 (클라이언트 컴포넌트가 사용).
//
// 기본은 브라우저 OCR 이다. 서버에 OPENAI_API_KEY 가 설정돼 있을 때만 기존 AI 경로를
// 먼저 시도하고, 실패하면 브라우저 OCR 로 이어서 처리한다. (키가 없으면 사진은 서버로 가지 않는다.)

import { analyzeReceipt, getOcrMode } from '@/app/actions/ocr'
import { analyzeReceiptLocal } from './analyzeReceiptLocal'
import { suggestCategory } from './parseReceiptText'
import type { OcrProgressHandler, ReceiptAnalysis } from './types'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.readAsDataURL(blob)
  })
}

export async function analyzeReceiptFile(file: Blob, onProgress?: OcrProgressHandler): Promise<ReceiptAnalysis> {
  let mode: 'ai' | 'local' = 'local'
  try {
    mode = await getOcrMode()
  } catch {
    /* 서버에 닿지 않으면 브라우저 OCR 로 진행 */
  }

  if (mode === 'ai') {
    try {
      onProgress?.(10, '영수증을 읽고 있어요')
      const res = await analyzeReceipt(await blobToBase64(file))
      if (res.success && res.data) {
        const store = typeof res.data.store === 'string' && res.data.store ? res.data.store : null
        return {
          success: true,
          source: 'ai',
          data: {
            date: typeof res.data.date === 'string' && res.data.date ? res.data.date : null,
            amount: typeof res.data.amount === 'number' && res.data.amount > 0 ? res.data.amount : null,
            store,
            address: typeof res.data.address === 'string' && res.data.address ? res.data.address : null,
            paymentMethod: null,
            category: suggestCategory(store),
          },
        }
      }
    } catch (err) {
      console.error('AI 영수증 분석 실패, 브라우저 OCR 로 이어서 처리합니다:', err)
    }
  }
  return analyzeReceiptLocal(file, onProgress)
}
