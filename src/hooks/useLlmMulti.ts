// src/hooks/useLlmMulti.ts — SeekNBuild v6
// Fixed: sidebarFilters now saved to slot state on search completion.

import { useState, useCallback } from 'react'
import type { SearchCard, LinkResult, SidebarFilterSection } from '../types'
import type { SummaryTableData, LlmCard } from './useCards'

export const LLM_PROVIDERS = [
  { id: 'claude',     label: 'Claude',      icon: '🤖', color: '#0F6E56', model: 'claude' },
  { id: 'chatgpt',    label: 'ChatGPT',     icon: '💬', color: '#10A37F', model: 'chatgpt' },
  { id: 'gemini',     label: 'Gemini',      icon: '✦',  color: '#4285F4', model: 'gemini' },
  { id: 'perplexity', label: 'Perplexity',  icon: '⊕',  color: '#20808D', model: 'perplexity' },
  { id: 'copilot',    label: 'Copilot',     icon: '🪟', color: '#0078D4', model: 'copilot' },
  { id: 'deepseek',   label: 'DeepSeek',    icon: '🔮', color: '#536DFE', model: 'deepseek' },
  { id: 'grok',       label: 'Grok',        icon: '𝕏',  color: '#1DA1F2', model: 'grok' },
  { id: 'mistral',    label: 'Mistral',     icon: '🌬', color: '#FF7000', model: 'mistral' },
] as const

export type LlmProviderId = typeof LLM_PROVIDERS[number]['id']

export interface LlmTabSlot {
  providerId:     LlmProviderId
  label:          string
  icon:           string
  color:          string
  cards:          LlmCard[]
  summaryTable:   SummaryTableData | null
  overflowLinks:  LinkResult[]
  sidebarFilters: SidebarFilterSection[]
  isLoading:      boolean
  hasSearched:    boolean
  searchTime:     number | null
  error:          string | null
}

async function callLlmProviderAPI(
  query: string,
  providerId: LlmProviderId,
  previousSummary = '',
): Promise<{ cards: LlmCard[]; summaryTable: SummaryTableData | null; overflowLinks: LinkResult[]; sidebarFilters: SidebarFilterSection[] }> {
  const res  = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, previousSummary, provider: providerId }),
  })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) } catch { throw new Error(`${providerId} API returned malformed JSON.`) }
  if (data.error) throw new Error(String(data.error))

  const rawCards = Array.isArray(data.cards) ? data.cards as Record<string, unknown>[] : []
  const cards: LlmCard[] = rawCards.map((r, i) => ({
    id:          String(r.id ?? `${providerId}-${i}`),
    rank:        Number(r.rank ?? i),
    type:        'llm' as const,
    zone:        'llm' as const,
    title:       String(r.title ?? 'Untitled'),
    snippet:     String(r.snippet ?? ''),
    steps:       Array.isArray(r.steps) ? r.steps.map(String) : [],
    math:        String(r.math ?? ''),
    solution:    String(r.solution ?? ''),
    tags:        Array.isArray(r.tags) ? r.tags.map(String) : [],
    difficulty:  String(r.difficulty ?? 'intermediate'),
    url:         '',
    source:      LLM_PROVIDERS.find(p => p.id === providerId)?.label ?? 'LLM',
    hasVideo:    false,
    visible:     true,
    docSelected: false,
  }))

  const summaryTable = (
    data.summaryTable &&
    typeof data.summaryTable === 'object' &&
    Array.isArray((data.summaryTable as any).headers) &&
    Array.isArray((data.summaryTable as any).rows)
  ) ? data.summaryTable as SummaryTableData : null

  const overflowLinks: LinkResult[] = Array.isArray(data.links)
    ? (data.links as Record<string, unknown>[]).map((r, i) => ({
        id:      String(r.id ?? `${providerId}-link-${i}`),
        rank:    Number(r.rank ?? i + 1),
        title:   String(r.title ?? 'Untitled'),
        url:     String(r.url ?? ''),
        snippet: String(r.snippet ?? ''),
      }))
    : []

  // ── THE FIX: properly parse sidebarFilters from API response ─────────────
  const sidebarFilters: SidebarFilterSection[] = Array.isArray(data.sidebarFilters)
    ? (data.sidebarFilters as any[])
        .filter((s: any) => s && s.id && s.label && s.type)
        .map((s: any) => ({
          id:      String(s.id),
          label:   String(s.label),
          type:    s.type as SidebarFilterSection['type'],
          options: Array.isArray(s.options) ? s.options.map(String) : [],
          ...(s.unit ? { unit: String(s.unit) } : {}),
        }))
    : []

  console.log(`[useLlmMulti] ${providerId} sidebarFilters from API:`, sidebarFilters.length, sidebarFilters.map(f => f.label))

  return { cards, summaryTable, overflowLinks, sidebarFilters }
}

export function useLlmMulti() {
  const [slots, setSlots] = useState<Record<string, LlmTabSlot>>({})

  const searchProvider = useCallback(async (
    providerId: LlmProviderId,
    query: string,
    previousSummary = '',
  ) => {
    const provider = LLM_PROVIDERS.find(p => p.id === providerId)!

    setSlots(prev => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] ?? {
          cards: [], summaryTable: null, overflowLinks: [], sidebarFilters: [],
          hasSearched: false, searchTime: null, error: null,
        }),
        providerId,
        label:       provider.label,
        icon:        provider.icon,
        color:       provider.color,
        isLoading:   true,
        hasSearched: true,
        error:       null,
      },
    }))

    const t0 = Date.now()
    try {
      const result = await callLlmProviderAPI(query, providerId, previousSummary)
      // ── THE FIX: save sidebarFilters into the slot ────────────────────────
      setSlots(prev => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          cards:          result.cards,
          summaryTable:   result.summaryTable,
          overflowLinks:  result.overflowLinks,
          sidebarFilters: result.sidebarFilters,   // ← was missing before
          isLoading:      false,
          searchTime:     Date.now() - t0,
          error:          null,
        },
      }))
    } catch (err) {
      setSlots(prev => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          isLoading:  false,
          error:      err instanceof Error ? err.message : String(err),
          searchTime: Date.now() - t0,
        },
      }))
    }
  }, [])

  const clearProvider = useCallback((providerId: LlmProviderId) => {
    setSlots(prev => { const next = { ...prev }; delete next[providerId]; return next })
  }, [])

  const clearAll = useCallback(() => setSlots({}), [])

  const dismissCard = useCallback((providerId: LlmProviderId, cardId: string) => {
    setSlots(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        cards: prev[providerId]?.cards.map(c =>
          c.id === cardId ? { ...c, visible: false, docSelected: false } : c
        ) ?? [],
      },
    }))
  }, [])

  const toggleDocSelect = useCallback((providerId: LlmProviderId, cardId: string) => {
    setSlots(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        cards: prev[providerId]?.cards.map(c =>
          c.id === cardId ? { ...c, docSelected: !c.docSelected } : c
        ) ?? [],
      },
    }))
  }, [])

  const activeSlots: LlmTabSlot[] = Object.values(slots)
    .filter(s => s.hasSearched)
    .sort((a, b) => {
      const ia = LLM_PROVIDERS.findIndex(p => p.id === a.providerId)
      const ib = LLM_PROVIDERS.findIndex(p => p.id === b.providerId)
      return ia - ib
    })

  const isAnyLoading = activeSlots.some(s => s.isLoading)

  const allMultiCards = activeSlots.flatMap(s =>
    s.cards.filter(c => c.visible && c.rank !== 0)
  )

  // Sidebar filters: from the first completed slot that returned filters
  const latestSidebarFilters: SidebarFilterSection[] = activeSlots
    .filter(s => !s.isLoading && s.sidebarFilters.length > 0)
    .slice(0, 1)
    .flatMap(s => s.sidebarFilters)

  return {
    slots, activeSlots, isAnyLoading, allMultiCards, latestSidebarFilters,
    searchProvider, clearProvider, clearAll, dismissCard, toggleDocSelect,
  }
}
