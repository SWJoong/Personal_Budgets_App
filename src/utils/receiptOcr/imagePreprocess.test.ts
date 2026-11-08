import { describe, expect, it } from 'vitest'
import { adaptiveThreshold, computeTargetSize, stretchContrast, toGrayscale } from './imagePreprocess'
import { needsSecondPass } from './analyzeReceiptLocal'
import { EMPTY_RECEIPT } from './types'

describe('computeTargetSize', () => {
  it('큰 사진은 폭 1400 으로 줄인다', () => {
    expect(computeTargetSize(4000, 3000)).toMatchObject({ width: 1400, height: 1050 })
  })

  it('작은 사진은 폭 900 이 되도록 키우되 2배를 넘지 않는다', () => {
    expect(computeTargetSize(500, 800)).toMatchObject({ width: 900, height: 1440 })
    expect(computeTargetSize(300, 300)).toMatchObject({ width: 600, height: 600 })
  })

  it('긴 영수증은 높이 상한(4200)에 맞춰 줄인다', () => {
    const r = computeTargetSize(1000, 6000)
    expect(r.height).toBe(4200)
    expect(r.width).toBe(700)
  })

  it('폭·높이는 항상 1 이상', () => {
    const r = computeTargetSize(1, 1)
    expect(r.width).toBeGreaterThanOrEqual(1)
    expect(r.height).toBeGreaterThanOrEqual(1)
  })
})

describe('toGrayscale', () => {
  it('RGBA 를 밝기로 바꾼다', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255])
    expect(Array.from(toGrayscale(rgba))).toEqual([255, 0, 76])
  })
})

describe('stretchContrast', () => {
  it('좁은 밝기 범위를 0~255 로 편다', () => {
    const gray = new Uint8ClampedArray(1000)
    for (let i = 0; i < gray.length; i++) gray[i] = 100 + (i % 51) // 100..150
    stretchContrast(gray)
    expect(Math.min(...gray)).toBeLessThanOrEqual(5)
    expect(Math.max(...gray)).toBeGreaterThanOrEqual(250)
  })

  it('이미 대비가 거의 없는 사진은 그대로 둔다', () => {
    const gray = new Uint8ClampedArray(100).fill(128)
    stretchContrast(gray)
    expect(Array.from(new Set(gray))).toEqual([128])
  })
})

describe('adaptiveThreshold', () => {
  const W = 100
  const H = 40

  /** 왼쪽은 어두운 그림자(120), 오른쪽은 밝은 종이(220), 양쪽에 3x3 글자 점(40) */
  function shadowedReceipt(): Uint8ClampedArray {
    const g = new Uint8ClampedArray(W * H)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = x < W / 2 ? 120 : 220
    for (const cx of [20, 80]) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g[(20 + dy) * W + cx + dx] = 40
    }
    return g
  }

  it('그림자가 있어도 글자는 검정, 종이는 흰색으로 가른다', () => {
    const out = adaptiveThreshold(shadowedReceipt(), W, H)
    expect(out[20 * W + 20]).toBe(0)
    expect(out[20 * W + 80]).toBe(0)
    expect(out[5 * W + 5]).toBe(255) // 어두운 쪽 종이
    expect(out[35 * W + 95]).toBe(255) // 밝은 쪽 종이
  })

  it('한 색뿐인 사진은 전부 흰색', () => {
    const out = adaptiveThreshold(new Uint8ClampedArray(W * H).fill(180), W, H)
    expect(new Set(out)).toEqual(new Set([255]))
  })
})

describe('needsSecondPass', () => {
  it('금액이 없으면 2차를 한다', () => {
    expect(needsSecondPass({ ...EMPTY_RECEIPT, date: '2026-11-03', store: '가게' })).toBe(true)
  })

  it('금액이 있어도 핵심 항목이 1개뿐이면 2차를 한다', () => {
    expect(needsSecondPass({ ...EMPTY_RECEIPT, amount: 5000 })).toBe(true)
  })

  it('금액과 다른 항목이 하나 더 있으면 1차로 충분하다', () => {
    expect(needsSecondPass({ ...EMPTY_RECEIPT, amount: 5000, store: '가게' })).toBe(false)
  })
})
