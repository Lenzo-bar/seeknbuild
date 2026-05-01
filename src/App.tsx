import { useState, useEffect, useCallback } from 'react'
import { PromptBox }          from './components/PromptBox'
import { SearchModeBar }      from './components/SearchModeBar'
import { SidebarFilters }     from './components/SidebarFilters'
import { ActiveFilterChips }  from './components/ActiveFilterChips'
import { DocBar }             from './components/DocBar'
import { Toolbar }            from './components/Toolbar'
import { CardGrid }           from './components/CardGrid'
import { SummaryBanner }      from './components/SummaryBanner'
import { CardExpandOverlay }  from './components/CardExpandOverlay'
import { DocumentModal }      from './components/DocumentModal'
import { MoreQuestionPanel }  from './components/MoreQuestionPanel'
import { ZoneLabel }          from './components/ZoneLabel'
import { LinkZone }           from './components/LinkZone'
import { useCards }           from './hooks/useCards'
import { getFilterCategory }  from './data/filterCategories'
import type { CardZone, ThemeName, SearchMode, ActiveFilterChip, FilterCategory } from './types'
import styles from './App.module.css'

function detectCategory(query: string, topic: string): FilterCategory {
  const q = (query + ' ' + topic).toLowerCase()
  const academiaRx = /math|calculus|algebra|science|physics|chemistry|biology|history|philosophy|economics|literature|psychology|sociology|engineering|medicine|law|course|lecture|university|grade|school|student|research|academia|study|theorem|proof|equation|hypothesis/
  const buyRx = /buy|sell|price|rent|lease|house|condo|car|truck|shop|store|deal|discount|market|real estate|property|listing|vehicle|product|amazon|ebay|cost|fee|rate|mortgage/
  if (academiaRx.test(q)) return 'academia'
  if (buyRx.test(q)) return 'buying-selling'
  return 'general'
}

function fuseSearchMode(explicitMode: SearchMode, query: string): { mode: SearchMode; hint: string } {
  const q = query.toLowerCase()
  if (explicitMode !== 'all') return { mode: explicitMode, hint: '' }
  if (/\bvideo(s)?\b|\bwatch\b|\byoutube\b|\bclip\b/.test(q))        return { mode: 'videos',   hint: 'video' }
  if (/\bnews\b|\bheadline\b|\barticle\b|\bbreaking\b/.test(q))      return { mode: 'news',     hint: 'news' }
  if (/\bimage(s)?\b|\bphoto(s)?\b|\bpicture(s)?\b/.test(q))        return { mode: 'images',   hint: 'image' }
  if (/\bforum\b|\breddit\b|\bdiscussion\b|\bthread\b/.test(q))      return { mode: 'forums',   hint: 'forum' }
  if (/\bbuy\b|\bshop\b|\bprice\b|\bpurchase\b|\bproduct\b/.test(q)) return { mode: 'shopping', hint: 'shopping' }
  if (/\bsport\b|\bscore\b|\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b/.test(q)) return { mode: 'sports',  hint: 'sports' }
  return { mode: 'all', hint: '' }
}

// Extract location tokens from a query string
function extractLocations(q: string): string[] {
  // Common location prepositions signal what follows is a place name
  const matches = q.toLowerCase().match(/(?:in|near|around|region of|area of)\s+([a-z\s]+?)(?:\s+and|\s+or|,|$)/g) || []
  return matches.map(m => m.replace(/^(in|near|around|region of|area of)\s+/, '').trim()).filter(Boolean)
}

// Detect if two location sets differ meaningfully (i.e. new location added/changed)
function locationChanged(oldQuery: string, newQuery: string): boolean {
  const oldLocs = extractLocations(oldQuery)
  const newLocs  = extractLocations(newQuery)
  // If new query has locations not in old query, signal a location change
  return newLocs.some(loc => !oldLocs.some(old => old.includes(loc) || loc.includes(old)))
}

export default function App() {
  const {
    webCards, fileCards, moreCards, linkResults, allSelected, sidebarFilters, apiError,
    hasWeb, hasFile, hasMore, hasLinks, hasAny,
    isAnalyzing, isSearching, hasSearched, currentTopic,
    isFiltering, searchTime, filterTime, totalCards,
    search, analyze, addMoreQuestion, clientRefine,
    clearWeb, clearFile, reset,
    dismissCard, toggleDocSelect, clearDocSelections, reorderCards,
    convertLinksToCards,
  } = useCards()

  const [cols,         setCols]         = useState(3)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [expandedZone, setExpandedZone] = useState<CardZone | null>(null)
  const [showDoc,      setShowDoc]      = useState(false)
  const [showMoreQ,    setShowMoreQ]    = useState(false)
  const [theme,        setTheme]        = useState<ThemeName>('light')
  const [searchMode,   setSearchMode]   = useState<SearchMode>('all')
  const [subMode,      setSubMode]      = useState('')
  const [activeChips,  setActiveChips]  = useState<ActiveFilterChip[]>([])
  const [filterCat,    setFilterCat]    = useState<FilterCategory>('general')
  const [filterResetKey,     setFilterResetKey]     = useState(0)
  const [locationRefreshKey, setLocationRefreshKey] = useState(0)
  const [removedChipId,      setRemovedChipId]      = useState<string | null>(null)

  // Topic-persistence dialog
  const [showTopicDialog,   setShowTopicDialog]   = useState(false)
  const [lockedTopic,       setLockedTopic]       = useState('')
  // True only during the very first search — shows skeleton. Never true for same-ctx searches.
  const [isFirstSearch, setIsFirstSearch] = useState(false)
  // useState (not useRef) so Search button re-renders when user answers dialog
  const [sameCtxConfirmed, setSameCtxConfirmed] = useState(false)

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

  function handleModeChange(mode: SearchMode, sub = '') {
    setSearchMode(mode); setSubMode(sub)
  }

  // Clear isFirstSearch (skeleton) once search finishes
  useEffect(() => {
    if (!isSearching) setIsFirstSearch(false)
  }, [isSearching])

  // ── Fresh search — wipes filter bar ──────────────────────────────
  function freshSearch(query: string, mode: SearchMode, sub: string) {
    setFilterCat(detectCategory(query, ''))
    setActiveChips([])
    setFilterResetKey(k => k + 1)
    setLockedTopic(query)
    setSameCtxConfirmed(false)
    setIsFirstSearch(true)          // show skeleton during this search only
    search(query, mode, sub, false)
    setExpandedId(null); setShowDoc(false); setShowMoreQ(false)
  }

  // ── Same-context search — keeps filter bar, replaces cards + links ─
  function sameCtxSearch(query: string, mode: SearchMode, sub: string) {
    setLockedTopic(query)
    setIsFirstSearch(false)         // never show skeleton — sidebar must stay intact
    search(query, mode, sub, true)
    setExpandedId(null)
  }

  // ── Search button clicked ─────────────────────────────────────────
  function handleSearch(query: string) {
    const { mode } = fuseSearchMode(searchMode, query)
    if (!hasSearched) {
      freshSearch(query, mode, subMode)           // very first search — always fresh
    } else if (sameCtxConfirmed) {
      sameCtxSearch(query, mode, subMode)         // user said Yes → keep filters
    } else {
      freshSearch(query, mode, subMode)           // user said No, or no filters — fresh
    }
  }

  // ── Prompt onChange — show dialog once when filters are active ────
  function handlePromptChange(q: string) {
    if (
      hasSearched &&
      activeChips.length > 0 &&
      !showTopicDialog &&
      !sameCtxConfirmed &&
      q.trim().length > 0 &&
      q !== lockedTopic
    ) {
      setShowTopicDialog(true)
    }
  }

  // ── Dialog: Yes — keep filter bar, user then clicks Search ────────
  function handleDialogYes() {
    setShowTopicDialog(false)
    setSameCtxConfirmed(true)   // real state → triggers re-render → Search uses sameCtxSearch
  }

  // ── Dialog: No — clear filters, user then clicks Search fresh ─────
  function handleDialogNo() {
    setShowTopicDialog(false)
    setSameCtxConfirmed(false)
    setActiveChips([])
    setFilterResetKey(k => k + 1)
    setFilterCat('general')
    setLockedTopic('')
    clientRefine([])
  }

  useEffect(() => {
    if (currentTopic) setFilterCat(getFilterCategory(currentTopic))
  }, [currentTopic])

  // Sidebar value changes → chip preview only, no card filtering
  const handleRefine = useCallback((chips: ActiveFilterChip[]) => {
    setActiveChips(chips)
  }, [])

  // "Apply filters" pressed → actually filter cards
  const handleApply = useCallback((chips: ActiveFilterChip[]) => {
    setActiveChips(chips)
    clientRefine(chips)
  }, [clientRefine])

  function removeChip(id: string) {
    setActiveChips(prev => {
      const next = prev.filter(c => c.id !== id)
      if (next.length === 0) {
        setFilterResetKey(k => k + 1)
        setRemovedChipId(null)
      } else {
        setRemovedChipId(id)
      }
      clientRefine(next)
      return next
    })
  }

  function handleReset() {
    reset()
    setActiveChips([])
    setFilterResetKey(k => k + 1)
    setLockedTopic('')
    setSameCtxConfirmed(false)
    setIsFirstSearch(false)
    setExpandedId(null); setShowDoc(false); setShowMoreQ(false)
  }

  const expandedCard = expandedId
    ? [...webCards, ...fileCards, ...moreCards].find(c => c.id === expandedId) ?? null
    : null
  const allVisible = [...webCards, ...fileCards, ...moreCards]

  // Card #0 is the AI summary — rendered as a full-width banner above the grid
  const summaryCard = webCards.find(c => c.rank === 0) ?? null
  const gridCards   = webCards.filter(c => c.rank !== 0)

  // Filter link results by active chips — mirrors card filtering
  const filteredLinks = activeChips.length === 0 ? linkResults : linkResults.filter(link => {
    const text = (link.title + ' ' + link.snippet + ' ' + link.url).toLowerCase()
    return activeChips.every(chip => text.includes(chip.value.toLowerCase()))
  })

  return (
    <div className={styles.root}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>S</span>
          <span className={styles.logoText}>SeekNBuild</span>
          <span className={styles.logoBeta}>v4</span>
        </div>
        <div className={styles.themeSwitcher}>
          <span className={styles.themeLabel}>Theme</span>
          {(['light','warm','dark','blue'] as ThemeName[]).map(t => (
            <button key={t} className={`${styles.themeBtn} ${theme===t ? styles.themeBtnOn:''}`}
              onClick={() => setTheme(t)} title={t}>
              {t==='light'?'☀':t==='warm'?'🌤':t==='dark'?'🌙':'🔷'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Topic-persistence floating dialog ── */}
      {showTopicDialog && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.42)',
          zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: '28px 32px',
            maxWidth: 420,
            width: '90vw',
            boxShadow: 'var(--shadow-overlay)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🔎</span>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.3 }}>
                Is this still the same topic?
              </p>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              You've edited your prompt while refinement filters are active.
              Are you still searching about the same subject?
            </p>

            {lockedTopic && (
              <div style={{
                fontSize: 12, color: 'var(--teal)',
                background: 'var(--teal-light)',
                borderRadius: 'var(--r-sm)',
                padding: '7px 11px',
                lineHeight: 1.5,
              }}>
                Current topic: <strong>"{lockedTopic.length > 70 ? lockedTopic.slice(0, 70) + '…' : lockedTopic}"</strong>
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-2)' }}>Yes</strong> — keep the refinement bar and active filters as-is.<br />
              <strong style={{ color: 'var(--text-2)' }}>No</strong> — this is a new topic; clear all filters and start fresh.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={handleDialogYes} style={{
                padding: '9px 22px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-mid)',
                background: 'var(--surface-2)', color: 'var(--text-1)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Yes, keep filters
              </button>
              <button onClick={handleDialogNo} style={{
                padding: '9px 22px', borderRadius: 'var(--r-md)',
                border: 'none',
                background: 'var(--navy)', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                No, reset filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className={styles.layout}>

        {/* LEFT sidebar */}
        <aside className={styles.sidebarCol}>
          <SidebarFilters
            category={filterCat}
            topic={currentTopic || ''}
            sections={sidebarFilters}
            isFirstSearch={isFirstSearch}
            resetKey={filterResetKey}
            locationRefreshKey={locationRefreshKey}
            removedChipId={removedChipId}
            onRefine={handleRefine}
            onApply={handleApply}
          />
        </aside>

        {/* RIGHT main */}
        <main className={styles.mainCol}>

          <PromptBox
            hasAny={hasAny} hasWeb={hasWeb||hasLinks} hasFile={hasFile}
            isAnalyzing={isAnalyzing} isSearching={isSearching}
            hasSearched={hasSearched}
            hasActiveFilters={activeChips.length > 0}
            searchMode={searchMode} subMode={subMode}
            onSearch={(q, _mode, _sub) => handleSearch(q)}
            onPromptChange={handlePromptChange}
            onAnalyze={f => { analyze(f); setExpandedId(null) }}
            onMoreQuestion={() => setShowMoreQ(v => !v)}
            onClearWeb={clearWeb} onClearFile={clearFile}
            onReset={handleReset}
          />

          <SearchModeBar active={searchMode} subMode={subMode} onChange={handleModeChange} />

          <ActiveFilterChips
            chips={activeChips}
            onRemove={removeChip}
            onClearAll={() => {
              setActiveChips([])
              setFilterResetKey(k => k + 1)
              clientRefine([])
            }}
          />

          {apiError && (
            <div className={styles.errorBanner}>
              <strong>⚠ Search error:</strong> {apiError}
            </div>
          )}

          {showMoreQ && (
            <MoreQuestionPanel
              onSubmit={q => { addMoreQuestion(q); setShowMoreQ(false) }}
              onCancel={() => setShowMoreQ(false)}
            />
          )}

          {allSelected.length > 0 && (
            <DocBar count={allSelected.length} onBuild={() => setShowDoc(true)} onClear={clearDocSelections} />
          )}

          {(hasAny || isSearching) && (
            <Toolbar
              visible={allVisible.length}
              total={totalCards}
              cols={cols}
              isSearching={isSearching}
              isFiltering={isFiltering}
              searchTime={searchTime}
              filterTime={filterTime}
              onColsChange={setCols}
            />
          )}

          {expandedCard && (
            <CardExpandOverlay card={expandedCard} onClose={() => setExpandedId(null)}
              onToggleDoc={() => expandedZone && toggleDocSelect(expandedCard.id, expandedZone)} />
          )}
          {showDoc && <DocumentModal cards={allSelected} onClose={() => setShowDoc(false)} />}

          {hasWeb && (
            <div className={styles.zone}>
              <ZoneLabel color="web" label="Web + LLM results" count={gridCards.length} />

              {/* ── Card #0 — AI summary banner, full width above grid ── */}
              {summaryCard && summaryCard.visible && (
                <SummaryBanner
                  card={summaryCard}
                  onExpand={() => { setExpandedId(p => p === summaryCard.id ? null : summaryCard.id); setExpandedZone('web') }}
                  onDismiss={() => dismissCard(summaryCard.id, 'web')}
                  onToggleDoc={() => toggleDocSelect(summaryCard.id, 'web')}
                />
              )}

              <CardGrid cards={gridCards} zone="web" cols={cols} expandedId={expandedId}
                onReorder={reorderCards}
                onExpand={id => { setExpandedId(p => p===id?null:id); setExpandedZone('web') }}
                onDismiss={id => dismissCard(id,'web')}
                onToggleDoc={id => toggleDocSelect(id,'web')} />
            </div>
          )}

          {hasLinks && <LinkZone links={filteredLinks} onConvert={convertLinksToCards} />}

          {hasFile && (
            <>
              <div className={styles.zoneSep}>
                <div className={styles.zoneSepLine}/><span className={styles.zoneSepText}>file analysis</span><div className={styles.zoneSepLine}/>
              </div>
              <div className={styles.zone}>
                <ZoneLabel color="file" label="From file analysis" count={fileCards.length} />
                <CardGrid cards={fileCards} zone="file" cols={cols} expandedId={expandedId}
                  onReorder={reorderCards}
                  onExpand={id => { setExpandedId(p=>p===id?null:id); setExpandedZone('file') }}
                  onDismiss={id => dismissCard(id,'file')}
                  onToggleDoc={id => toggleDocSelect(id,'file')} />
              </div>
            </>
          )}

          {hasMore && (
            <>
              <div className={styles.zoneSep}>
                <div className={styles.zoneSepLine}/><span className={styles.zoneSepText}>additional question</span><div className={styles.zoneSepLine}/>
              </div>
              <div className={styles.zone}>
                <ZoneLabel color="more" label="Additional question" count={moreCards.length} />
                <CardGrid cards={moreCards} zone="more" cols={cols} expandedId={expandedId}
                  onReorder={reorderCards}
                  onExpand={id => { setExpandedId(p=>p===id?null:id); setExpandedZone('more') }}
                  onDismiss={id => dismissCard(id,'more')}
                  onToggleDoc={id => toggleDocSelect(id,'more')} />
              </div>
            </>
          )}

          {!hasAny && !hasLinks && !apiError && (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>⟳</div>
              <p>Enter a query and click <strong>Search</strong> to see live results as interactive cards.</p>
              <p className={styles.welcomeHint}>Filters on the left adapt to your search — buying/selling, academia, or general topics.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
