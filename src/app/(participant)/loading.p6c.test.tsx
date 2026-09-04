import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ParticipantLoading from './loading'
import RootLoading from '../loading'

/**
 * P6 Phase C — nav 완전성: 로딩 스켈레톤 skip-link 목적지 (RED)
 * 설계출처: Plan&Source/goala_p6_phaseC_W.md §nav (contract nav.loading.skiplink-target)
 *
 * supporter 로딩(admin/loading.tsx·review/loading.tsx)은 이미 <main id='main-content'> 를
 * 가진다. 반면 participant/root 로딩은 <div> 루트 → 로딩 상태 동안 전역 skip-link 타깃이
 * 소멸한다(불일치). 순수 프레젠테이셔널 컴포넌트라 jsdom 렌더 가능.
 *
 * 저severity(패턴 이미 확립). 계약은 root 2파일만 잠그고, participant 하위 개별 loading
 * (evaluations·map·gallery·calendar·more·receipt·plan·settings/profile)은 설계문/lint 가이드.
 */
describe('P6-C nav — 로딩 스켈레톤 main#main-content (loading-skiplink-target)', () => {
  it('[RED] participant 로딩 스켈레톤이 #main-content 를 가진다', () => {
    const { container } = render(<ParticipantLoading />)
    // RED: (participant)/loading.tsx 루트가 <div className='flex flex-col min-h-screen…'>
    expect(container.querySelector('#main-content')).not.toBeNull()
  })

  it('[RED] root 로딩 스켈레톤이 #main-content 를 가진다', () => {
    const { container } = render(<RootLoading />)
    // RED: app/loading.tsx 루트가 <div className='flex min-h-screen…'>
    expect(container.querySelector('#main-content')).not.toBeNull()
  })
})
