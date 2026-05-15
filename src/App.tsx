import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { PromptBox }          from './components/PromptBox'
import { SearchModeBar }      from './components/SearchModeBar'
import { SidebarFilters }     from './components/SidebarFilters'
import { ActiveFilterChips }  from './components/ActiveFilterChips'
import { DocBar }             from './components/DocBar'
import { Toolbar }            from './components/Toolbar'
import { CardGrid }           from './components/CardGrid'
import { CardPileGrid }       from './components/CardPileGrid'
import { CardGroupBar }       from './components/CardGroupBar'
import type { CardGroupOption } from './components/CardGroupBar'
import { SummaryBanner }      from './components/SummaryBanner'
import { LlmCard }            from './components/LlmCard'
import { FileCard }           from './components/FileCard'
import { FileDropZone }       from './components/FileDropZone'
import { ResultTabs }         from './components/ResultTabs'
import type { TabId, TabConfig } from './components/ResultTabs'
import { CardExpandOverlay }  from './components/CardExpandOverlay'
import { DocumentModal }      from './components/DocumentModal'
import { MoreQuestionPanel }  from './components/MoreQuestionPanel'
import { ZoneLabel }          from './components/ZoneLabel'
import { LinkZone }           from './components/LinkZone'
import { ExportLauncher }     from './components/ExportLauncher'
import { FileHistoryPanel }   from './components/FileHistoryPanel'
import { UrlListPanel }       from './components/UrlListPanel'
import { useCards }           from './hooks/useCards'
import { usePromptHistory }   from './hooks/usePromptHistory'
import { useFileHistory }     from './hooks/useFileHistory'
import { useUrlList }         from './hooks/useUrlList'
import { useLlmMulti, LLM_PROVIDERS } from './hooks/useLlmMulti'
import type { LlmProviderId } from './hooks/useLlmMulti'
import { getFilterCategory }  from './data/filterCategories'
import type { AppMode, CardZone, ThemeName, SearchMode, ActiveFilterChip, FilterCategory } from './types'
import styles from './App.module.css'

// ── Helpers (unchanged from v5.3) ─────────────────────────────────────────────
function isSameTopic(sessionTopic: string, newQuery: string): boolean {
  if (!sessionTopic) return false
  if (newQuery.trim() === sessionTopic.trim()) return true
  const STOPWORDS = new Set(['what','that','this','with','from','they','them','their','there','have','will','would','could','should','about','which','when','where','does','more','some','into','than','then','also','been','were','your','most','over','such','just','like','very','even','much','many','both','each','only','after','before','because','currently','plan','plans','tell','give','show','list','explain'])
  function keywords(text: string): Set<string> {
    return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 4 && !STOPWORDS.has(w)))
  }
  const sessionWords = keywords(sessionTopic)
  const newWords     = keywords(newQuery)
  let overlap = 0
  for (const w of newWords) { if (sessionWords.has(w)) overlap++ }
  const newRaw = newQuery.toLowerCase()
  for (const w of sessionWords) { if (newRaw.includes(w)) overlap++ }
  const isShortFollowUp = newWords.size <= 4
  return overlap > 0 || isShortFollowUp
}

function detectCategory(q: string, topic: string): FilterCategory {
  const s = (q + ' ' + topic).toLowerCase()
  if (/math|calculus|algebra|science|physics|chemistry|biology|history|philosophy|economics|engineering|medicine|law|university|student|research|theorem|proof|equation/.test(s)) return 'academia'
  if (/buy|sell|price|rent|lease|house|condo|car|shop|store|deal|discount|market|real estate|property|vehicle|product|amazon/.test(s)) return 'buying-selling'
  return 'general'
}

function fuseMode(explicit: SearchMode, query: string): SearchMode {
  const q = query.toLowerCase()
  if (explicit !== 'all') return explicit
  if (/\bvideo(s)?\b|\bwatch\b|\byoutube\b/.test(q))          return 'videos'
  if (/\bnews\b|\bheadline\b|\bbreaking\b/.test(q))           return 'news'
  if (/\bimage(s)?\b|\bphoto(s)?\b|\bpicture(s)?\b/.test(q)) return 'images'
  if (/\bforum\b|\breddit\b|\bdiscussion\b/.test(q))          return 'forums'
  if (/\bbuy\b|\bshop\b|\bprice\b|\bpurchase\b/.test(q))      return 'shopping'
  if (/\bsport\b|\bscore\b|\bnba\b|\bnfl\b/.test(q))          return 'sports'
  return 'all'
}

const FALLBACK_GROUPS: CardGroupOption[] = [
  { id:'source',     label:'By source',     description:'Group by website or publisher', subItems:[], cardKeyword:'source'     },
  { id:'type',       label:'By type',       description:'Group by content type',         subItems:[], cardKeyword:'type'       },
  { id:'topic',      label:'By topic',      description:'Group by subject matter',       subItems:[], cardKeyword:'topic'      },
  { id:'difficulty', label:'By difficulty', description:'Group by difficulty level',     subItems:[], cardKeyword:'difficulty' },
]

export default function App() {
  // ── Core cards hook ───────────────────────────────────────────────────────
  const {
    webCards, moreCards,
    llmCards, llmSummaryTable, llmCardGroups, hasLlmSearched, isLlmSearching, llmSearchTime,
    fileCards, fileSummaryTable, fileCardGroups, isAnalyzing, hasAnalyzed, analyzeTime,
    webOnlyCards, webOnlyLinks, hasWebOnlySearched, isWebOnlySearching, webOnlySearchTime,
    urlCards, urlSummaryTable, isUrlAnalyzing, hasUrlAnalyzed, urlAnalyzeTime, lastUrlTask,
    linkResults, sidebarFilters, setSidebarFilters, apiError,
    hasWeb, hasLlm, hasFile, hasWebOnly, hasUrls, hasMore, hasLinks, hasAny,
    isSearching, hasSearched, currentTopic,
    isFiltering, searchTime, filterTime, totalCards,
    summaryTable, cardGroups,
    search, llmSearch, analyzeFile, webonlySearch, analyzeUrls, addMoreQuestion, clientRefine,
    isMoreLoading,
    clearWeb, clearLlm, clearFile, clearWebOnly, clearUrls, reset,
    dismissCard, toggleDocSelect, clearDocSelections, reorderCards,
    convertLinksToCards, convertWebOnlyLinksToCards, webOnlyTyped,
    modeFilter, setModeFilter, filteredTyped,
  } = useCards()

  // ── Feature ①: Prompt history ─────────────────────────────────────────────
  const promptHistory = usePromptHistory()

  // ── Feature ③: File history ───────────────────────────────────────────────
  const fileHistory = useFileHistory()

  // ── Feature ④: URL list ───────────────────────────────────────────────────
  const urlList = useUrlList()

  // ── Feature ⑤: Multi-LLM ─────────────────────────────────────────────────
  const llmMulti = useLlmMulti()
  const [selectedLlms, setSelectedLlms] = useState<Set<LlmProviderId>>(new Set(['claude']))
  const [activeLlmTab,  setActiveLlmTab]  = useState<LlmProviderId | null>(null)

  function handleToggleLlm(id: LlmProviderId) {
    setSelectedLlms(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function handleSelectAllLlms() {
    setSelectedLlms(new Set(LLM_PROVIDERS.map(p => p.id)))
  }
  function handleClearLlms() {
    setSelectedLlms(new Set())
  }
  function handleMultiLlmSearch() {
    const q = currentQueryRef
    if (!q.trim() || selectedLlms.size === 0) return
    promptHistory.addEntry(q, 'llm')
    if (!sessionTopic) setSessionTopic(q)
    setSessionHasSearched(true)
    // keepFilters=false on first search so sidebar gets populated from provider response
    const keepFilters = llmMulti.activeSlots.length > 0 && sessionHasSearched
    for (const pid of selectedLlms) {
      const prevSummary = hasLlmSearched
        ? llmCards.find(c => c.rank === 0)?.snippet ?? ''
        : ''
      llmMulti.searchProvider(pid, q, prevSummary)
    }
    // Auto-select first provider tab
    const first = [...selectedLlms][0]
    setActiveLlmTab(first)
    setActiveTab('llm')
  }

  // Track query from PromptBox in a ref so handleMultiLlmSearch can read it
  const [currentQueryRef, setCurrentQueryRef] = useState('')

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<TabId>('web')
  const [cols,         setCols]         = useState(3)
  const [expandedId,   setExpandedId]   = useState<string|null>(null)
  const [expandedZone, setExpandedZone] = useState<string|null>(null)
  const [showDoc,      setShowDoc]      = useState(false)
  const [showMoreQ,    setShowMoreQ]    = useState(false)
  const [theme,        setTheme]        = useState<ThemeName>('light')
  const [searchMode,   setSearchMode]   = useState<SearchMode>('all')
  const [subMode,      setSubMode]      = useState('')
  const [activeChips,  setActiveChips]  = useState<ActiveFilterChip[]>([])
  const [filterCat,    setFilterCat]    = useState<FilterCategory>('general')
  const [filterResetKey,     setFilterResetKey]     = useState(0)
  const [locationRefreshKey, setLocationRefreshKey] = useState(0)
  const [removedChipId,      setRemovedChipId]      = useState<string|null>(null)
  const [lastWebQuery,       setLastWebQuery]        = useState('')
  const [lastAnalyzedUrls,   setLastAnalyzedUrls]   = useState<string[]>([])
  const [allFilterScope, setAllFilterScope] = useState<'all'|'web'|'llm'|'file'|'webonly'|'urls'>('all')
  const [currentAppMode, setCurrentAppMode] = useState<AppMode>('web')

  // ── Grouping ──────────────────────────────────────────────────────────────
  const [webGrpId,    setWebGrpId]    = useState<string|null>(null)
  const [webGrpOn,    setWebGrpOn]    = useState(false)
  const [webGrpName,  setWebGrpName]  = useState<string|undefined>(undefined)
  const [llmGrpId,    setLlmGrpId]    = useState<string|null>(null)
  const [llmGrpOn,    setLlmGrpOn]    = useState(false)
  const [llmGrpName,  setLlmGrpName]  = useState<string|undefined>(undefined)
  const [fileGrpId,   setFileGrpId]   = useState<string|null>(null)
  const [fileGrpOn,   setFileGrpOn]   = useState(false)
  const [fileGrpName, setFileGrpName] = useState<string|undefined>(undefined)
  const [woGrpId,     setWoGrpId]     = useState<string|null>(null)
  const [woGrpOn,     setWoGrpOn]     = useState(false)
  const [woGrpName,   setWoGrpName]   = useState<string|undefined>(undefined)
  const [urlGrpId,    setUrlGrpId]    = useState<string|null>(null)
  const [urlGrpOn,    setUrlGrpOn]    = useState(false)
  const [urlGrpName,  setUrlGrpName]  = useState<string|undefined>(undefined)
  const [allGrpId,    setAllGrpId]    = useState<string|null>(null)
  const [allGrpOn,    setAllGrpOn]    = useState(false)
  const [allGrpName,  setAllGrpName]  = useState<string|undefined>(undefined)

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [showTopicDlg,     setShowTopicDlg]     = useState(false)
  const [lockedTopic,      setLockedTopic]      = useState('')
  const [isFirstSearch,    setIsFirstSearch]    = useState(false)
  const [sameCtxOk,        setSameCtxOk]        = useState(false)
  const [sessionHasSearched, setSessionHasSearched] = useState(false)  // true after ANY first search
  const [dlgShownThisEdit, setDlgShownThisEdit] = useState(false)
  const [showAppendDlg,    setShowAppendDlg]    = useState(false)
  const [pendingQ,         setPendingQ]         = useState('')
  const [pendingM,         setPendingM]         = useState<SearchMode>('all')
  const [pendingS,         setPendingS]         = useState('')
  const [showLlmDlg,       setShowLlmDlg]       = useState(false)
  const [pendingLlmQ,      setPendingLlmQ]      = useState('')
  const [pendingSearchAfterTopic, setPendingSearchAfterTopic] = useState<{q:string,m:SearchMode,s:string}|null>(null)
  const [sessionTopic,     setSessionTopic]     = useState('')
  const [pendingAppMode,   setPendingAppMode]   = useState<AppMode>('web')

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(()=>{ document.documentElement.setAttribute('data-theme', theme) },[theme])
  useEffect(()=>{ if(!isSearching&&hasSearched){setIsFirstSearch(false);setSameCtxOk(true)} },[isSearching,hasSearched])
  useEffect(()=>{ 
    if(currentTopic && !hasLlmSearched) setFilterCat(getFilterCategory(currentTopic)) 
  },[currentTopic])
      
  useEffect(()=>{ if(!hasWeb){setWebGrpId(null);setWebGrpOn(false)} },[hasWeb])
  // Apply sidebar filters from multi-LLM slot when search completes
  useEffect(() => {
    if (!llmMulti.isAnyLoading && llmMulti.latestSidebarFilters.length > 0) {
      setSidebarFilters(llmMulti.latestSidebarFilters)
    }
  }, [llmMulti.isAnyLoading, llmMulti.latestSidebarFilters])

  // LLM multi: switch to llm tab only when loading transitions from true→false (search just completed)
  // Do NOT watch activeSlots array directly — it's a new reference every render and causes infinite loops
  const prevLlmLoadingRef = useRef(false)
  useEffect(()=>{
    const nowLoading = llmMulti.isAnyLoading
    if(prevLlmLoadingRef.current && !nowLoading && llmMulti.activeSlots.length > 0) {
      setActiveTab('llm')
    }
    prevLlmLoadingRef.current = nowLoading
  },[llmMulti.isAnyLoading])
  useEffect(()=>{ if(hasAnalyzed&&!isAnalyzing)setActiveTab('file') },[hasAnalyzed,isAnalyzing])
  useEffect(()=>{ if(hasWebOnlySearched&&!isWebOnlySearching)setActiveTab('webonly') },[hasWebOnlySearched,isWebOnlySearching])
  useEffect(()=>{ if(hasUrlAnalyzed&&!isUrlAnalyzing)setActiveTab('urls') },[hasUrlAnalyzed,isUrlAnalyzing])
  useEffect(()=>{ if(!isSearching&&activeChips.length>0) clientRefine(activeChips,'web') },[isSearching])
  useEffect(()=>{ if(!isWebOnlySearching&&activeChips.length>0) clientRefine(activeChips,'webonly') },[isWebOnlySearching])
  useEffect(()=>{ if(!isUrlAnalyzing&&activeChips.length>0) clientRefine(activeChips,'urls') },[isUrlAnalyzing])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getSummaryText()    { return webCards.find(c=>c.rank===0)?.snippet??'' }

  function freshSearch(query:string,mode:SearchMode,sub:string,append=false){
    promptHistory.addEntry(query, currentAppMode)   // ← ① save to history
    if(!sessionTopic) setSessionTopic(query)
    const isVeryFirst = !sessionHasSearched
    // Only update filterCat (sidebar label) on first-ever search or when no topic yet
    if(isVeryFirst) setFilterCat(detectCategory(query,''))
    // Only wipe active chips on the very first search — after that, dlgNo/Reset handle clearing
    if(isVeryFirst && !append){ setActiveChips([]); setFilterResetKey(k=>k+1) }
    setSessionHasSearched(true)
    setLockedTopic(query);setSameCtxOk(false);setDlgShownThisEdit(false);setIsFirstSearch(!append)
    setLastWebQuery(query)
    // keepFilters=true after first search so sidebar sections don't change on subsequent searches
    search(query,mode,sub,!isVeryFirst,append,append?getSummaryText():'')
    setActiveTab('web');setExpandedId(null);setShowDoc(false);setShowMoreQ(false)
  }
  function sameSearch(query:string,mode:SearchMode,sub:string,append=false){
    promptHistory.addEntry(query, currentAppMode)   // ← ① save to history
    setLockedTopic(query);setDlgShownThisEdit(false);setIsFirstSearch(false)
    search(query,mode,sub,true,append,append?getSummaryText():'')
    setActiveTab('web');setExpandedId(null)
  }

  function handleAppendYes(){ setShowAppendDlg(false); sameCtxOk?sameSearch(pendingQ,pendingM,pendingS,true):freshSearch(pendingQ,pendingM,pendingS,true) }
  function handleAppendNo(){  setShowAppendDlg(false); sameCtxOk?sameSearch(pendingQ,pendingM,pendingS,false):freshSearch(pendingQ,pendingM,pendingS,false) }

  /*

  function fireLlm(query: string) {
    promptHistory.addEntry(query, 'llm')
    if (!sessionTopic) setSessionTopic(query)
    setSessionHasSearched(true)
    // keepFilters=false on first LLM search so sidebar gets populated from API response.
    // keepFilters=true on subsequent same-topic searches so user's filters persist.
    const keepFilters = hasLlmSearched && sessionHasSearched
    setActiveTab('llm')
    llmSearch(query, hasLlmSearched ? (llmCards.find(c=>c.rank===0)?.snippet??'') : '', keepFilters)
    setExpandedId(null)
  }

  */

  function fireLlm(query: string) {
    console.log('🔥 fireLlm called, query:', query)   // ← ADD THIS
    promptHistory.addEntry(query, 'llm')
    if (!sessionTopic) setSessionTopic(query)
    setSessionHasSearched(true)
    const keepFilters = hasLlmSearched && sessionHasSearched
    console.log('🔥 keepFilters:', keepFilters)        // ← ADD THIS
    setActiveTab('llm')
    llmSearch(query, hasLlmSearched ? (llmCards.find(c=>c.rank===0)?.snippet??'') : '', keepFilters)
    setExpandedId(null)
  }

  function fireWebOnly(query: string) {
    promptHistory.addEntry(query, 'webonly')
    if (!sessionTopic) setSessionTopic(query)
    setSessionHasSearched(true)
    // keepFilters=false on first Web Only search so sidebar updates from results.
    // keepFilters=true on repeat searches about the same topic.
    const keepFilters = hasWebOnlySearched && sessionHasSearched
    webonlySearch(query, keepFilters)
    setExpandedId(null)
  }

  // Mode-to-category mapping so sidebar shows relevant filters immediately on mode switch
  const MODE_FILTER_CAT: Record<AppMode, FilterCategory> = {
    web:     'general',
    llm:     'general',
    file:    'general',
    webonly: 'general',
    urls:    'general',
  }

  function handleModeChange(newMode: AppMode) {
    setCurrentAppMode(newMode)
    setShowTopicDlg(false)
    setDlgShownThisEdit(false)
    setPendingSearchAfterTopic(null)
    // Keep existing filterCat if it was set by a real search; only reset when no topic locked
    if (!sessionTopic) setFilterCat(MODE_FILTER_CAT[newMode] ?? 'general')
  }

  function enrichQuery(query: string): string {
    if (!sessionTopic) return query
    if (query.trim() === sessionTopic.trim()) return query
    const words = query.trim().split(/\s+/)
    const isShort = words.length <= 6
    const isVague = /^(what|how|why|who|when|where|tell me|explain|list|give me|show me|any|are there|what about)/i.test(query.trim())
    if (isShort || isVague) return `${query.trim()} — in the context of: ${sessionTopic}`
    return query
  }

  function handleSearch(query: string, _mode: SearchMode, _sub: string, appMode: AppMode) {
    setCurrentQueryRef(query)   // capture for multi-LLM
    const mode = fuseMode(searchMode, query)
    const isDrift = hasAny && sessionTopic && activeChips.length > 0

    if (appMode === 'llm') {
      fireLlm(enrichQuery(query))
      return
    }
    if (appMode === 'file') return
    if (appMode === 'webonly') {
      setShowTopicDlg(false); setDlgShownThisEdit(false)
      setPendingSearchAfterTopic(null)
      const switchingModes = hasAny && sessionTopic && activeTab !== 'webonly'
      const driftDetected  = sessionTopic && !isSameTopic(sessionTopic, query)
      if (switchingModes || driftDetected) {
        setPendingSearchAfterTopic({ q: query, m: mode, s: subMode })
        setPendingAppMode('webonly')
        setLockedTopic(query)
        setShowTopicDlg(true)
      } else {
        // Send the raw query — do NOT enrich with old session topic when switching modes.
        // enrichQuery() would append the previous LLM topic context, causing wrong results.
        fireWebOnly(query)
      }
      return
    }
    if (appMode === 'urls') return

    if (!hasSearched) { freshSearch(query, mode, subMode); return }
    if (isDrift) {
      setPendingSearchAfterTopic({ q: query, m: mode, s: subMode })
      setPendingAppMode(appMode)
      setLockedTopic(query)
      setShowTopicDlg(true)
    } else {
      freshSearch(query, mode, subMode)
    }
  }

  function handlePromptChange(q: string) {
    setCurrentQueryRef(q)
  }

  function dlgYes() {
    setShowTopicDlg(false); setSameCtxOk(true)
    if (pendingSearchAfterTopic) {
      const { q, m, s } = pendingSearchAfterTopic
      setPendingSearchAfterTopic(null)
      if (pendingAppMode === 'llm')         fireLlm(enrichQuery(q))
      else if (pendingAppMode === 'webonly') fireWebOnly(enrichQuery(q))
      else sameSearch(q, m, s, false)
    }
  }
  function dlgNo() {
    setShowTopicDlg(false); setSameCtxOk(false)
    setActiveChips([]); setFilterResetKey(k=>k+1)
    setFilterCat('general'); setLockedTopic(''); clientRefine([])
    if (pendingSearchAfterTopic) {
      const { q, m, s } = pendingSearchAfterTopic
      setPendingSearchAfterTopic(null)
      if (pendingAppMode === 'llm')         fireLlm(enrichQuery(q))
      else if (pendingAppMode === 'webonly') fireWebOnly(enrichQuery(q))
      else freshSearch(q, m, s)
    }
  }
  function dlgDismiss() {
    setShowTopicDlg(false)
    setPendingSearchAfterTopic(null)
  }

  const handleRefine = useCallback((chips:ActiveFilterChip[])=>setActiveChips(chips),[])
  const handleApply  = useCallback((chips: ActiveFilterChip[]) => {
    setActiveChips(chips)
    clientRefine(chips, allFilterScope)
  }, [clientRefine, allFilterScope])

  function removeChip(id: string) {
    setActiveChips(prev => {
      const next = prev.filter(c => c.id !== id)
      if (next.length === 0) { setFilterResetKey(k=>k+1); setRemovedChipId(null) }
      else { setRemovedChipId(id) }
      clientRefine(next, allFilterScope)
      return next
    })
  }

  function handleReset(){
    reset(); llmMulti.clearAll()
    setSessionHasSearched(false)
    setActiveChips([]);setFilterResetKey(k=>k+1);setLockedTopic('')
    setSameCtxOk(false);setDlgShownThisEdit(false);setIsFirstSearch(false)
    setSessionTopic('');setFilterCat('general')
    setShowTopicDlg(false);setShowAppendDlg(false);setShowLlmDlg(false)
    setWebGrpId(null);setWebGrpOn(false)
    setLlmGrpId(null);setLlmGrpOn(false)
    setFileGrpId(null);setFileGrpOn(false)
    setWoGrpId(null);setWoGrpOn(false)
    setUrlGrpId(null);setUrlGrpOn(false)
    setAllGrpId(null);setAllGrpOn(false)
    setActiveTab('web');setExpandedId(null);setShowDoc(false);setShowMoreQ(false)
    setLastWebQuery('')
  }

  function mkGroupHandler(setId:any,setOn:any,setName:any){
    return(id:string|null)=>{
      if(!id){setId(null);setOn(false);setName(undefined);return}
      if(id.startsWith('custom:')){setName(id.slice(7));setId(id);setOn(true)}
      else{setName(undefined);setId(id);setOn(true)}
    }
  }
  const handleWebGroup  = useCallback(mkGroupHandler(setWebGrpId,  setWebGrpOn,  setWebGrpName),  [])
  const handleLlmGroup  = useCallback(mkGroupHandler(setLlmGrpId,  setLlmGrpOn,  setLlmGrpName),  [])
  const handleFileGroup = useCallback(mkGroupHandler(setFileGrpId, setFileGrpOn, setFileGrpName), [])
  const handleWoGroup   = useCallback(mkGroupHandler(setWoGrpId,   setWoGrpOn,   setWoGrpName),   [])
  const handleUrlGroup  = useCallback(mkGroupHandler(setUrlGrpId,  setUrlGrpOn,  setUrlGrpName),  [])
  const handleAllGroup  = useCallback(mkGroupHandler(setAllGrpId,  setAllGrpOn,  setAllGrpName),  [])

  // ── Groups ────────────────────────────────────────────────────────────────
  const webGroups  = useMemo(() => [...cardGroups,    ...(webGrpName  ? [{id:`custom:${webGrpName}`,  label:`By "${webGrpName}"`,  description:'Custom', subItems:[], cardKeyword:webGrpName.toLowerCase()}]  : [])], [cardGroups,    webGrpName])
  const llmGroups  = useMemo(() => [...llmCardGroups, ...(llmGrpName  ? [{id:`custom:${llmGrpName}`,  label:`By "${llmGrpName}"`,  description:'Custom', subItems:[], cardKeyword:llmGrpName.toLowerCase()}]  : [])], [llmCardGroups, llmGrpName])
  const fileGroups = useMemo(() => [...fileCardGroups,...(fileGrpName  ? [{id:`custom:${fileGrpName}`, label:`By "${fileGrpName}"`, description:'Custom', subItems:[], cardKeyword:fileGrpName.toLowerCase()}] : [])], [fileCardGroups,fileGrpName])
  const woGroups   = useMemo(() => FALLBACK_GROUPS.concat(woGrpName   ? [{id:`custom:${woGrpName}`,   label:`By "${woGrpName}"`,   description:'Custom', subItems:[], cardKeyword:woGrpName.toLowerCase()}]   : []), [woGrpName])
  const urlGroups  = useMemo(() => [
    {id:'domain', label:'By domain', description:'Group by website domain', subItems:[], cardKeyword:'domain'},
    {id:'task',   label:'By task',   description:'Group by analysis task',  subItems:[], cardKeyword:'task'},
    ...(urlGrpName ? [{id:`custom:${urlGrpName}`, label:`By "${urlGrpName}"`, description:'Custom', subItems:[], cardKeyword:urlGrpName.toLowerCase()}] : []),
  ], [urlGrpName])

  const allGroupsSeen = new Set<string>()
  const allGroups:CardGroupOption[] = [
    ...[...cardGroups,...llmCardGroups,...fileCardGroups,...FALLBACK_GROUPS].filter(g=>{ if(allGroupsSeen.has(g.id))return false; allGroupsSeen.add(g.id); return true }),
    ...(allGrpName?[{id:`custom:${allGrpName}`,label:`By "${allGrpName}"`,description:'Custom',subItems:[],cardKeyword:allGrpName.toLowerCase()}]:[]),
  ]
  const webActiveGroup  = webGroups.find(g=>g.id===webGrpId)??null
  const llmActiveGroup  = llmGroups.find(g=>g.id===llmGrpId)??null
  const fileActiveGroup = fileGroups.find(g=>g.id===fileGrpId)??null
  const woActiveGroup   = woGroups.find(g=>g.id===woGrpId)??null
  const urlActiveGroup  = urlGroups.find(g=>g.id===urlGrpId)??null
  const allActiveGroup  = allGroups.find(g=>g.id===allGrpId)??null

  // ── Multi-LLM cards + allCards (must be before tabs so badge count is correct) ──
  const allMultiLlmCards = llmMulti.activeSlots.flatMap(s => s.cards)

  // allCards = every visible card from every source including multi-LLM slots
  const allCards = [
    ...webCards.filter((c:any) => c.visible),
    ...(allMultiLlmCards.filter(c => c.visible) as any[]),
    ...(fileCards.filter((c:any) => c.visible) as any[]),
    ...webOnlyCards.filter(c => c.visible),
    ...urlCards.filter((c:any) => c.visible),
  ]

  // ── Tabs — dynamic multi-LLM tabs injected into LLM section ─────────────
  // For ResultTabs we still use the fixed 6-tab layout.
  // The LLM tab shows a sub-tab bar for providers inside the tab content.
  const multiLlmHasAny = llmMulti.activeSlots.length > 0
  const llmTabSlot = activeLlmTab ? llmMulti.slots[activeLlmTab] : llmMulti.activeSlots[0] ?? null

  const tabs: TabConfig[] = [
    {id:'web',     label:'Web + LLM',    count:webCards.filter(c=>c.rank!==0).length,        color:'blue',   icon:'🌐'},
    {id:'llm',     label:'LLM Only',     count:llmMulti.allMultiCards.length,                color:'teal',   icon:'⚙'},
    {id:'file',    label:'File Analysis',count:fileCards.filter((c:any)=>c.rank!==0).length, color:'amber',  icon:'📄'},
    {id:'webonly', label:'Web Only',      count:webOnlyCards.filter(c=>c.rank!==0).length,   color:'amber2', icon:'⚡'},
    {id:'urls',    label:'URL Analyzer',  count:urlCards.filter(c=>c.rank!==0).length,       color:'violet', icon:'🔗'},
    {id:'all',     label:'All Results',   count:allCards.filter((c:any)=>c.rank!==0).length, color:'purple', icon:'◈'},
  ]

  const isWorking = isSearching||isAnalyzing||isWebOnlySearching||isUrlAnalyzing||llmMulti.isAnyLoading

  const expandedCard = expandedId
    ? [...webCards,...(llmCards as any[]),...(fileCards as any[]),...webOnlyCards,...urlCards,...moreCards,...(allMultiLlmCards as any[])].find((c:any)=>c.id===expandedId)??null
    : null

  const webSummaryCard  = webCards.find(c=>c.rank===0)??null
  const webGridCards    = webCards.filter(c=>c.rank!==0)
  const fileSummaryCard = fileCards.find((c:any)=>c.rank===0)??null
  const fileGridCards   = fileCards.filter((c:any)=>c.rank!==0)
  const woGridCards     = webOnlyCards.filter(c=>c.rank!==0)
  const urlSummaryCard  = urlCards.find(c=>c.rank===0)??null
  const urlGridCards    = urlCards.filter(c=>c.rank!==0)
  const allGridCards    = allCards.filter((c:any)=>c.rank!==0)

  // allSelected includes doc-selected multi-LLM cards
  const allSelected = [
    ...webCards.filter((c:any) => c.docSelected && c.visible && !c.hasVideo),
    ...allMultiLlmCards.filter(c => c.docSelected && c.visible),
    ...(fileCards.filter((c:any) => c.docSelected && c.visible) as any[]),
    ...webOnlyCards.filter(c => c.docSelected && c.visible && !c.hasVideo),
    ...urlCards.filter((c:any) => c.docSelected && c.visible),
    ...moreCards.filter((c:any) => c.docSelected && c.visible && !c.hasVideo),
  ]


  const filteredLinks = activeChips.length===0?linkResults:linkResults.filter(l=>{
    const t=(l.title+' '+l.snippet+' '+l.url).toLowerCase()
    return activeChips.every(c=>t.includes(c.value.toLowerCase()))
  })

  // ── Feature ⑥: All Results export handler ─────────────────────────────────
  function handleExport(targetId: string) {
    // For now open a dialog / notify; actual generation to be wired per target
    alert(`Export to "${targetId}" — integration coming. Your ${allGridCards.length} assembled cards are ready.`)
  }

  const Dlg=({children,z=2000}:{children:React.ReactNode;z?:number})=>(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:z,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'all'}}
      onClick={e=>e.stopPropagation()}>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'28px 32px',maxWidth:440,width:'90vw',boxShadow:'var(--shadow-overlay)',display:'flex',flexDirection:'column',gap:16,position:'relative'}}
        onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
  const bO:React.CSSProperties={padding:'9px 22px',borderRadius:'var(--r-md)',border:'1px solid var(--border-mid)',background:'var(--surface-2)',color:'var(--text-1)',fontSize:13,fontWeight:600,cursor:'pointer'}
  const bP:React.CSSProperties={padding:'9px 22px',borderRadius:'var(--r-md)',border:'none',background:'var(--navy)',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}
  const bTxt:React.CSSProperties={fontSize:13,color:'var(--text-2)',lineHeight:1.65}
  const bChp:React.CSSProperties={fontSize:12,color:'var(--teal)',background:'var(--teal-light)',borderRadius:'var(--r-sm)',padding:'7px 11px',lineHeight:1.5}

  // ── History dialog chip row shown in topic dialog (Feature ②) ────────────
  const historyForCurrentMode = promptHistory.getForMode(currentAppMode).slice(0, 5)

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>S</span>
          <span className={styles.logoText}>SeekNBuild</span>
          <span className={styles.logoBeta}>v6</span>
        </div>
        <div className={styles.themeSwitcher}>
          <span className={styles.themeLabel}>Theme</span>
          {(['light','warm','dark','blue'] as ThemeName[]).map(t=>(
            <button key={t} className={`${styles.themeBtn} ${theme===t?styles.themeBtnOn:''}`} onClick={()=>setTheme(t)} title={t}>
              {t==='light'?'☀':t==='warm'?'🌤':t==='dark'?'🌙':'🔷'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Append dialog ── */}
      {showAppendDlg&&<Dlg z={2100}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:26}}>📋</span><p style={{fontSize:15,fontWeight:700,color:'var(--text-1)',lineHeight:1.3}}>Remove previous findings?</p></div>
        <p style={bTxt}>Remove existing results and start fresh, or keep them and append new results below?</p>
        {pendingQ&&<div style={bChp}>New search: <strong>"{pendingQ.length>60?pendingQ.slice(0,60)+'...':pendingQ}"</strong></div>}
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:4}}>
          <button style={bO} onClick={handleAppendYes}>No, keep previous</button>
          <button style={bP} onClick={handleAppendNo}>Yes, remove</button>
        </div>
      </Dlg>}

      {/* ── Topic dialog — Feature ②: history chips shown ── */}
      {showTopicDlg&&<Dlg z={2000}>
        <button onClick={dlgDismiss} style={{position:'absolute',top:12,right:12,width:28,height:28,borderRadius:'var(--r-sm)',border:'1px solid var(--border)',background:'transparent',color:'var(--text-3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>×</button>
        <div style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:24}}>🔎</span><p style={{fontSize:15,fontWeight:700,color:'var(--text-1)',lineHeight:1.3}}>Is this still the same topic?</p></div>
        <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65}}>You've switched modes or changed your prompt. Still the same subject?</p>
        {lockedTopic&&<div style={bChp}>Current: <strong>"{lockedTopic.length>70?lockedTopic.slice(0,70)+'...':lockedTopic}"</strong></div>}

        {/* Feature ②: show recent history chips so user can reuse string1 */}
        {historyForCurrentMode.length > 1 && (
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>
              Recent prompts — click to reuse:
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {historyForCurrentMode.slice(1).map(e => (
                <button key={e.id} onClick={()=>{ dlgDismiss(); /* user picks a past prompt — they can re-run from history panel */ }}
                  style={{fontSize:11,padding:'4px 9px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface-2)',color:'var(--text-2)',cursor:'pointer',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                  title={e.query}
                >
                  {e.query.length>45?e.query.slice(0,45)+'…':e.query}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:4}}>
          <button style={bO} onClick={dlgYes}>Yes, keep filters</button>
          <button style={bP} onClick={dlgNo}>No, reset filters</button>
        </div>
      </Dlg>}

      <div className={styles.layout}>
        <aside className={styles.sidebarCol}>
          <SidebarFilters
            category={filterCat} topic={currentTopic||''} sections={sidebarFilters}
            isFirstSearch={isFirstSearch} resetKey={filterResetKey}
            locationRefreshKey={locationRefreshKey} removedChipId={removedChipId}
            onRefine={handleRefine} onApply={handleApply}
          />
        </aside>

        <main className={styles.mainCol}>

          <PromptBox
            topicDlgOpen={showTopicDlg}
            onModeChange={handleModeChange}
            sessionTopic={sessionTopic}
            hasAny={hasAny} hasWeb={hasWeb||hasLinks} hasFile={hasFile}
            isAnalyzing={isAnalyzing} isSearching={isWorking}
            hasSearched={hasSearched||hasLlmSearched||hasAnalyzed}
            hasActiveFilters={activeChips.length>0}
            searchMode={searchMode} subMode={subMode}
            onSearch={handleSearch}
            onPromptChange={handlePromptChange}
            onAnalyze={f=>{ fileHistory.addFile(f,''); analyzeFile(f,'',true); setExpandedId(null) }}
            onAnalyzeSolve={f=>{ fileHistory.addFile(f,'solve'); analyzeFile(f,'solve all math problems step by step with KaTeX formulas',true); setExpandedId(null) }}
            onAnalyzeUrls={(urls, task) => {
              setLastAnalyzedUrls(urls)
              urlList.addUrls(urls, task)    // ← ④ save to URL list
              analyzeUrls(urls, task, '', true)
              setExpandedId(null)
            }}
            onMoreQuestion={()=>setShowMoreQ(v=>!v)}
            onClearWeb={clearWeb} onClearFile={clearFile} onReset={handleReset}
            currentMode={currentAppMode}
            historyEntries={promptHistory.entries}
            onHistorySelect={q => setCurrentQueryRef(q)}
            onHistoryRemove={promptHistory.removeEntry}
            onHistoryClear={promptHistory.clearMode}
            onHistoryClearAll={promptHistory.clearAll}
            selectedLlms={selectedLlms}
            isMultiLlmLoading={llmMulti.isAnyLoading}
            onToggleLlm={handleToggleLlm}
            onSelectAllLlms={handleSelectAllLlms}
            onClearLlms={handleClearLlms}
            onMultiLlmSearch={handleMultiLlmSearch}
          />

          <SearchModeBar active={searchMode} subMode={subMode} onChange={(m, s) => {
            setSearchMode(m); setSubMode(s || '')
            if (activeTab === 'webonly') setModeFilter(m === 'all' ? 'all' : m)
          }} />

          <ActiveFilterChips chips={activeChips} onRemove={removeChip}
            onClearAll={()=>{setActiveChips([]);setFilterResetKey(k=>k+1);clientRefine([])}} />

          {apiError&&<div className={styles.errorBanner}><strong>⚠ Error:</strong> {apiError}</div>}

          {showMoreQ && (
            <MoreQuestionPanel
              isLoading={isMoreLoading}
              onSubmit={q => {
                if (activeTab === 'urls' && lastAnalyzedUrls.length > 0) {
                  analyzeUrls(lastAnalyzedUrls, lastUrlTask, q, true)
                } else {
                  addMoreQuestion(q)
                }
                setShowMoreQ(false)
              }}
              onCancel={() => setShowMoreQ(false)}
            />
          )}
          {allSelected.length>0&&<DocBar count={allSelected.length} onBuild={()=>setShowDoc(true)} onClear={clearDocSelections}/>}

          {(hasAny||multiLlmHasAny||isWorking)&&<ResultTabs activeTab={activeTab} tabs={tabs} onChange={setActiveTab}/>}

          {(hasAny||multiLlmHasAny||isWorking)&&(
            <Toolbar
              visible={
                activeTab==='web'?webGridCards.length:
                activeTab==='llm'?llmMulti.allMultiCards.length:
                activeTab==='file'?fileGridCards.length:
                activeTab==='webonly'?woGridCards.length:
                activeTab==='urls'?urlGridCards.length:
                allGridCards.length
              }
              total={
                activeTab==='web'?totalCards:
                activeTab==='llm'?llmMulti.allMultiCards.length:
                activeTab==='file'?fileCards.length:
                activeTab==='webonly'?webOnlyCards.length:
                activeTab==='urls'?urlCards.length:
                allCards.length
              }
              cols={cols} isSearching={isWorking} isFiltering={isFiltering}
              searchTime={
                activeTab==='file'?analyzeTime:
                activeTab==='webonly'?webOnlySearchTime:
                activeTab==='urls'?urlAnalyzeTime:
                searchTime
              }
              filterTime={filterTime} onColsChange={setCols}
            />
          )}

          {expandedCard&&<CardExpandOverlay card={expandedCard} onClose={()=>setExpandedId(null)} onToggleDoc={()=>{ const ms=llmMulti.activeSlots.find(s=>s.cards.some(c=>c.id===expandedCard.id)); if(ms) llmMulti.toggleDocSelect(ms.providerId,expandedCard.id); else if(expandedZone) toggleDocSelect(expandedCard.id,expandedZone) }}/>}
          {showDoc&&<DocumentModal cards={allSelected as any} onClose={()=>setShowDoc(false)}/>}

          {/* ══ TAB 1: Web + LLM ══ */}
          {activeTab==='web'&&(
            <div className={styles.zone}>
              {isSearching&&<div className={styles.tabEmpty}><span style={{fontSize:28}}>🌐</span><p>Searching the web...</p></div>}
              {webSummaryCard?.visible&&(
                <SummaryBanner card={webSummaryCard} summaryTable={summaryTable}
                  onExpand={()=>{setExpandedId(p=>p===webSummaryCard.id?null:webSummaryCard.id);setExpandedZone('web')}}
                  onDismiss={()=>dismissCard(webSummaryCard.id,'web')}
                  onToggleDoc={()=>toggleDocSelect(webSummaryCard.id,'web')}/>
              )}
              {hasWeb&&(
                <CardGroupBar groups={webGroups.length>0?webGroups:FALLBACK_GROUPS} activeGroupId={webGrpId} groupingEnabled={webGrpOn}
                  onGroupChange={handleWebGroup} onToggle={setWebGrpOn}/>
              )}
              {hasWeb&&!isSearching&&(webGrpOn&&webActiveGroup?(
                <CardPileGrid cards={webGridCards} zone="web" cols={cols} activeGroup={webActiveGroup} customGroupName={webGrpName}
                  expandedId={expandedId} onReorder={reorderCards}
                  onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('web')}}
                  onDismiss={id=>dismissCard(id,'web')} onToggleDoc={id=>toggleDocSelect(id,'web')}/>
              ):(
                <CardGrid cards={webGridCards} zone="web" cols={cols} expandedId={expandedId} onReorder={reorderCards}
                  onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('web')}}
                  onDismiss={id=>dismissCard(id,'web')} onToggleDoc={id=>toggleDocSelect(id,'web')}/>
              ))}
              {hasLinks&&<div style={{marginTop:16}}><LinkZone links={filteredLinks} onConvert={convertLinksToCards}/></div>}
              {!hasWeb&&!isSearching&&(
                <div className={styles.tabEmpty}><span style={{fontSize:32}}>🌐</span><p>Select <strong>Web + LLM</strong> in the prompt and search.</p></div>
              )}
            </div>
          )}

          {/* ══ TAB 2: LLM Only — multi-provider sub-tabs (Feature ⑤) ══ */}
          {activeTab==='llm'&&(
            <div className={styles.zone}>
              {/* Provider sub-tab bar */}
              {llmMulti.activeSlots.length > 1 && (
                <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:6, marginBottom:8 }}>
                  {llmMulti.activeSlots.map(slot => (
                    <button key={slot.providerId}
                      onClick={() => setActiveLlmTab(slot.providerId)}
                      style={{
                        display:'flex', alignItems:'center', gap:5, padding:'6px 12px',
                        borderRadius:'var(--r-md)', border:`2px solid ${activeLlmTab===slot.providerId?slot.color:'var(--border)'}`,
                        background: activeLlmTab===slot.providerId ? slot.color+'14' : 'var(--surface-2)',
                        color: activeLlmTab===slot.providerId ? slot.color : 'var(--text-2)',
                        fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                      }}>
                      <span>{slot.icon}</span>
                      {slot.label}
                      {slot.isLoading
                        ? <span style={{fontSize:10}}>⟳</span>
                        : <span style={{fontSize:10,opacity:0.7}}>{slot.cards.filter(c=>c.rank!==0&&c.visible).length}</span>
                      }
                    </button>
                  ))}
                </div>
              )}

              {/* Active provider content */}
              {llmTabSlot ? (
                <>
                  {llmTabSlot.isLoading && (
                    <div className={styles.tabEmpty}>
                      <span style={{fontSize:28}}>{llmTabSlot.icon}</span>
                      <p>{llmTabSlot.label} is working on your question...</p>
                    </div>
                  )}
                  {llmTabSlot.error && (
                    <div className={styles.errorBanner}><strong>⚠ {llmTabSlot.label}:</strong> {llmTabSlot.error}</div>
                  )}
                  {!llmTabSlot.isLoading && llmTabSlot.summaryTable && (
                    <SummaryBanner
                      card={{id:`${llmTabSlot.providerId}-summary`,rank:0,type:'llm',zone:'llm',
                        title:`${llmTabSlot.label} Summary`,snippet:llmTabSlot.cards.find(c=>c.rank===0)?.snippet??'',
                        steps:[],math:'',solution:'',tags:[],difficulty:'',url:'',source:llmTabSlot.label,
                        hasVideo:false,visible:true,docSelected:false} as any}
                      summaryTable={llmTabSlot.summaryTable}
                      onExpand={()=>{}}
                      onDismiss={()=>{}}
                      onToggleDoc={()=>{}}
                    />
                  )}
                  {!llmTabSlot.isLoading && (
                    <CardGroupBar groups={llmGroups.length>0?llmGroups:FALLBACK_GROUPS}
                      activeGroupId={llmGrpId} groupingEnabled={llmGrpOn}
                      onGroupChange={handleLlmGroup} onToggle={setLlmGrpOn}/>
                  )}
                  {!llmTabSlot.isLoading && (
                    <CardGrid
                      cards={llmTabSlot.cards.filter(c=>c.rank!==0&&c.visible) as any}
                      zone={'llm' as CardZone} cols={cols} expandedId={expandedId} onReorder={reorderCards}
                      onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('llm')}}
                      onDismiss={id=>llmMulti.dismissCard(llmTabSlot.providerId,id)}
                      onToggleDoc={id=>llmMulti.toggleDocSelect(llmTabSlot.providerId,id)}/>
                  )}
                  {/* Overflow web links (5a) */}
                  {!llmTabSlot.isLoading && llmTabSlot.overflowLinks.length > 0 && (
                    <div style={{marginTop:16}}>
                      <div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>
                        Additional web links
                      </div>
                      <LinkZone links={llmTabSlot.overflowLinks} onConvert={count=>{
                        // Convert overflow links to LLM tab cards
                      }}/>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.tabEmpty}>
                  <span style={{fontSize:32}}>⚙</span>
                  <p>Select <strong>LLM Only</strong>, choose one or more LLMs, and ask a question.</p>
                  <p style={{fontSize:12,color:'var(--text-3)',marginTop:4}}>Each LLM you pick gets its own tab with a summary, cards, and web links.</p>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB 3: File Analysis — Feature ③ file history ══ */}
          {activeTab==='file'&&(
            <div className={styles.zone}>
              {/* Feature ③: file history panel */}
              <FileHistoryPanel
                entries={fileHistory.entries}
                onReuse={entry => {
                  // Can only hint — user needs the actual file object.
                  // Show a toast/note; the file drop zone handles re-drop.
                  alert(`Re-drop "${entry.name}" into the drop zone to re-analyze it.`)
                }}
                onRemove={fileHistory.removeEntry}
                onClearAll={fileHistory.clearAll}
              />
              <FileDropZone isAnalyzing={isAnalyzing} onAnalyze={(file,prompt)=>{ fileHistory.addFile(file,prompt); analyzeFile(file,prompt,true); setExpandedId(null)}}/>
              {fileSummaryCard?.visible&&(
                <SummaryBanner card={fileSummaryCard as any} summaryTable={fileSummaryTable}
                  onExpand={()=>{setExpandedId(p=>p===fileSummaryCard.id?null:fileSummaryCard.id);setExpandedZone('file')}}
                  onDismiss={()=>dismissCard(fileSummaryCard.id,'file')}
                  onToggleDoc={()=>toggleDocSelect(fileSummaryCard.id,'file')}/>
              )}
              {hasFile&&(
                <CardGroupBar groups={fileGroups.length>0?fileGroups:FALLBACK_GROUPS} activeGroupId={fileGrpId} groupingEnabled={fileGrpOn}
                  onGroupChange={handleFileGroup} onToggle={setFileGrpOn}/>
              )}
              {hasFile&&!isAnalyzing&&(fileGrpOn&&fileActiveGroup?(
                <CardPileGrid cards={fileGridCards as any} zone={'file' as CardZone} cols={cols} activeGroup={fileActiveGroup} customGroupName={fileGrpName}
                  expandedId={expandedId} onReorder={reorderCards}
                  onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('file')}}
                  onDismiss={id=>dismissCard(id,'file')} onToggleDoc={id=>toggleDocSelect(id,'file')}/>
              ):(
                <CardGrid cards={fileGridCards as any} zone={'file' as CardZone} cols={cols} expandedId={expandedId} onReorder={reorderCards}
                  onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('file')}}
                  onDismiss={id=>dismissCard(id,'file')} onToggleDoc={id=>toggleDocSelect(id,'file')}/>
              ))}
              {isAnalyzing&&<div className={styles.tabEmpty}><span style={{fontSize:28}}>📄</span><p>Claude is analyzing your file...</p></div>}
              {!hasFile&&!isAnalyzing&&fileHistory.entries.length===0&&(
                <div className={styles.tabEmpty}>
                  <span style={{fontSize:32}}>📄</span>
                  <p>Use the drop zone above to upload a file and analyze its contents into rich cards.</p>
                </div>
              )}
            </div>
          )}

          {/* ══ TAB 4: Web Only ══ */}
          {activeTab==='webonly'&&(
            <div className={styles.zone}>
              {hasWebOnly&&!isWebOnlySearching&&(
                <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'14px 18px',marginBottom:4,display:'flex',flexDirection:'column',gap:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:18}}>⚡</span>
                    <span style={{fontSize:14,fontWeight:700,color:'var(--text-1)'}}>Web Only Results</span>
                    <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:10,background:'#FAEEDA',color:'#854F0B',marginLeft:4}}>
                      {woGridCards.length} cards
                    </span>
                    {webOnlySearchTime&&<span style={{marginLeft:'auto',fontSize:11,color:'var(--text-3)'}}>{(webOnlySearchTime/1000).toFixed(2)}s</span>}
                  </div>
                </div>
              )}
              {hasWebOnly&&<CardGroupBar groups={woGroups} activeGroupId={woGrpId} groupingEnabled={woGrpOn} onGroupChange={handleWoGroup} onToggle={setWoGrpOn}/>}
              {hasWebOnly&&!isWebOnlySearching&&(woGrpOn&&woActiveGroup?(
                <CardPileGrid cards={woGridCards} zone={'webonly' as CardZone} cols={cols} activeGroup={woActiveGroup} customGroupName={woGrpName}
                  expandedId={expandedId} onReorder={reorderCards}
                  onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('webonly')}}
                  onDismiss={id=>dismissCard(id,'webonly')} onToggleDoc={id=>toggleDocSelect(id,'webonly')}/>
              ):(
                <CardGrid cards={woGridCards} zone={'webonly' as CardZone} cols={cols} expandedId={expandedId} onReorder={reorderCards}
                  onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('webonly')}}
                  onDismiss={id=>dismissCard(id,'webonly')} onToggleDoc={id=>toggleDocSelect(id,'webonly')}/>
              ))}
              {hasWebOnly&&!isWebOnlySearching&&webOnlyLinks.length>0&&(
                <div style={{marginTop:16}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>More Web Only results</div>
                  <LinkZone links={webOnlyLinks} onConvert={convertWebOnlyLinksToCards}/>
                </div>
              )}
              {hasWebOnly&&!isWebOnlySearching&&filteredTyped.news.length>0&&(
                <div style={{marginTop:20}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>📰 News</div>
                  <div style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:6}}>
                    {filteredTyped.news.map(r=>(
                      <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                        style={{minWidth:220,maxWidth:220,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'10px 12px',textDecoration:'none',flexShrink:0,display:'flex',flexDirection:'column',gap:4}}>
                        <span style={{fontSize:12,fontWeight:600,color:'var(--text-1)',lineHeight:1.4}}>{r.title}</span>
                        <span style={{fontSize:11,color:'var(--text-3)'}}>{r.snippet}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!hasWebOnly&&!isWebOnlySearching&&(
                <div className={styles.tabEmpty}><span style={{fontSize:32}}>⚡</span><p>Select <strong>Web Only</strong> in the prompt for fast, unfiltered web results.</p></div>
              )}
            </div>
          )}

          {/* ══ TAB 5: URL Analyzer — Feature ④ URL list ══ */}
          {activeTab==='urls'&&(
            <div className={styles.zone}>
              {/* Feature ④: URL list panel */}
              <UrlListPanel
                entries={urlList.entries}
                onToggle={urlList.toggleActive}
                onRemove={urlList.removeEntry}
                onSelectAll={urlList.setAllActive}
                onClearAll={urlList.clearAll}
                onReanalyze={(urls, task) => {
                  setLastAnalyzedUrls(urls)
                  analyzeUrls(urls, task, '', true)
                }}
              />

              {isUrlAnalyzing&&<div className={styles.tabEmpty}><span style={{fontSize:28}}>🔗</span><p>Claude is reading and analyzing your URLs...</p></div>}
              {urlSummaryCard?.visible&&(
                <SummaryBanner card={urlSummaryCard as any} summaryTable={urlSummaryTable}
                  onExpand={()=>{setExpandedId(p=>p===urlSummaryCard.id?null:urlSummaryCard.id);setExpandedZone('urls')}}
                  onDismiss={()=>dismissCard(urlSummaryCard.id,'urls')}
                  onToggleDoc={()=>toggleDocSelect(urlSummaryCard.id,'urls')}/>
              )}
              {hasUrls&&!isUrlAnalyzing&&(
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em'}}>Task:</span>
                  <span style={{fontSize:12,fontWeight:600,color:'#3C3489',background:'#EEEDFE',borderRadius:20,padding:'3px 10px'}}>
                    {lastUrlTask.charAt(0).toUpperCase()+lastUrlTask.slice(1)}
                  </span>
                </div>
              )}
              {hasUrls&&<CardGroupBar groups={urlGroups} activeGroupId={urlGrpId} groupingEnabled={urlGrpOn} onGroupChange={handleUrlGroup} onToggle={setUrlGrpOn}/>}
              {hasUrls&&!isUrlAnalyzing&&(urlGrpOn&&urlActiveGroup?(
                <CardPileGrid cards={urlGridCards} zone={'urls' as CardZone} cols={cols} activeGroup={urlActiveGroup} customGroupName={urlGrpName}
                  expandedId={expandedId} onReorder={reorderCards}
                  onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('urls')}}
                  onDismiss={id=>dismissCard(id,'urls')} onToggleDoc={id=>toggleDocSelect(id,'urls')}/>
              ):(
                <CardGrid cards={urlGridCards} zone={'urls' as CardZone} cols={cols} expandedId={expandedId} onReorder={reorderCards}
                  onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('urls')}}
                  onDismiss={id=>dismissCard(id,'urls')} onToggleDoc={id=>toggleDocSelect(id,'urls')}/>
              ))}
              {!hasUrls&&!isUrlAnalyzing&&urlList.entries.length===0&&(
                <div className={styles.tabEmpty}><span style={{fontSize:32}}>🔗</span><p>Select <strong>URL Analyzer</strong> in the prompt, paste URLs, and choose a task.</p></div>
              )}
            </div>
          )}

          {/* ══ TAB 6: All Results — Feature ⑥ assembly + export ══ */}
          {activeTab==='all'&&(
            <div className={styles.zone}>
              {/* Feature ⑥: export launcher */}
              <ExportLauncher
                cardCount={allGridCards.length}
                selectedCount={allSelected.length}
                onExport={handleExport}
                onSelectAll={()=>{
                  // select all visible non-summary cards across all zones
                  allGridCards.forEach((c:any) => toggleDocSelect(c.id, c.zone||'web'))
                }}
              />

              {/* Filter scope */}
              {allGridCards.length > 0 && (
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <span style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Filter scope:</span>
                  {(['all','web','llm','file','webonly','urls'] as const).map(z=>(
                    <button key={z} onClick={()=>{setAllFilterScope(z);clientRefine(activeChips,z)}} style={{
                      fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:10,cursor:'pointer',
                      border:'1px solid var(--border)',
                      background:allFilterScope===z?'var(--navy)':'var(--surface-2)',
                      color:allFilterScope===z?'#fff':'var(--text-2)',
                    }}>
                      {z==='all'?'All zones':z==='web'?'Web+LLM':z==='llm'?'LLM':z==='file'?'File':z==='webonly'?'Web Only':'URLs'}
                    </button>
                  ))}
                </div>
              )}

              {/* Summary banners */}
              {webSummaryCard?.visible&&<SummaryBanner card={webSummaryCard} summaryTable={summaryTable} onExpand={()=>{setExpandedId(p=>p===webSummaryCard.id?null:webSummaryCard.id);setExpandedZone('web')}} onDismiss={()=>dismissCard(webSummaryCard.id,'web')} onToggleDoc={()=>toggleDocSelect(webSummaryCard.id,'web')}/>}
              {fileSummaryCard?.visible&&<SummaryBanner card={fileSummaryCard as any} summaryTable={fileSummaryTable} onExpand={()=>{setExpandedId(p=>p===fileSummaryCard.id?null:fileSummaryCard.id);setExpandedZone('file')}} onDismiss={()=>dismissCard(fileSummaryCard.id,'file')} onToggleDoc={()=>toggleDocSelect(fileSummaryCard.id,'file')}/>}
              {urlSummaryCard?.visible&&<SummaryBanner card={urlSummaryCard as any} summaryTable={urlSummaryTable} onExpand={()=>{setExpandedId(p=>p===urlSummaryCard.id?null:urlSummaryCard.id);setExpandedZone('urls')}} onDismiss={()=>dismissCard(urlSummaryCard.id,'urls')} onToggleDoc={()=>toggleDocSelect(urlSummaryCard.id,'urls')}/>}

              {/* Multi-LLM summaries */}
              {llmMulti.activeSlots.map(slot => slot.summaryTable && (
                <SummaryBanner key={slot.providerId}
                  card={{id:`${slot.providerId}-summary`,rank:0,type:'llm',zone:'llm',
                    title:`${slot.label} Summary`,snippet:slot.cards.find(c=>c.rank===0)?.snippet??'',
                    steps:[],math:'',solution:'',tags:[],difficulty:'',url:'',source:slot.label,
                    hasVideo:false,visible:true,docSelected:false} as any}
                  summaryTable={slot.summaryTable}
                  onExpand={()=>{}} onDismiss={()=>{}} onToggleDoc={()=>{}}/>
              ))}

              {allGridCards.length>0&&(
                <CardGroupBar groups={allGroups.length>0?allGroups:FALLBACK_GROUPS} activeGroupId={allGrpId} groupingEnabled={allGrpOn}
                  onGroupChange={handleAllGroup} onToggle={setAllGrpOn}/>
              )}

              {allGridCards.length>0?(
                allGrpOn&&allActiveGroup?(
                  <CardPileGrid cards={allGridCards as any} zone={'web' as CardZone} cols={cols} activeGroup={allActiveGroup} customGroupName={allGrpName}
                    expandedId={expandedId} onReorder={reorderCards}
                    onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('all')}}
                    onDismiss={id=>{ const c=allGridCards.find((x:any)=>x.id===id) as any; dismissCard(id,c?.zone||'web') }}
                    onToggleDoc={id=>{ const c=allGridCards.find((x:any)=>x.id===id) as any; toggleDocSelect(id,c?.zone||'web') }}/>
                ):(
                  <div style={{display:'grid',gridTemplateColumns:`repeat(${cols}, 1fr)`,gap:16}}>
                    {allGridCards.map((card:any)=>{
                      if(card.zone==='llm'||card.type==='llm')
                        return <LlmCard key={card.id} card={card}
                          onExpand={()=>{setExpandedId(p=>p===card.id?null:card.id);setExpandedZone('llm')}}
                          onDismiss={()=>dismissCard(card.id,'llm')} onToggleDoc={()=>toggleDocSelect(card.id,'llm')}/>
                      if(card.zone==='file'||card.type==='file')
                        return <FileCard key={card.id} card={card}
                          onExpand={()=>{setExpandedId(p=>p===card.id?null:card.id);setExpandedZone('file')}}
                          onDismiss={()=>dismissCard(card.id,'file')} onToggleDoc={()=>toggleDocSelect(card.id,'file')}/>
                      return <CardGrid key={card.id} cards={[card]} zone={card.zone||'web'} cols={1} expandedId={expandedId} onReorder={reorderCards}
                        onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone(card.zone||'web')}}
                        onDismiss={id=>dismissCard(id,card.zone||'web')} onToggleDoc={id=>toggleDocSelect(id,card.zone||'web')}/>
                    })}
                  </div>
                )
              ):(
                <div className={styles.tabEmpty}><span style={{fontSize:32}}>◈</span><p>Run searches on the other tabs — all results appear here merged for assembly and export.</p></div>
              )}
            </div>
          )}

          {isMoreLoading&&(
            <div className={styles.zone}>
              <div className={styles.tabEmpty}><span style={{fontSize:24}}>➕</span><p>Fetching additional results...</p></div>
            </div>
          )}
          {(hasMore||isMoreLoading)&&(
            <div className={styles.zone}>
              <ZoneLabel color="more" label="Additional question" count={moreCards.length}/>
              <CardGrid cards={moreCards} zone="more" cols={cols} expandedId={expandedId} onReorder={reorderCards}
                onExpand={id=>{setExpandedId(p=>p===id?null:id);setExpandedZone('more')}}
                onDismiss={id=>dismissCard(id,'more')} onToggleDoc={id=>toggleDocSelect(id,'more')}/>
            </div>
          )}

          {!hasAny&&!multiLlmHasAny&&!hasLinks&&!apiError&&!isWorking&&(
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>⟳</div>
              <p>Enter a query and click <strong>Search</strong> to see live results as interactive cards.</p>
              <p className={styles.welcomeHint}>Web + LLM · LLM Only (multi-LLM) · File Analysis · Web Only · URL Analyzer · All Results with export</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
