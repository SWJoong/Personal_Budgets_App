"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'

type FontSize = 'normal' | 'large' | 'huge'

interface AccessibilityContextType {
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>('normal')

  // 로컬 스토리지에서 설정 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('app-font-size') as FontSize
    if (saved) setFontSizeState(saved)
  }, [])

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size)
    localStorage.setItem('app-font-size', size)
    
    // HTML 태그의 font-size 조절 (rem 단위 전체 변경)
    const html = document.documentElement
    if (size === 'normal') html.style.fontSize = '16px'
    else if (size === 'large') html.style.fontSize = '20px'
    else if (size === 'huge') html.style.fontSize = '24px'
  }

  // 초기 로드 시 폰트 사이즈 적용
  useEffect(() => {
    const html = document.documentElement
    if (fontSize === 'normal') html.style.fontSize = '16px'
    else if (fontSize === 'large') html.style.fontSize = '20px'
    else if (fontSize === 'huge') html.style.fontSize = '24px'
  }, [fontSize])

  return (
    <AccessibilityContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider')
  }
  return context
}
