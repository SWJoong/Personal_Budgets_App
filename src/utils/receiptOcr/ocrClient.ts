// 브라우저에서 Tesseract.js(한국어+영어)로 글자를 읽는 클라이언트.
// 서버나 외부 AI 를 쓰지 않는다: 사진은 이 기기 밖으로 나가지 않는다.
//
// 처음 한 번만 OCR 엔진(WASM)과 글자 데이터(한국어 약 1.6MB, 영어 약 3MB)를
// jsDelivr CDN 에서 내려받고, 이후에는 브라우저 캐시를 쓴다.
// 클라이언트 컴포넌트에서만 import 할 것 (서버에서는 동작하지 않는다).

import type { Worker as TesseractWorker } from 'tesseract.js'
import type { OcrProgressHandler } from './types'

const IDLE_MS = 120_000 // 사용하지 않으면 2분 뒤 메모리를 돌려준다

let workerPromise: Promise<TesseractWorker> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let activeProgress: OcrProgressHandler | null = null

function report(percent: number, message: string) {
  activeProgress?.(Math.max(0, Math.min(100, Math.round(percent))), message)
}

function clearIdle() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
}

function scheduleIdle() {
  clearIdle()
  idleTimer = setTimeout(() => {
    void disposeOcrWorker()
  }, IDLE_MS)
}

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM, PSM } = await import('tesseract.js')
      const worker = await createWorker(['kor', 'eng'], OEM.LSTM_ONLY, {
        logger: (m) => {
          if (m.status === 'loading tesseract core') report(5 + m.progress * 10, '읽을 준비를 하고 있어요')
          else if (m.status.startsWith('loading language')) report(15 + m.progress * 25, '글자 정보를 내려받고 있어요 (처음 한 번만)')
          else if (m.status.startsWith('initializing')) report(40 + m.progress * 5, '읽을 준비를 하고 있어요')
          else if (m.status === 'recognizing text') report(45 + m.progress * 55, '영수증을 읽고 있어요')
        },
      })
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        // '합계    5,500' 처럼 벌어진 칸 간격을 유지해야 금액 줄을 알아보기 쉽다.
        preserve_interword_spaces: '1',
      })
      currentPsm = '6'
      return worker
    })().catch((err) => {
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

/**
 * 글자 덩어리를 찾는 방식(Page Segmentation Mode).
 *  '6' = 한 덩어리(기본) / '11' = 흩어진 글자 / '4' = 한 칸(column) 문서 / '3' = 자동
 * 영수증은 '합계 ········ 5,500' 처럼 왼쪽 이름과 오른쪽 금액 사이가 넓다. 합성 영수증 6장으로
 * 비교했을 때 '4'·'3' 은 오른쪽 금액을 통째로 놓쳐 금액을 1/6 만 맞혔고, '6'·'11' 은 6/6 이었다.
 */
export type OcrPageMode = '3' | '4' | '6' | '11'

export interface RecognizeOptions {
  psm?: OcrPageMode
}

let currentPsm: OcrPageMode | null = null

/** 이미지(canvas 또는 Blob)에서 글자를 읽어 문자열로 돌려준다. */
export async function recognizeText(
  image: HTMLCanvasElement | Blob,
  onProgress?: OcrProgressHandler,
  options: RecognizeOptions = {},
): Promise<string> {
  activeProgress = onProgress ?? null
  clearIdle()
  try {
    report(2, '읽을 준비를 하고 있어요')
    const worker = await getWorker()
    const psm = options.psm ?? '6'
    if (psm !== currentPsm) {
      await worker.setParameters({ tessedit_pageseg_mode: psm as never })
      currentPsm = psm
    }
    const { data } = await worker.recognize(image)
    return data.text ?? ''
  } finally {
    activeProgress = null
    scheduleIdle()
  }
}

export async function disposeOcrWorker(): Promise<void> {
  clearIdle()
  const pending = workerPromise
  workerPromise = null
  currentPsm = null
  if (!pending) return
  try {
    const worker = await pending
    await worker.terminate()
  } catch {
    /* 이미 실패했거나 종료된 워커 */
  }
}
