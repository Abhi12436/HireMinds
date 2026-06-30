import { useState, useEffect, useCallback } from 'react'

// Theme: 'light' | 'dark' | 'system'
export function useTheme() {
  const [pref, setPref] = useState(() => localStorage.getItem('hm_theme') || 'system')

  const resolved = useCallback(() => {
    if (pref === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return pref
  }, [pref])

  useEffect(() => {
    const apply = () => document.documentElement.setAttribute('data-theme', resolved())
    apply()
    localStorage.setItem('hm_theme', pref)
    if (pref === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [pref, resolved])

  return [pref, setPref, resolved()]
}
