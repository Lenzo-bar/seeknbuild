import { useState, useCallback } from 'react'
import type { SearchCard, LinkResult, FilterState, CardZone, SidebarFilterSection, SearchMode } from '../types'
import { MORE_CARDS } from '../data/integralCards'
import { parseFileToCards } from '../utils/fileParser'

const DEFAULT_FILTERS: Record<string, SidebarFilterSection[]> = {
  'real-estate': [
    { id: 'price',   label: 'Price Range',   type: 'range',      unit: '$' },
    { id: 'beds',    label: 'Bedrooms',      type: 'radio',      options: ['Any','1','2','3','4','5+'] },
    { id: 'type',    label: 'Property Type', type: 'checkboxes', options: ['House','Condo','Townhouse','Land'] },
    { id: 'listing', label: 'Listing Type',  type: 'radio',      options: ['For Sale','For Rent'] },
  ],
  automotive: [
    { id: 'make',  label: 'Make',       type: 'checkboxes', options: ['Toyota','Honda','Ford','Chevrolet','BMW','Hyundai'] },
    { id: 'year',  label: 'Year Range', type: 'range',      unit: '' },
    { id: 'price', label: 'Price',      type: 'range',      unit: '$' },
    { id: 'cond',  label: 'Condition',  type: 'radio',      options: ['New','Used','Certified Pre-Owned'] },
  ],
  shopping: [
    { id: 'price',  label: 'Price Range', type: 'range', unit: '$' },
    { id: 'rating', label: 'Min Rating',  type: 'radio', options: ['Any','3+ stars','4+ stars'] },
  ],
  sports: [
    { id: 'league', label: 'League', type: 'checkboxes', options: ['NBA','NFL','NHL','MLB','MLS'] },
    { id: 'date',   label: 'Date',   type: 'select',     options: ['Today','This week','This month'] },
  ],
  news: [
    { id: 'date',   label: 'Date',   type: 'select',     options: ['Today','This week','This month'] },
    { id: 'source', label: 'Source', type: 'checkboxes', options: ['News','Blog','Official'] },
  ],
  general: [
    { id: 'ctype', label: 'Content Type', type: 'checkboxes', options: ['Article','Video','Forum','Blog'] },
    { id: 'date',  label: 'Date',         type: 'select',     options: ['Any time','Past week','Past month'] },
  ],
}

function detectTopic(query: string): string {
  const q = query.toLowerCase()
  if (/house|home|condo|apartment|rent|mortgage|real.?estate|bedroom|property|mls|zillow/.test(q)) return 'real-estate'
  if (/car|truck|suv|toyota|honda|ford|chevrolet|bmw|mercedes|auto|vehicle/.test(q)) return 'automotive'
  if (/buy|shop|price|deal|discount|amazon|product/.test(q)) return 'shopping'
  if (/nba|nfl|nhl|mlb|soccer|football|basketball|baseball|hockey|sport|score/.test(q)) return 'sports'
  if (/news|breaking|latest|headline/.test(q)) return 'news'
  return 'general'
}

async function callSearchAPI(query: string, searchMode: SearchMode, subMode: string): Promise<{
  cards: SearchCard[]
  links: LinkResult[]
  sidebarFilters: SidebarFilterSection[]
  topic: string
}> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, searchMode, subMode }),
  })

  // Read as text first so we can show raw error if not JSON
  const text = await res.text()

  let data: Record<string, unknown>
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`API returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }

  if (data.error) {
    throw new Error(String(data.error))
  }

  const rawCards = Array.isArray(data.cards) ? data.cards as Record<string, unknown>[] : []
  const sidebarFilters = Array.isArray(data.sidebarFilters) && (data.sidebarFilters as unknown[]).length > 0
    ? data.sidebarFilters as SidebarFilterSection[]
    : (DEFAULT_FILTERS[detectTopic(query)] || DEFAULT_FILTERS.general)

  const cards: SearchCard[] = rawCards.map((r, i) => ({
    id:            String(r.id    ?? `web-${i}`),
    zone:          'web' as CardZone,
    type:          (r.type as SearchCard['type']) ?? 'article',
    rank:          Number(r.rank  ?? i + 1),
    title:         String(r.title   ?? 'Untitled'),
    source:        String(r.url     ?? r.source ?? ''),
    snippet:       String(r.snippet ?? ''),
    tags:          Array.isArray(r.tags) ? r.tags as string[] : [],
    hasVideo:      r.type === 'video',
    visible:       true,
    docSelected:   false,
    imageUrl:      r.imageUrl      as string | undefined,
    videoChannel:  r.videoChannel  as string | undefined,
    videoDuration: r.videoDuration as string | undefined,
    publishedAt:   r.publishedAt   as string | undefined,
    outlet:        r.outlet        as string | undefined,
    price:         r.price         as string | undefined,
    rating:        typeof r.rating === 'number' ? r.rating : undefined,
    upvotes:       r.upvotes       as number | undefined,
    replies:       r.replies       as number | undefined,
    forum:         r.forum         as string | undefined,
  }))

  const links: LinkResult[] = Array.isArray(data.links)
    ? (data.links as Record<string, unknown>[]).map((r, i) => ({
        id:      String(r.id      ?? `link-${i}`),
        rank:    Number(r.rank    ?? i + 1),
        title:   String(r.title   ?? 'Untitled'),
        url:     String(r.url     ?? ''),
        snippet: String(r.snippet ?? ''),
      }))
    : []

  return { cards, links, sidebarFilters, topic: (data.topic as string) || "" }
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
  const [lastQuery,      setLastQuery]      = useState<string>('')
  const [lastMode,       setLastMode]       = useState<SearchMode>('all')
  const [lastSubMode,    setLastSubMode]    = useState<string>('')
  const [currentTopic,   setCurrentTopic]   = useState<string>("")

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
    // Show immediate default filters while waiting
    setSidebarFilters(DEFAULT_FILTERS[detectTopic(query)] || DEFAULT_FILTERS.general)

    setLastQuery(query)
    setLastMode(searchMode)
    setLastSubMode(subMode)
    try {
      const result = await callSearchAPI(query, searchMode, subMode)
      setWebCards(result.cards)
      setLinkResults(result.links)
      setSidebarFilters(result.sidebarFilters)
      setCurrentTopic(result.topic || "")
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
      const result = await callSearchAPI(question, 'all', '')
      const stamp = Date.now()
      setMoreCards(prev => [...prev, ...result.cards.map((c, i) => ({
        ...c, id: `more-${stamp}-${i}`, zone: 'more' as CardZone,
      }))])
    } catch {
      const stamp = Date.now()
      setMoreCards(prev => [
        ...prev,
        ...MORE_CARDS.map(c => ({ ...c, id: `${c.id}_${stamp}`, visible: true, docSelected: false })),
      ])
    }
  }, [])

  const refine = useCallback((filters: FilterState) => {
    setWebCards(prev => prev.map(card => {
      const { learnerLevel } = filters
      let visible = true
      if (learnerLevel && learnerLevel !== 'All levels') {
        if (learnerLevel === 'High school') visible = card.rank <= 4
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

  // Re-run search with filter context appended to original query
  const refineSearch = useCallback(async (filterSummary: string) => {
    if (!lastQuery) return
    const refinedQuery = `${lastQuery} — filter by: ${filterSummary}`
    setIsSearching(true)
    setApiError(null)
    setWebCards([])
    setLinkResults([])
    try {
      const result = await callSearchAPI(refinedQuery, lastMode, lastSubMode)
      setWebCards(result.cards)
      setLinkResults(result.links)
      setSidebarFilters(result.sidebarFilters)
      setCurrentTopic(result.topic || '')
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSearching(false)
    }
  }, [lastQuery, lastMode, lastSubMode])

  const allSelected = [
    ...webCards.filter(c => c.docSelected && c.visible && !c.hasVideo),
    ...fileCards.filter(c => c.docSelected && c.visible && !c.hasVideo),
    ...moreCards.filter(c => c.docSelected && c.visible && !c.hasVideo),
  ]

  return {
    webCards:  webCards.filter(c => c.visible),
    fileCards: fileCards.filter(c => c.visible),
    moreCards: moreCards.filter(c => c.visible),
    linkResults, allSelected, sidebarFilters, apiError, currentTopic,
    hasWeb, hasFile, hasMore, hasLinks, hasAny,
    isSearching, isAnalyzing,
    search, analyze, addMoreQuestion,
    refine, refineSearch, clearWeb, clearFile, clearMore, reset,
    dismissCard, toggleDocSelect, clearDocSelections, reorderCards,
    convertLinksToCards,
  }
}
