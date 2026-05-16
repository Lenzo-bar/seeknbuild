import { useState, useCallback, useEffect } from 'react'

export interface FileHistoryEntry {
  id:       string
  name:     string
  size:     number
  type:     string
  prompt:   string
  ts:       number
  cardCount: number
}

const STORAGE_KEY = 'snb_file_history'
const MAX_FILES   = 20

function load(): FileHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function save(entries: FileHistoryEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) } catch {}
}

export function useFileHistory() {
  const [entries, setEntries] = useState<FileHistoryEntry[]>(load)

  useEffect(() => { save(entries) }, [entries])

  const addFile = useCallback((file: File, prompt: string, cardCount = 0) => {
    setEntries(prev => {
      const deduped = prev.filter(e => !(e.name === file.name && e.size === file.size))
      const entry: FileHistoryEntry = {
        id:        `file-${Date.now()}`,
        name:      file.name,
        size:      file.size,
        type:      file.type,
        prompt,
        ts:        Date.now(),
        cardCount,
      }
      return [entry, ...deduped].slice(0, MAX_FILES)
    })
  }, [])

  const updateCardCount = useCallback((name: string, size: number, cardCount: number) => {
    setEntries(prev => prev.map(e =>
      e.name === name && e.size === size ? { ...e, cardCount } : e
    ))
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const clearAll = useCallback(() => setEntries([]), [])

  return { entries, addFile, updateCardCount, removeEntry, clearAll }
}
