import { describe, expect, it, vi } from 'vitest'
import type { PlaceResult } from '@/app/actions/geocode'
import {
  buildPlaceQueries,
  cleanAddress,
  cleanStoreName,
  findReceiptPlace,
  normalizeName,
  parseAddress,
  scoreAddressMatch,
  scoreNameMatch,
} from './findReceiptPlace'

function place(
  id: string,
  name: string,
  road: string,
  jibun = '',
  extra: Partial<PlaceResult> = {},
): PlaceResult {
  return {
    id,
    place_name: name,
    road_address_name: road,
    address_name: jibun,
    category_name: '',
    lat: 37.65,
    lng: 127.06,
    ...extra,
  }
}

/** 검색어별로 정해 둔 결과를 돌려주는 가짜 검색. 정해 두지 않은 검색어는 빈 결과. */
function fakeSearch(table: Record<string, PlaceResult[]>) {
  return vi.fn(async (query: string) => table[query] ?? [])
}

const CU_NOWON = place('2', 'CU 노원역점', '서울 노원구 동일로 1234', '서울 노원구 상계동 123-4')
const CU_SEOCHO = place('1', 'CU 노원역점', '서울 서초구 서초대로 100', '서울 서초구 서초동 1-1')

describe('normalizeName · cleanStoreName', () => {
  it('공백·기호·회사 표시를 없애고 소문자로 맞춘다', () => {
    expect(normalizeName('CU 노원역점')).toBe('cu노원역점')
    expect(normalizeName('(주)스타벅스 노원역점')).toBe('스타벅스노원역점')
    expect(normalizeName('㈜GS리테일 GS25')).toBe('gs리테일gs25')
  })

  it('검색어용 상호는 회사 표시와 특수문자를 뺀다', () => {
    expect(cleanStoreName('GS25(노원점)')).toBe('GS25 노원점')
    expect(cleanStoreName('(주)이마트  노원점')).toBe('이마트 노원점')
    expect(cleanStoreName(null)).toBe('')
  })
})

describe('scoreNameMatch', () => {
  it('똑같으면 3, 한쪽이 다른 쪽을 포함하면 2, 다르면 0', () => {
    expect(scoreNameMatch(place('a', 'CU 노원역점', ''), 'CU노원역점')).toBe(3)
    expect(scoreNameMatch(place('a', '스타벅스 노원역점', ''), '(주)스타벅스 노원역점')).toBe(3)
    expect(scoreNameMatch(place('a', 'GS25 역삼점', ''), 'GS25')).toBe(2)
    expect(scoreNameMatch(place('a', '노원 약국', ''), 'CU 노원역점')).toBe(0)
  })

  it('너무 짧은 상호는 포함으로 치지 않는다', () => {
    expect(scoreNameMatch(place('a', '교보문고 서점', ''), '서점')).toBe(0)
    expect(scoreNameMatch(place('a', 'CU', ''), null)).toBe(0)
  })
})

describe('parseAddress', () => {
  it('도로명 주소에서 시도·구·도로명·건물번호를 뽑는다', () => {
    const h = parseAddress('서울특별시 노원구 동일로 1234, 1층')
    expect(h.sido).toBe('서울')
    expect(h.areas).toEqual(['노원구'])
    expect(h.roads).toEqual([{ name: '동일로', number: '1234' }])
  })

  it('시와 구가 같이 있으면 둘 다 뽑고, 번길 도로명도 하나로 읽는다', () => {
    const h = parseAddress('경기도 성남시 분당구 판교역로 235')
    expect(h.sido).toBe('경기')
    expect(h.areas).toEqual(['성남시', '분당구'])
    expect(h.roads[0]).toEqual({ name: '판교역로', number: '235' })

    const h2 = parseAddress('서울 노원구 노해로69길 12')
    expect(h2.roads[0]).toEqual({ name: '노해로69길', number: '12' })

    const h3 = parseAddress('서울 노원구 동일로 12길 5')
    expect(h3.roads[0]).toEqual({ name: '동일로12길', number: '5' })
  })

  it('긴 시도 이름은 짧게 줄인다 (충청북도 → 충북)', () => {
    expect(parseAddress('충청북도 청주시 상당구 상당로 1').sido).toBe('충북')
    expect(parseAddress('전라남도 여수시 시청로 1').sido).toBe('전남')
  })

  it('괄호 안 동 이름과 지번 주소를 읽는다 (행정동 숫자는 뺀다)', () => {
    const h = parseAddress('서울 노원구 동일로 1234 (상계1동)')
    expect(h.dongs).toContain('상계동')

    const j = parseAddress('서울 노원구 상계동 123-4 3층')
    expect(j.jibun).toEqual([{ dong: '상계동', number: '123-4' }])
    expect(j.roads).toEqual([])
  })

  it('층·호 숫자를 번지로 오인하지 않는다', () => {
    const j = parseAddress('서울 노원구 상계동 3층')
    expect(j.jibun).toEqual([])
  })

  it('띄어쓰기가 빠진 주소도 구·도로명을 읽는다', () => {
    const h = parseAddress('서울노원구동일로1234')
    expect(h.areas).toContain('노원구')
    expect(h.roads.length).toBeGreaterThan(0)
  })
})

describe('cleanAddress', () => {
  it('층·호·괄호·쉼표 뒤를 잘라 건물번호까지만 남긴다', () => {
    expect(cleanAddress('서울특별시 노원구 동일로 1234, 3층')).toBe('서울특별시 노원구 동일로 1234')
    expect(cleanAddress('서울 노원구 동일로 1234 (상계동) 롯데마트 2층 02-123-4567')).toBe(
      '서울 노원구 동일로 1234',
    )
  })

  it('번길 도로명도 끝까지 남긴다', () => {
    expect(cleanAddress('서울 노원구 노해로69길 12 B1층')).toBe('서울 노원구 노해로69길 12')
    expect(cleanAddress('서울 노원구 동일로 12길 5 2층')).toBe('서울 노원구 동일로 12길 5')
  })

  it('지번 주소는 번지까지만 남긴다', () => {
    expect(cleanAddress('서울 노원구 상계동 123-4 3층')).toBe('서울 노원구 상계동 123-4')
  })

  it('번지가 없으면 층·호 표시만 뺀다', () => {
    expect(cleanAddress('서울 노원구 상계동 지하1층')).toBe('서울 노원구 상계동')
  })
})

describe('scoreAddressMatch', () => {
  const hints = parseAddress('서울 노원구 동일로 1234')

  it('같은 주소면 시도+구+도로명+건물번호가 모두 점수가 된다', () => {
    expect(scoreAddressMatch(CU_NOWON, hints)).toBe(1 + 2 + 3 + 3)
  })

  it('다른 구면 시도만 겹쳐서 낮은 점수', () => {
    expect(scoreAddressMatch(CU_SEOCHO, hints)).toBe(1)
  })

  it('건물번호가 다른 번호의 앞부분이면 번호 점수를 주지 않는다 (123 ≠ 1234)', () => {
    const short = parseAddress('서울 노원구 동일로 123')
    expect(scoreAddressMatch(CU_NOWON, short)).toBe(1 + 2 + 3)
  })

  it('지번 주소로도 맞출 수 있다', () => {
    const jibun = parseAddress('서울 노원구 상계동 123-4')
    expect(scoreAddressMatch(CU_NOWON, jibun)).toBeGreaterThanOrEqual(1 + 2 + 2 + 3)
  })

  it('주소 정보가 없는 후보는 0점', () => {
    expect(scoreAddressMatch(place('x', '어딘가', ''), hints)).toBe(0)
  })
})

describe('buildPlaceQueries', () => {
  it('상호 → 상호+동네 → 다듬은 주소 → 도로명+번호 순서', () => {
    expect(
      buildPlaceQueries({ store: 'CU 노원역점', address: '서울 노원구 동일로 1234 1층' }),
    ).toEqual(['CU 노원역점', 'CU 노원역점 노원구', '서울 노원구 동일로 1234', '동일로 1234'])
  })

  it('상호에 동네 이름이 이미 있으면 상호+동네는 만들지 않는다', () => {
    const queries = buildPlaceQueries({ store: '노원구청 매점', address: '서울 노원구 동일로 1234' })
    expect(queries).not.toContain('노원구청 매점 노원구')
  })

  it('주소만 있으면 주소 검색어만 만든다', () => {
    expect(buildPlaceQueries({ store: null, address: '서울 노원구 동일로 1234, 3층' })).toEqual([
      '서울 노원구 동일로 1234',
      '동일로 1234',
    ])
  })

  it('다듬은 주소가 도로명+번호와 같으면 중복으로 넣지 않는다', () => {
    expect(buildPlaceQueries({ store: null, address: '동일로 1234' })).toEqual(['동일로 1234'])
  })

  it('상호도 주소도 없으면 빈 목록', () => {
    expect(buildPlaceQueries({ store: null, address: null })).toEqual([])
    expect(buildPlaceQueries({ store: '  ', address: '' })).toEqual([])
  })

  it('검색어는 4개를 넘지 않는다', () => {
    const queries = buildPlaceQueries({
      store: '카페 마리',
      address: '경기도 성남시 분당구 판교역로 235 B1층',
    })
    expect(queries.length).toBeLessThanOrEqual(4)
  })
})

describe('findReceiptPlace', () => {
  it('상호로 먼저 찾고, 영수증 주소와 가장 가까운 후보를 고른다', async () => {
    const search = fakeSearch({ 'CU 노원역점': [CU_SEOCHO, CU_NOWON] })
    const found = await findReceiptPlace(
      { store: 'CU 노원역점', address: '서울 노원구 동일로 1234 1층' },
      search,
    )
    expect(found?.id).toBe('2')
    // 믿을 만한 후보가 나오면 더 찾지 않는다
    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith('CU 노원역점')
  })

  it('주소가 조금 틀려도 구가 맞는 후보를 고른다', async () => {
    const search = fakeSearch({
      'CU 노원역점': [CU_SEOCHO, CU_NOWON],
      'CU 노원역점 노원구': [],
      '서울 노원구 둥일로 1234': [],
      '둥일로 1234': [],
    })
    const found = await findReceiptPlace(
      { store: 'CU 노원역점', address: '서울 노원구 둥일로 1234' },
      search,
    )
    expect(found?.id).toBe('2')
  })

  it('상호로 못 찾으면 상호+동네, 다듬은 주소 순으로 다시 찾는다', async () => {
    const atAddress = place('9', 'OO빌딩', '서울 노원구 동일로 1234', '서울 노원구 상계동 123-4')
    const search = fakeSearch({ '서울 노원구 동일로 1234': [atAddress] })
    const found = await findReceiptPlace(
      { store: '카페 마리', address: '서울 노원구 동일로 1234, 2층' },
      search,
    )
    expect(found?.id).toBe('9')
    expect(search.mock.calls.map((c) => c[0])).toEqual([
      '카페 마리',
      '카페 마리 노원구',
      '서울 노원구 동일로 1234',
    ])
  })

  it('상호가 없어도 주소만으로 찾는다 (층 정보는 검색어에서 뺀다)', async () => {
    const atAddress = place('9', '노원빌딩', '서울 노원구 동일로 1234', '서울 노원구 상계동 123-4')
    const search = fakeSearch({ '서울특별시 노원구 동일로 1234': [atAddress] })
    const found = await findReceiptPlace(
      { store: null, address: '서울특별시 노원구 동일로 1234, 3층' },
      search,
    )
    expect(found?.id).toBe('9')
    expect(search).toHaveBeenCalledWith('서울특별시 노원구 동일로 1234')
  })

  it('주소가 없어도 지점 이름까지 똑같은 후보는 받는다', async () => {
    const search = fakeSearch({ 'CU 노원역점': [CU_NOWON] })
    const found = await findReceiptPlace({ store: 'CU 노원역점', address: null }, search)
    expect(found?.id).toBe('2')
  })

  it('주소가 없고 상호만 흔한 이름이면(지점 이름 없음) 비워 둔다', async () => {
    const search = fakeSearch({ GS25: [place('1', 'GS25 역삼점', '서울 강남구 테헤란로 1')] })
    const found = await findReceiptPlace({ store: 'GS25', address: null }, search)
    expect(found).toBeNull()
  })

  it('상호와 상관없는 결과만 오면 비워 둔다', async () => {
    const search = fakeSearch({ 'CU 노원역점': [place('1', '노원 약국', '서울 도봉구 도봉로 1')] })
    const found = await findReceiptPlace({ store: 'CU 노원역점', address: null }, search)
    expect(found).toBeNull()
  })

  it('지번 주소로도 같은 지점을 골라낸다', async () => {
    const search = fakeSearch({ 'CU 노원역점': [CU_SEOCHO, CU_NOWON] })
    const found = await findReceiptPlace(
      { store: 'CU 노원역점', address: '서울 노원구 상계동 123-4' },
      search,
    )
    expect(found?.id).toBe('2')
  })

  it('주소로 확인된 후보가 이름만 같은 다른 동네 지점보다 먼저다', async () => {
    // 다른 동네 CU: 이름 점수는 높지만(3) 영수증 주소(노원구 동일로)와는 시·도만 겹친다.
    // 같은 도로의 건물: 이름은 달라도 영수증 주소와 구·도로명이 겹친다.
    // 점수를 단순히 더하면 CU(1+6=7)가 건물(1+2+3=6)을 이기므로, '주소로 확인됨' 이 먼저 와야 한다.
    const building = place('7', '노원빌딩', '서울 노원구 동일로 99', '서울 노원구 상계동 9')
    const search = fakeSearch({
      'CU 노원역점': [CU_SEOCHO],
      'CU 노원역점 노원구': [],
      '서울 노원구 동일로 1234': [building],
      '동일로 1234': [],
    })
    const found = await findReceiptPlace(
      { store: 'CU 노원역점', address: '서울 노원구 동일로 1234' },
      search,
    )
    expect(found?.id).toBe('7')
  })

  it('주소로 확인된 후보가 없으면 지점 이름이 같은 후보를 받는다', async () => {
    const search = fakeSearch({ 'CU 노원역점': [CU_SEOCHO] })
    const found = await findReceiptPlace(
      { store: 'CU 노원역점', address: '서울 노원구 동일로 1234' },
      search,
    )
    expect(found?.id).toBe('1')
  })

  it('검색 결과가 전혀 없으면 null', async () => {
    const search = fakeSearch({})
    const found = await findReceiptPlace(
      { store: '카페 마리', address: '서울 노원구 동일로 1234' },
      search,
    )
    expect(found).toBeNull()
    expect(search).toHaveBeenCalledTimes(4)
  })

  it('검색이 오류로 실패해도 예외 없이 다음 검색어로 넘어간다', async () => {
    const atAddress = place('9', 'OO빌딩', '서울 노원구 동일로 1234', '서울 노원구 상계동 123-4')
    const search = vi.fn(async (query: string) => {
      if (query === '카페 마리') throw new Error('network')
      if (query === '서울 노원구 동일로 1234') return [atAddress]
      return []
    })
    const found = await findReceiptPlace(
      { store: '카페 마리', address: '서울 노원구 동일로 1234' },
      search,
    )
    expect(found?.id).toBe('9')
  })

  it('상호도 주소도 없으면 검색하지 않고 null', async () => {
    const search = fakeSearch({})
    expect(await findReceiptPlace({ store: null, address: null }, search)).toBeNull()
    expect(search).not.toHaveBeenCalled()
  })

  it('좌표가 깨진 후보는 건너뛴다', async () => {
    const broken = place('3', 'CU 노원역점', '서울 노원구 동일로 1234', '', { lat: NaN })
    const search = fakeSearch({ 'CU 노원역점': [broken] })
    const found = await findReceiptPlace(
      { store: 'CU 노원역점', address: '서울 노원구 동일로 1234' },
      search,
    )
    expect(found).toBeNull()
  })

  it('같은 후보가 여러 검색어에서 나와도 한 번만 센다', async () => {
    const search = fakeSearch({
      '카페 마리': [place('9', '카페 마리 노원점', '서울 노원구 동일로 99', '서울 노원구 상계동 9')],
      '카페 마리 노원구': [place('9', '카페 마리 노원점', '서울 노원구 동일로 99', '서울 노원구 상계동 9')],
    })
    const found = await findReceiptPlace(
      { store: '카페 마리', address: '서울 노원구 동일로 1234' },
      search,
    )
    // 구(노원구)+도로명(동일로)+시도가 겹쳐 점수 6 → 번호는 달라도 같은 도로·같은 구라 받는다
    expect(found?.id).toBe('9')
  })
})
