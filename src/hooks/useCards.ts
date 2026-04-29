import { useState, useCallback } from 'react'
import type { SearchCard, LinkResult, FilterState, CardZone, SidebarFilterSection, SearchMode } from '../types'
import { MORE_CARDS } from '../data/integralCards'
import { parseFileToCards } from '../utils/fileParser'

const DEFAULT_FILTERS: Record<string, SidebarFilterSection[]> = {
  'real-estate': [
    { id: 'price',   label: 'Price Range',  type: 'range',      unit: '$' },
    { id: 'beds',    label: 'Bedrooms',     type: 'radio',      options: ['Any','1','2','3','4','5+'] },
    { id: 'type',    label: 'Property Type',type: 'checkboxes', options: ['House','Condo','Townhouse','Land'] },
    { id: 'listing', label: 'Listing Type', type: 'radio',      options: ['For Sale','For Rent'] },
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
  if (/house|home|condo|apartment|rent|mortgage|real.?estate|bedroom|property|mls|zillow|realtor/.test(q)) return 'real-estate'
  if (/car|truck|suv|vehicle|toyota|honda|ford|chevrolet|bmw|mercedes|auto|dealership/.test(q)) return 'automotive'
  if (/buy|shop|price|deal|discount|amazon|product|review/.test(q)) return 'shopping'
  if (/nba|nfl|nhl|mlb|soccer|football|basketball|baseball|hockey|sport|score|team|player/.test(q)) return 'sports'
  if (/news|breaking|latest|today|report|headline/.test(q)) return 'news'
  if (/movie|show|music|game|netflix|spotify|entertainment/.test(q)) return 'entertainment'
  if (/recipe|cook|food|restaurant/.test(q)) return 'travel'
  return 'general'
}

async function callAnthropicDirect(query: string, searchMode: SearchMode, subMode: string): Promise<{
  cards: SearchCard[]
  links: LinkResult[]
  sidebarFilters: SidebarFilterSection[]
}> {
  // Get API key from environment (Vite exposes VITE_ prefixed vars to the browser)
  const KEY = (import.meta as { env: Record<string, string> }).env.VITE_ANTHROPIC_API_KEY

  if (!KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY not found. Add it to your .env.local file.')
  }

  const modeHint: Record<string, string> = {
    all: 'broad mix of results', news: 'recent news articles', images: 'image results',
    videos: 'video results', forums: 'forum posts', shopping: 'product listings',
    entertainment: 'entertainment content', sports: 'sports news and scores', hobby: 'hobby guides',
  }

  const prompt = `Search the web for: "${query}"
Mode: ${searchMode}${subMode ? ` > ${subMode}` : ''}. Return ${modeHint[searchMode] || 'relevant results'}.

Reply with ONLY a JSON object. No markdown. No explanation. Must start with { and end with }.

{
  "synthesis": "2-3 sentence answer to the query based on search results",
  "topic": "one of: general|real-estate|automotive|shopping|sports|news|entertainment|hobby|tech|health|travel|finance",
  "cards": [
    {"title":"Result title","url":"https://example.com","snippet":"Description of result","tags":["tag1","tag2"]}
  ],
  "sidebarFilters": [
    {"id":"price","label":"Price Range","type":"range","unit":"$"},
    {"id":"type","label":"Type","type":"checkboxes","options":["Option A","Option B"]}
  ]
}

Generate 8-15 cards matching the query. Generate 3-5 sidebar filters matching the query domain.
Filter types: "checkboxes" | "radio" | "select" | "range" (range needs "unit" field).
Output ONLY the JSON.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const rawText = await res.text()
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${rawText.slice(0, 200)}`)

  let apiData: { content?: Array<{ type: string; text?: string }>; stop_reason?: string }
  try { apiData = JSON.parse(rawText) }
  catch { throw new Error(`Could not parse API response: ${rawText.slice(0, 100)}`) }

  const textBlock = apiData.content?.find(b => b.type === 'text')
  if (!textBlock?.text) {
    const types = apiData.content?.map(b => b.type).join(', ')
    throw new Error(`No text in response. Block types: ${types}. Stop reason: ${apiData.stop_reason}`)
  }

  let txt = textBlock.text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  const s = txt.indexOf('{')
  const e = txt.lastIndexOf('}')
  if (s === -1 || e === -1) throw new Error(`No JSON found in response: ${txt.slice(0, 100)}`)

  let parsed: {
    synthesis?: string
    topic?: string
    cards?: Array<Record<string, unknown>>
    sidebarFilters?: SidebarFilterSection[]
  }
  try { parsed = JSON.parse(txt.slice(s, e + 1)) }
  catch (err) { throw new Error(`JSON parse failed: ${(err as Error).message} | text: ${txt.slice(s, s + 100)}`) }

  const rawCards  = Array.isArray(parsed.cards) ? parsed.cards : []
  const synthesis = typeof parsed.synthesis === 'string' ? parsed.synthesis : ''
  const topic     = parsed.topic || detectTopic(query)

  const aiFilters = Array.isArray(parsed.sidebarFilters) && parsed.sidebarFilters.length > 0
    ? parsed.sidebarFilters
    : (DEFAULT_FILTERS[topic] || DEFAULT_FILTERS.general)

  const cards: SearchCard[] = []
  if (synthesis) {
    cards.push({
      id: 'synthesis-0', zone: 'web', rank: 0, type: 'article',
      title: `Summary: ${query.slice(0, 55)}${query.length > 55 ? '…' : ''}`,
      source: '', snippet: synthesis, tags: ['AI summary'],
      hasVideo: false, visible: true, docSelected: false,
    })
  }

  const typeMap: Record<string, SearchCard['type']> = {
    videos: 'video', images: 'image', news: 'news', forums: 'forum', shopping: 'shopping'
  }
  rawCards.slice(0, 20).forEach((r, i) => {
    cards.push({
      id: `web-${i}`, zone: 'web', rank: i + 1,
      type: typeMap[searchMode] || 'article',
      title:         String(r.title   ?? 'Untitled'),
      source:        String(r.url     ?? ''),
      snippet:       String(r.snippet ?? ''),
      tags:          Array.isArray(r.tags) ? r.tags as string[] : [],
      hasVideo:      searchMode === 'videos',
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
    })
  })

  const links: LinkResult[] = rawCards.slice(20).map((r, i) => ({
    id: `link-${i}`, rank: 21 + i,
    title: String(r.title ?? 'Untitled'), url: String(r.url ?? ''), snippet: String(r.snippet ?? ''),
  }))

  return { cards, links, sidebarFilters: aiFilters }
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
    // Show default filters immediately based on query topic while searching
    const immediateFilters = DEFAULT_FILTERS[detectTopic(query)] || DEFAULT_FILTERS.general
    setSidebarFilters(immediateFilters)

    try {
      const result = await callAnthropicDirect(query, searchMode, subMode)
      setWebCards(result.cards)
      setLinkResults(result.links)
      setSidebarFilters(result.sidebarFilters)
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
      const result = await callAnthropicDirect(question, 'all', '')
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