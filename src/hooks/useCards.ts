import { useState, useCallback } from 'react'
import type { SearchCard, LinkResult, FilterState, CardZone, SidebarFilterSection, SearchMode } from '../types'
import { MORE_CARDS } from '../data/integralCards'
import { parseFileToCards } from '../utils/fileParser'

async function fetchLiveResults(
  query: string,
  searchMode: SearchMode,
  subMode: string
): Promise<{
  cards: SearchCard[]
  links: LinkResult[]
  sidebarFilters: SidebarFilterSection[]
  topic: string
  error?: string
} | null> {
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, searchMode, subMode }),
    })
    const data = await res.json()

    // Surface API errors instead of silently swallowing them
    if (data.error) {
      console.error('[SeekNBuild] API error:', data.error, data.raw ?? '')
      return { cards: [], links: [], sidebarFilters: [], topic: 'general', error: data.error }
    }

    const cards: SearchCard[] = (data.cards ?? []).map((r: SearchCard & { url?: string }, i: number) => ({
      id:            r.id ?? `web-${i}`,
      zone:          'web' as CardZone,
      type:          r.type ?? 'article',
      rank:          r.rank ?? i + 1,
      title:         r.title,
      source:        r.url ?? (r as SearchCard).source ?? '',
      snippet:       r.snippet,
      tags:          Array.isArray(r.tags) ? r.tags : ['web'],
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

    const sidebarFilters: SidebarFilterSection[] = (data.sidebarFilters ?? [])

    return { cards, links, sidebarFilters, topic: data.topic ?? 'general' }
  } catch (e) {
    console.error('[SeekNBuild] Fetch failed:', e)
    return null
  }
}

function applyWebFilters(cards: SearchCard[], filters: FilterState): SearchCard[] {
  const { learnerLevel, extraFilter } = filters
  return cards.map(card => {
    let visible = true
    if (extraFilter && extraFilter !== 'Select a filter...') {
      if (extraFilter === 'Applications in physics')
        visible = card.tags.some(t => ['physics','work','vector field','flux'].includes(t))
      else if (extraFilter === 'Convergence & divergence focus')
        visible = card.tags.some(t => ['convergence','improper','singularity'].includes(t))
      else if (extraFilter === 'Visual / geometric interpretation')
        visible = card.hasVideo || card.tags.includes('Riemann sums') || card.tags.includes('visual')
      else if (extraFilter === 'Proof-based explanations')
        visible = card.tags.some(t => ['advanced','measure theory','real analysis'].includes(t))
      else if (extraFilter === 'Applications in engineering')
        visible = card.tags.some(t => ['3D','volume','flux','surface','mass'].includes(t))
    }
    if (learnerLevel && learnerLevel !== 'All levels') {
      if (learnerLevel === 'High school')
        visible = visible && (card.rank <= 4 || card.hasVideo)
      else if (['Middle school','Elementary school'].includes(learnerLevel))
        visible = visible && (card.rank <= 2 || card.hasVideo)
    }
    return { ...card, visible }
  })
}

export function useCards() {
  const [webCards,       setWebCards]       = useState<SearchCard[]>([])
  const [fileCards,      setFileCards]      = useState<SearchCard[]>([])
  const [moreCards,      setMoreCards]      = useState<SearchCard[]>([])
  const [linkResults,    setLinkResults]    = useState<LinkResult[]>([])
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilterSection[]>([])
  const [isSearching,    setIsSearching]    = useState(false)
  const [isAnalyzing,    setIsAnalyzing]    = useState(false)
  const [isLive,         setIsLive]         = useState(false)
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

    const live = await fetchLiveResults(query, searchMode, subMode)

    if (live) {
      if (live.error) {
        setApiError(live.error)
        setIsLive(false)
      } else {
        setIsLive(true)
        setWebCards(live.cards)
        setLinkResults(live.links)
        setSidebarFilters(live.sidebarFilters)
      }
    } else {
      setApiError('Could not reach the search API. Check your network or API key in Vercel.')
      setIsLive(false)
    }

    setIsSearching(false)
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
        snippet: 'Supported: .txt, .md, .csv, .docx, .pdf (text layer).',
        tags: ['error'], hasVideo: false, visible: true, docSelected: false,
      }])
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const addMoreQuestion = useCallback(async (question: string) => {
    const live = await fetchLiveResults(question, 'all', '')
    const stamp = Date.now()
    if (live && !live.error && live.cards.length > 0) {
      setMoreCards(prev => [...prev, ...live.cards.map((c, i) => ({
        ...c, id: `more-live-${stamp}-${i}`, zone: 'more' as CardZone,
      }))])
    } else {
      setMoreCards(prev => [
        ...prev,
        ...MORE_CARDS.map(c => ({ ...c, id: c.id + '_' + stamp, visible: true, docSelected: false })),
      ])
    }
  }, [])

  const refine      = useCallback((filters: FilterState) => {
    setWebCards(prev => applyWebFilters(prev, filters))
  }, [])

  const clearWeb    = useCallback(() => { setWebCards([]); setLinkResults([]) }, [])
  const clearFile   = useCallback(() => { setFileCards([]) }, [])
  const clearMore   = useCallback(() => { setMoreCards([]) }, [])
  const reset       = useCallback(() => {
    setWebCards([]); setFileCards([]); setMoreCards([])
    setLinkResults([]); setSidebarFilters([]); setApiError(null)
  }, [])

  const dismissCard = useCallback((id: string, zone: CardZone) => {
    const setter = zone === 'web' ? setWebCards : zone === 'file' ? setFileCards : setMoreCards
    setter(prev => prev.map(c => c.id === id ? { ...c, visible: false, docSelected: false } : c))
  }, [])

  const toggleDocSelect = useCallback((id: string, zone: CardZone) => {
    const setter = zone === 'web' ? setWebCards : zone === 'file' ? setFileCards : setMoreCards
    setter(prev => prev.map(c => c.id === id && !c.hasVideo ? { ...c, docSelected: !c.docSelected } : c))
  }, [])

  const clearDocSelections = useCallback(() => {
    const clear = (prev: SearchCard[]) => prev.map(c => ({ ...c, docSelected: false }))
    setWebCards(clear); setFileCards(clear); setMoreCards(clear)
  }, [])

  const reorderCards = useCallback((zone: CardZone, oldIndex: number, newIndex: number) => {
    const setter = zone === 'web' ? setWebCards : zone === 'file' ? setFileCards : setMoreCards
    setter(prev => {
      const visible = prev.filter(c => c.visible)
      const hidden  = prev.filter(c => !c.visible)
      const next    = [...visible]
      const [moved] = next.splice(oldIndex, 1)
      next.splice(newIndex, 0, moved)
      return [...next, ...hidden]
    })
  }, [])

  const convertLinksToCards = useCallback((count: number) => {
    setLinkResults(prev => {
      const toConvert = prev.slice(0, count)
      const remaining = prev.slice(count)
      if (!toConvert.length) return prev
      const newCards: SearchCard[] = toConvert.map((link, i) => ({
        id: `link-card-${link.id}-${i}`, zone: 'web' as CardZone, type: 'article',
        rank: 21 + i, title: link.title, source: link.url, snippet: link.snippet,
        tags: ['web'], hasVideo: false, visible: true, docSelected: false,
      }))
      setWebCards(prev2 => [...prev2, ...newCards])
      return remaining
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
    isSearching, isAnalyzing, isLive,
    search, analyze, addMoreQuestion,
    refine, clearWeb, clearFile, clearMore, reset,
    dismissCard, toggleDocSelect, clearDocSelections, reorderCards,
    convertLinksToCards,
  }
}
