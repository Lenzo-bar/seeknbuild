import { useState, useCallback, useEffect } from 'react'

export interface UrlListEntry {
  id:      string
  url:     string
  label:   string   // hostname extracted for display
  task:    string
  ts:      number
  active:  boolean  // user can toggle on/off
  cardCount: number
}

const STORAGE_KEY = 'snb_url_list'
const MAX_URLS    = 50

function load(): UrlListEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function save(entries: UrlListEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) } catch {}
}

function extractLabel(url: string): string {
  try { return new URL(url).hostname } catch { return url.slice(0, 40) }
}

export function useUrlList() {
  const [entries, setEntries] = useState<UrlListEntry[]>(load)

  useEffect(() => { save(entries) }, [entries])

  const addUrls = useCallback((urls: string[], task: string) => {
    setEntries(prev => {
      const existingUrls = new Set(prev.map(e => e.url))
      const newEntries: UrlListEntry[] = urls
        .filter(u => !existingUrls.has(u))
        .map(u => ({
          id:        `url-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          url:       u,
          label:     extractLabel(u),
          task,
          ts:        Date.now(),
          active:    true,
          cardCount: 0,
        }))
      return [...newEntries, ...prev].slice(0, MAX_URLS)
    })
  }, [])

  const toggleActive = useCallback((id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, active: !e.active } : e))
  }, [])

  const setAllActive = useCallback((active: boolean) => {
    setEntries(prev => prev.map(e => ({ ...e, active })))
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const clearAll = useCallback(() => setEntries([]), [])

  const updateCardCount = useCallback((url: string, cardCount: number) => {
    setEntries(prev => prev.map(e => e.url === url ? { ...e, cardCount } : e))
  }, [])

  const updateTask = useCallback((id: string, task: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, task } : e))
  }, [])

  const activeUrls = entries.filter(e => e.active).map(e => e.url)

  return {
    entries, activeUrls,
    addUrls, toggleActive, setAllActive,
    removeEntry, clearAll, updateCardCount, updateTask,
  }
}
