// 휴대폰으로 찍은 영수증 사진을 OCR 이 읽기 좋게 다듬는다 (브라우저 전용 + 순수 계산 함수).
//
// 하는 일: 크기 맞추기(너무 크면 줄이고 작으면 키움) → 흑백 → 대비 늘리기 →
//         (필요하면) 주변 밝기 기준 이진화. 기울어진 사진을 돌려 주지는 않는다.

export interface TargetSizeOptions {
  /** 이 폭보다 크면 줄인다 */
  targetWidth?: number
  /** 이 폭보다 작으면 키운다 */
  minWidth?: number
  /** 키울 수 있는 최대 배율 */
  maxUpscale?: number
  /** 긴 영수증을 위해 높이 상한 (메모리 보호) */
  maxHeight?: number
}

export function computeTargetSize(
  width: number,
  height: number,
  opts: TargetSizeOptions = {},
): { width: number; height: number; scale: number } {
  const { targetWidth = 1400, minWidth = 900, maxUpscale = 2, maxHeight = 4200 } = opts
  let scale = 1
  if (width > targetWidth) scale = targetWidth / width
  else if (width < minWidth) scale = Math.min(maxUpscale, minWidth / width)
  if (height * scale > maxHeight) scale = maxHeight / height
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  }
}

/** RGBA → 밝기(0~255) */
export function toGrayscale(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const n = Math.floor(rgba.length / 4)
  const gray = new Uint8ClampedArray(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]
  }
  return gray
}

/** 아래·위 일정 비율을 잘라 낸 뒤 0~255 로 펴서 흐린 사진의 대비를 높인다. (제자리 수정) */
export function stretchContrast(gray: Uint8ClampedArray, lowPercent = 1, highPercent = 99): void {
  const hist = new Uint32Array(256)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  const total = gray.length
  const percentile = (pct: number) => {
    const target = (total * pct) / 100
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= target) return v
    }
    return 255
  }
  const lo = percentile(lowPercent)
  const hi = percentile(highPercent)
  if (hi - lo < 30) return // 이미 대비가 낮은(거의 한 색) 사진은 건드리지 않는다
  const scale = 255 / (hi - lo)
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (gray[i] - lo) * scale // Uint8ClampedArray 가 0~255 로 잘라 준다
  }
}

/**
 * 주변 평균 밝기보다 `bias` 이상 어두운 점만 검정으로 두는 이진화.
 * 그림자가 진 영수증처럼 밝기가 고르지 않을 때 전체 기준 하나로 자르는 것보다 낫다.
 */
export function adaptiveThreshold(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  opts: { radius?: number; bias?: number } = {},
): Uint8ClampedArray {
  const radius = opts.radius ?? Math.max(12, Math.round(width / 40))
  const bias = opts.bias ?? 12
  const stride = width + 1
  const integral = new Float64Array(stride * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x]
      integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum
    }
  }
  const out = new Uint8ClampedArray(gray.length)
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius)
    const y1 = Math.min(height, y + radius + 1)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width, x + radius + 1)
      const area = (x1 - x0) * (y1 - y0)
      const sum =
        integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]
      out[y * width + x] = gray[y * width + x] < sum / area - bias ? 0 : 255
    }
  }
  return out
}

export type PreprocessMode = 'gray' | 'binary'

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // 휴대폰 사진의 회전 정보(EXIF)를 반영해서 읽는다.
      return await createImageBitmap(blob, { imageOrientation: 'from-image' })
    } catch {
      /* 아래 <img> 방식으로 다시 시도 */
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('이 사진은 읽을 수 없는 형식이에요.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 사진 → OCR 에 넣을 canvas. 다 쓴 canvas 는 releaseCanvas 로 메모리를 돌려준다. */
export async function preprocessReceiptImage(
  source: Blob,
  mode: PreprocessMode = 'gray',
): Promise<HTMLCanvasElement> {
  const bitmap = await loadBitmap(source)
  const srcW = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
  const srcH = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
  const { width, height } = computeTargetSize(srcW, srcH)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('이 기기에서는 사진을 다듬을 수 없어요.')
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#fff' // 투명 배경 PNG 대비
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  if ('close' in bitmap) bitmap.close()

  const image = ctx.getImageData(0, 0, width, height)
  let gray = toGrayscale(image.data)
  stretchContrast(gray)
  if (mode === 'binary') gray = adaptiveThreshold(gray, width, height)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    image.data[p] = image.data[p + 1] = image.data[p + 2] = gray[i]
    image.data[p + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0
  canvas.height = 0
}
