"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'

type FontSize = 'normal' | 'large' | 'huge'

interface AccessibilityContextType {
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
  highContrast: boolean
  setHighContrast: (on: boolean) => void
  easyTerms: boolean
  setEasyTerms: (on: boolean) => void
  yellowBg: boolean
  setYellowBg: (on: boolean) => void
  darkMode: boolean
  setDarkMode: (on: boolean) => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>('normal')
  const [highContrast, setHighContrastState] = useState(false)
  const [easyTerms, setEasyTermsState] = useState(false)
  const [yellowBg, setYellowBgState] = useState(false)
  const [darkMode, setDarkModeState] = useState(false)

  // 로컬 스토리지에서 설정 불러오기
  useEffect(() => {
    const savedFont = localStorage.getItem('app-font-size') as FontSize
    if (savedFont) setFontSizeState(savedFont)
    const savedContrast = localStorage.getItem('app-high-contrast')
    if (savedContrast === 'true') setHighContrastState(true)
    const savedEasyTerms = localStorage.getItem('app-easy-terms')
    if (savedEasyTerms === 'true') setEasyTermsState(true)
    const savedYellowBg = localStorage.getItem('app-yellow-bg')
    if (savedYellowBg === 'true') setYellowBgState(true)
    const savedDarkMode = localStorage.getItem('app-dark-mode')
    if (savedDarkMode === 'true') setDarkModeState(true)
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

  const setHighContrast = (on: boolean) => {
    setHighContrastState(on)
    localStorage.setItem('app-high-contrast', String(on))
    const html = document.documentElement
    if (on) {
      html.classList.add('high-contrast')
    } else {
      html.classList.remove('high-contrast')
    }
  }

  const setEasyTerms = (on: boolean) => {
    setEasyTermsState(on)
    localStorage.setItem('app-easy-terms', String(on))
    const html = document.documentElement
    if (on) {
      html.classList.add('easy-terms')
    } else {
      html.classList.remove('easy-terms')
    }
  }

  const setYellowBg = (on: boolean) => {
    setYellowBgState(on)
    localStorage.setItem('app-yellow-bg', String(on))
    const html = document.documentElement
    if (on) {
      html.classList.add('yellow-bg')
      // 노란 배경과 다크모드는 동시에 사용 불가
      if (darkMode) {
        setDarkModeState(false)
        localStorage.setItem('app-dark-mode', 'false')
        html.classList.remove('dark-mode')
      }
    } else {
      html.classList.remove('yellow-bg')
    }
  }

  const setDarkMode = (on: boolean) => {
    setDarkModeState(on)
    localStorage.setItem('app-dark-mode', String(on))
    const html = document.documentElement
    if (on) {
      html.classList.add('dark-mode')
      // 다크 모드와 노란 배경은 동시에 사용 불가
      if (yellowBg) {
        setYellowBgState(false)
        localStorage.setItem('app-yellow-bg', 'false')
        html.classList.remove('yellow-bg')
      }
    } else {
      html.classList.remove('dark-mode')
    }
  }

  // 초기 로드 시 폰트 사이즈 & 고대비 & 쉬운 용어 & 다크모드 적용
  useEffect(() => {
    const html = document.documentElement
    if (fontSize === 'normal') html.style.fontSize = '16px'
    else if (fontSize === 'large') html.style.fontSize = '20px'
    else if (fontSize === 'huge') html.style.fontSize = '24px'

    if (highContrast) html.classList.add('high-contrast')
    else html.classList.remove('high-contrast')

    if (easyTerms) html.classList.add('easy-terms')
    else html.classList.remove('easy-terms')

    if (yellowBg) html.classList.add('yellow-bg')
    else html.classList.remove('yellow-bg')

    if (darkMode) html.classList.add('dark-mode')
    else html.classList.remove('dark-mode')
  }, [fontSize, highContrast, easyTerms, yellowBg, darkMode])

  return (
    <AccessibilityContext.Provider value={{ fontSize, setFontSize, highContrast, setHighContrast, easyTerms, setEasyTerms, yellowBg, setYellowBg, darkMode, setDarkMode }}>
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
