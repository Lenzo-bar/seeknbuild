import { useState, useCallback, useEffect } from 'react'
import type { AppMode } from '../types'

export interface HistoryEntry {
  id:    string
  query: string
  mode:  AppMode
  ts:    number
}

const STORAGE_KEY = 'snb_prompt_history'
const MAX_PER_MODE = 30

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function save(entries: HistoryEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) } catch {}
}

export function usePromptHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(load)

  // Persist on every change
  useEffect(() => { save(entries) }, [entries])

  const addEntry = useCallback((query: string, mode: AppMode) => {
    const q = query.trim()
    if (!q) return
    setEntries(prev => {
      // Deduplicate: remove any existing identical entry for this mode
      const deduped = prev.filter(e => !(e.mode === mode && e.query === q))
      const newEntry: HistoryEntry = {
        id:    `${mode}-${Date.now()}`,
        query: q,
        mode,
        ts:    Date.now(),
      }
      // Keep newest first; cap per mode
      const withNew = [newEntry, ...deduped]
      const modeEntries = withNew.filter(e => e.mode === mode).slice(0, MAX_PER_MODE)
      const otherEntries = withNew.filter(e => e.mode !== mode)
      return [...modeEntries, ...otherEntries]
    })
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const clearMode = useCallback((mode: AppMode) => {
    setEntries(prev => prev.filter(e => e.mode !== mode))
  }, [])

  const clearAll = useCallback(() => {
    setEntries([])
  }, [])

  const getForMode = useCallback((mode: AppMode): HistoryEntry[] => {
    return entries.filter(e => e.mode === mode).sort((a, b) => b.ts - a.ts)
  }, [entries])

  const getAll = useCallback((): HistoryEntry[] => {
    return [...entries].sort((a, b) => b.ts - a.ts)
  }, [entries])

  return { entries, addEntry, removeEntry, clearMode, clearAll, getForMode, getAll }
}
