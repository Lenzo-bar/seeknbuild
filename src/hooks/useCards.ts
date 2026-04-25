import { useState, useCallback } from 'react'
import type { SearchCard, LinkResult, FilterState, CardZone } from '../types'
import { WEB_CARDS, MORE_CARDS, EXTRA_LINK_RESULTS } from '../data/integralCards'
import { parseFileToCards } from '../utils/fileParser'

function applyWebFilters(cards: SearchCard[], filters: FilterState): SearchCard[] {
  const { learnerLevel, extraFilter } = filters
  return cards.map(card => {
    let visible = true
    if (extraFilter && extraFilter !== 'Select a filter...') {
      if (extraFilter === 'Applications in physics')
        visible = card.tags.some(t => ['physics', 'work', 'vector field', 'flux'].includes(t))
      else if (extraFilter === 'Convergence & divergence focus')
        visible = card.tags.some(t => ['convergence', 'improper', 'singularity'].includes(t))
      else if (extraFilter === 'Visual / geometric interpretation')
        visible = card.hasVideo || card.tags.includes('Riemann sums') || card.tags.includes('visual')
      else if (extraFilter === 'Proof-based explanations')
        visible = card.tags.some(t => ['advanced', 'measure theory', 'real analysis'].includes(t))
      else if (extraFilter === 'Applications in engineering')
        visible = card.tags.some(t => ['3D', 'volume', 'flux', 'surface', 'mass'].includes(t))
    }
    if (learnerLevel && learnerLevel !== 'All levels') {
      if (learnerLevel === 'High school')
        visible = visible && (card.rank <= 4 || card.hasVideo)
      else if (['Middle school', 'Elementary school'].includes(learnerLevel))
        visible = visible && (card.rank <= 2 || card.hasVideo)
    }
    return { ...card, visible }
  })
}

export function useCards() {
  const [webCards,  setWebCards]  = useState<SearchCard[]>([])
  const [fileCards, setFileCards] = useState<SearchCard[]>([])
  const [moreCards, setMoreCards] = useState<SearchCard[]>([])
  const [linkResults, setLinkResults] = useState<LinkResult[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const hasWeb   = webCards.length  > 0
  const hasFile  = fileCards.length > 0
  const hasMore  = moreCards.length > 0
  const hasLinks = linkResults.length > 0
  const hasAny   = hasWeb || hasFile || hasMore

  const search = useCallback(() => {
    setWebCards(WEB_CARDS.map(c => ({ ...c, visible: true, docSelected: false })))
    setLinkResults(EXTRA_LINK_RESULTS)
  }, [])

  // Real file analysis — parses the actual File object
  const analyze = useCallback(async (file: File) => {
    setIsAnalyzing(true)
    setFileCards([])
    try {
      const cards = await parseFileToCards(file)
      setFileCards(cards)
    } catch {
      setFileCards([{
        id: 'file-error',
        zone: 'file', type: 'file', rank: 1,
        title: 'Could not parse file',
        source: file.name,
        snippet: 'The file could not be read. Supported formats: .txt, .md, .csv, .docx, .pdf (text layer).',
        tags: ['error'], hasVideo: false, visible: true, docSelected: false,
      }])
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const addMoreQuestion = useCallback(() => {
    const stamp = Date.now()
    setMoreCards(prev => [
      ...prev,
      ...MORE_CARDS.map(c => ({ ...c, id: c.id + '_' + stamp, visible: true, docSelected: false })),
    ])
  }, [])

  const refine = useCallback((filters: FilterState) => {
    setWebCards(prev => applyWebFilters(prev, filters))
  }, [])

  const clearWeb = useCallback(() => {
    setWebCards([]); setLinkResults([])
  }, [])

  const clearFile = useCallback(() => {
    setFileCards([])
  }, [])

  const clearMore = useCallback(() => {
    setMoreCards([])
  }, [])

  const reset = useCallback(() => {
    setWebCards([]); setFileCards([]); setMoreCards([]); setLinkResults([])
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
      const next = [...visible]
      const [moved] = next.splice(oldIndex, 1)
      next.splice(newIndex, 0, moved)
      return [...next, ...hidden]
    })
  }, [])

  const convertLinksToCards = useCallback((count: number) => {
    setLinkResults(prev => {
      const toConvert = prev.slice(0, count)
      const remaining = prev.slice(count)
      if (toConvert.length === 0) return prev
      const newCards: SearchCard[] = toConvert.map((link, i) => ({
        id: `link-card-${link.id}-${i}`,
        zone: 'web' as CardZone,
        type: 'article' as const,
        rank: WEB_CARDS.length + i + 1,
        title: link.title,
        source: link.url,
        snippet: link.snippet,
        tags: ['web', 'additional'],
        hasVideo: false,
        visible: true,
        docSelected: false,
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
    linkResults,
    allSelected,
    hasWeb, hasFile, hasMore, hasLinks, hasAny,
    isAnalyzing,
    search, analyze, addMoreQuestion,
    refine, clearWeb, clearFile, clearMore, reset,
    dismissCard, toggleDocSelect, clearDocSelections, reorderCards,
    convertLinksToCards,
  }
}
