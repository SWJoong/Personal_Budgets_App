import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlaceResult } from '@/app/actions/geocode'

vi.mock('@/app/actions/geocode', () => ({ searchPlaces: vi.fn(async () => []) }))

import ReceiptPlaceBox from './ReceiptPlaceBox'

const CU: PlaceResult = {
  id: '1',
  place_name: 'CU 노원역점',
  road_address_name: '서울 노원구 동일로 1234',
  address_name: '서울 노원구 상계동 123-4',
  category_name: '',
  lat: 37.65,
  lng: 127.06,
}

function setup(props: Partial<React.ComponentProps<typeof ReceiptPlaceBox>> = {}) {
  const onChoose = vi.fn()
  const onClear = vi.fn()
  const view = render(
    <ReceiptPlaceBox
      status="idle"
      place={null}
      source="auto"
      hintName=""
      onChoose={onChoose}
      onClear={onClear}
      {...props}
    />,
  )
  return { ...view, onChoose, onClear }
}

describe('ReceiptPlaceBox', () => {
  it('idle: 아무것도 그리지 않는다', () => {
    const { container } = setup({ status: 'idle' })
    expect(container).toBeEmptyDOMElement()
  })

  it('searching: 찾는 중 안내를 상태 영역으로 알린다', () => {
    setup({ status: 'searching' })
    expect(screen.getByRole('status')).toHaveTextContent('장소를 찾고 있어요')
  })

  it('found(자동): 장소 이름·도로명 주소와 "장소 자동 감지" 를 보여 주고, 지우기를 누르면 onClear', () => {
    const { onClear } = setup({ status: 'found', place: CU, source: 'auto' })
    expect(screen.getByText('장소 자동 감지')).toBeInTheDocument()
    expect(screen.getByText('CU 노원역점')).toBeInTheDocument()
    expect(screen.getByText('서울 노원구 동일로 1234')).toBeInTheDocument()
    // 찾은 결과도 화면 읽기 프로그램이 알려 주도록 상태 영역 안에 있다
    expect(screen.getByRole('status')).toHaveTextContent('CU 노원역점')

    fireEvent.click(screen.getByRole('button', { name: '지우기' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('found(직접): "선택한 장소" 로 보여 준다', () => {
    setup({ status: 'found', place: CU, source: 'manual' })
    expect(screen.getByText('선택한 장소')).toBeInTheDocument()
    expect(screen.queryByText('장소 자동 감지')).not.toBeInTheDocument()
  })

  it('도로명 주소가 없으면 지번 주소를 보여 준다', () => {
    setup({ status: 'found', place: { ...CU, road_address_name: '' } })
    expect(screen.getByText('서울 노원구 상계동 123-4')).toBeInTheDocument()
  })

  it('notFound: "못 찾았어요" 안내와 직접 검색 칸(상호가 미리 들어 있음)을 보여 준다', () => {
    setup({ status: 'notFound', hintName: 'CU 노원역점' })
    expect(screen.getByRole('status')).toHaveTextContent('장소를 못 찾았어요. 직접 검색해 주세요.')
    expect(screen.getByPlaceholderText(/장소명 검색/)).toHaveValue('CU 노원역점')
    expect(screen.getByRole('button', { name: '검색' })).toBeInTheDocument()
  })

  it('cleared: 안내 없이 직접 검색 칸만 보여 준다', () => {
    setup({ status: 'cleared', hintName: 'CU 노원역점' })
    expect(screen.queryByText(/못 찾았어요/)).not.toBeInTheDocument()
    expect(screen.getByText(/장소 직접 찾기/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/장소명 검색/)).toBeInTheDocument()
  })

  it('지우기 버튼은 누르기 쉬운 크기(44px)다', () => {
    setup({ status: 'found', place: CU })
    const button = screen.getByRole('button', { name: '지우기' })
    expect(button.className).toContain('min-h-[44px]')
    expect(button.className).toContain('min-w-[44px]')
  })
})
