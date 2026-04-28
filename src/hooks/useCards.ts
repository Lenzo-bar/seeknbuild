import { useState, useCallback } from 'react'
import type { SearchCard, LinkResult, FilterState, CardZone, SidebarFilterSection, SearchMode } from '../types'
import { MORE_CARDS } from '../data/integralCards'
import { parseFileToCards } from '../utils/fileParser'

async function fetchLiveResults(query: string, searchMode: SearchMode, subMode: string) {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, searchMode, subMode }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error + (data.preview ? ` | preview: ${data.preview}` : ''))

  const cards: SearchCard[] = (data.cards ?? []).map((r: SearchCard & { url?: string }, i: number) => ({
    id:            r.id ?? `web-${i}`,
    zone:          'web' as CardZone,
    type:          (r.type as SearchCard['type']) ?? 'article',
    rank:          r.rank ?? i + 1,
    title:         r.title ?? 'Untitled',
    source:        (r as { url?: string }).url ?? (r as SearchCard).source ?? '',
    snippet:       r.snippet ?? '',
    tags:          Array.isArray(r.tags) ? r.tags : [],
    hasVideo:      r.type === 'video',
    visible:       true,
    docSelected:   false,
    imageUrl:      r.imageUrl,
    videoChannel:  r.videoChannel,
    videoDuration: r.videoDuration,
    publishedAt:   r.publishedAt,
    outlet:        r.outlet,
    price:         r.price,
    rating:        r.rating,
    upvotes:       r.upvotes,
    replies:       r.replies,
    forum:         r.forum,
  }))

  const links: LinkResult[] = (data.links ?? []).map((r: LinkResult) => ({
    id: r.id, rank: r.rank, title: r.title, url: r.url, snippet: r.snippet,
  }))

  return {
    cards,
    links,
    sidebarFilters: (data.sidebarFilters ?? []) as SidebarFilterSection[],
    topic: (data.topic ?? 'general') as string,
  }
}

export function useCards() {
  const [webCards,       setWebCards]       = useState<SearchCard[]>([])
  const [fileCards,      setFileCards]      = useState<SearchCard[]>([])
  const [moreCards,      setMoreCards]      = useState<SearchCard[]>([])
  const [linkResults,    setLinkResults]    = useState<LinkResult[]>([])
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilterSection[]>([])
  const [isSearching,    setIsSearching]    = useState(false)
  const [isAnalyzing,    setIsAnalyzing]    = useState(false)
  const [apiError,       setApiError]       = useState<string | null>(null)

  const hasWeb   = webCards.length  > 0
  const hasFile  = fileCards.length > 0
  const hasMore  = moreCards.length > 0
  const hasLinks = linkResults.length > 0
  const hasAny   = hasWeb || hasFile || hasMore

  const search = useCallback(async (query: string, searchMode: SearchMode = 'all', subMode = '') => {
    setIsSearching(true)
    setApiError(null)
    setWebCards([])
    setLinkResults([])
    setSidebarFilters([])

    try {
      const live = await fetchLiveResults(query, searchMode, subMode)
      setWebCards(live.cards)
      setLinkResults(live.links)
      setSidebarFilters(live.sidebarFilters)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSearching(false)
    }
  }, [])

  const analyze = useCallback(async (file: File) => {
    setIsAnalyzing(true)
    setFileCards([])
    try {
      const cards = await parseFileToCards(file)
      setFileCards(cards)
    } catch {
      setFileCards([{
        id: 'file-error', zone: 'file', type: 'file', rank: 1,
        title: 'Could not parse file', source: file.name,
        snippet: 'Supported: .txt .md .csv .docx .pdf',
        tags: ['error'], hasVideo: false, visible: true, docSelected: false,
      }])
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const addMoreQuestion = useCallback(async (question: string) => {
    try {
      const live = await fetchLiveResults(question, 'all', '')
      const stamp = Date.now()
      setMoreCards(prev => [...prev, ...live.cards.map((c, i) => ({
        ...c, id: `more-${stamp}-${i}`, zone: 'more' as CardZone,
      }))])
    } catch {
      const stamp = Date.now()
      setMoreCards(prev => [
        ...prev,
        ...MORE_CARDS.map(c => ({ ...c, id: c.id + '_' + stamp, visible: true, docSelected: false })),
      ])
    }
  }, [])

  const refine = useCallback((filters: FilterState) => {
    setWebCards(prev => prev.map(card => {
      const { learnerLevel, extraFilter } = filters
      let visible = true
      if (extraFilter && extraFilter !== 'Select a filter...') {
        visible = card.tags.some(t =>
          ['physics','work','vector field','flux','convergence','improper',
           'singularity','advanced','3D','volume','flux','surface','mass'].includes(t)
        )
      }
      if (learnerLevel && learnerLevel !== 'All levels') {
        if (learnerLevel === 'High school') visible = visible && card.rank <= 4
      }
      return { ...card, visible }
    }))
  }, [])

  const clearWeb  = useCallback(() => { setWebCards([]); setLinkResults([]) }, [])
  const clearFile = useCallback(() => { setFileCards([]) }, [])
  const clearMore = useCallback(() => { setMoreCards([]) }, [])
  const reset     = useCallback(() => {
    setWebCards([]); setFileCards([]); setMoreCards([])
    setLinkResults([]); setSidebarFilters([]); setApiError(null)
  }, [])

  const dismissCard = useCallback((id: string, zone: CardZone) => {
    const set = zone === 'web' ? setWebCards : zone === 'file' ? setFileCards : setMoreCards
    set(prev => prev.map(c => c.id === id ? { ...c, visible: false, docSelected: false } : c))
  }, [])

  const toggleDocSelect = useCallback((id: string, zone: CardZone) => {
    const set = zone === 'web' ? setWebCards : zone === 'file' ? setFileCards : setMoreCards
    set(prev => prev.map(c => c.id === id && !c.hasVideo ? { ...c, docSelected: !c.docSelected } : c))
  }, [])

  const clearDocSelections = useCallback(() => {
    const clear = (p: SearchCard[]) => p.map(c => ({ ...c, docSelected: false }))
    setWebCards(clear); setFileCards(clear); setMoreCards(clear)
  }, [])

  const reorderCards = useCallback((zone: CardZone, oldIdx: number, newIdx: number) => {
    const set = zone === 'web' ? setWebCards : zone === 'file' ? setFileCards : setMoreCards
    set(prev => {
      const vis = prev.filter(c => c.visible)
      const hid = prev.filter(c => !c.visible)
      const next = [...vis]
      const [m] = next.splice(oldIdx, 1)
      next.splice(newIdx, 0, m)
      return [...next, ...hid]
    })
  }, [])

  const convertLinksToCards = useCallback((count: number) => {
    setLinkResults(prev => {
      const take = prev.slice(0, count)
      const rest = prev.slice(count)
      if (!take.length) return prev
      setWebCards(p => [...p, ...take.map((l, i) => ({
        id: `link-${l.id}-${i}`, zone: 'web' as CardZone, type: 'article' as const,
        rank: 21 + i, title: l.title, source: l.url, snippet: l.snippet,
        tags: [], hasVideo: false, visible: true, docSelected: false,
      }))])
      return rest
    })
  }, [])

  const allSelected = [
    ...webCards.filter(c => c.docSelected && c.visible && !c.hasVideo),
    ...fileCards.filter(c => c.docSelected && c.visible && !c.hasVideo),
    ...moreCards.filter(c => c.docSelected && c.visible && !c.hasVideo),
  ]

  return {
    webCards:  webCards.filter(c => c.visible),
    fileCards: fileCards.filter(c => c.visible),
    moreCards: moreCards.filter(c => c.visible),
    linkResults, allSelected, sidebarFilters, apiError,
    hasWeb, hasFile, hasMore, hasLinks, hasAny,
    isSearching, isAnalyzing,
    search, analyze, addMoreQuestion,
    refine, clearWeb, clearFile, clearMore, reset,
    dismissCard, toggleDocSelect, clearDocSelections, reorderCards,
    convertLinksToCards,
  }
}
