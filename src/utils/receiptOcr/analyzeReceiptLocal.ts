// 영수증 사진 → 항목 추출 (브라우저 OCR 만 사용, 서버·API 없음)
//
// 읽는 순서 (앞 단계가 충분하면 뒤 단계는 하지 않아 대부분의 사진은 한 번만 읽는다):
//   1차  흑백 + 대비 보정, '한 덩어리'(PSM 6)
//   2차  핵심 항목이 부족할 때: 같은 사진을 '흩어진 글자'(PSM 11)로 다시 읽어 빈 항목만 채운다
//   3차  그래도 금액이 없을 때: 주변 밝기 기준 이진화 + PSM 11
// 합성 영수증 6장으로 조합을 비교한 결과다 (이진화 단독·PSM 4/3 은 금액을 거의 놓쳤다).

import { disposeOcrWorker, recognizeText, type OcrPageMode } from './ocrClient'
import { preprocessReceiptImage, releaseCanvas, type PreprocessMode } from './imagePreprocess'
import { hasUsefulField, mergeReceipts, parseReceiptText } from './parseReceiptText'
import type { OcrProgressHandler, ParsedReceipt, ReceiptAnalysis } from './types'

/** 1차 결과가 이만큼 부족하면 2차를 시도한다: 금액이 없거나 핵심 3항목 중 2개 미만 */
export function needsSecondPass(r: ParsedReceipt): boolean {
  const core = [r.amount, r.date, r.store].filter((v) => v !== null).length
  return r.amount === null || core < 2
}

function scaled(handler: OcrProgressHandler | undefined, from: number, to: number): OcrProgressHandler | undefined {
  if (!handler) return undefined
  return (percent, message) => handler(Math.round(from + ((to - from) * percent) / 100), message)
}

async function readOnce(
  file: Blob,
  mode: PreprocessMode,
  psm: OcrPageMode,
  onProgress?: OcrProgressHandler,
): Promise<ParsedReceipt> {
  const canvas = await preprocessReceiptImage(file, mode)
  try {
    const text = await recognizeText(canvas, onProgress, { psm })
    return parseReceiptText(text)
  } finally {
    releaseCanvas(canvas)
  }
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : ''
  if (/읽을 수 없는 형식|다듬을 수 없어요/.test(msg)) return msg
  if (/fetch|network|load|Failed|import/i.test(msg)) {
    return '글자 읽는 도구를 내려받지 못했어요. 인터넷을 확인하고 다시 해 주세요.'
  }
  return '사진을 읽지 못했어요. 직접 적어 주세요.'
}

export async function analyzeReceiptLocal(file: Blob, onProgress?: OcrProgressHandler): Promise<ReceiptAnalysis> {
  try {
    let parsed = await readOnce(file, 'gray', '6', scaled(onProgress, 0, 55))
    if (needsSecondPass(parsed)) {
      onProgress?.(57, '한 번 더 읽어 볼게요')
      parsed = mergeReceipts(parsed, await readOnce(file, 'gray', '11', scaled(onProgress, 57, 80)))
      if (parsed.amount === null) {
        onProgress?.(82, '다른 방법으로 다시 읽어 볼게요')
        parsed = mergeReceipts(parsed, await readOnce(file, 'binary', '11', scaled(onProgress, 82, 99)))
      }
    }
    onProgress?.(100, '다 읽었어요')
    if (!hasUsefulField(parsed)) {
      return { success: false, source: 'local', error: '글자를 읽지 못했어요. 직접 적어 주세요.' }
    }
    return { success: true, source: 'local', data: parsed }
  } catch (err) {
    console.error('영수증 OCR 실패:', err)
    await disposeOcrWorker() // 깨진 워커가 남지 않게 정리하고 다음 사진에서 새로 만든다
    return { success: false, source: 'local', error: friendlyError(err) }
  }
}
