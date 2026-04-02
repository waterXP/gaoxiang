import { useState, useEffect, useCallback } from 'react'

const KEY = 'sp'

export function useStorage() {
  const get = useCallback(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
  }, [])

  const set = useCallback((data) => {
    localStorage.setItem(KEY, JSON.stringify(data))
  }, [])

  const [state, setState] = useState(get)

  const update = useCallback((fn) => {
    setState(prev => {
      const next = fn({ ...prev })
      set(next)
      return next
    })
  }, [set])

  return { state, update }
}
