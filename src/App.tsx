import { useState, useEffect, useCallback } from 'react'
import { PromptBox }          from './components/PromptBox'
import { SearchModeBar }      from './components/SearchModeBar'
import { SidebarFilters }     from './components/SidebarFilters'
import { ActiveFilterChips }  from './components/ActiveFilterChips'
import { DocBar }             from './components/DocBar'
import { Toolbar }            from './components/Toolbar'
import { CardGrid }           from './components/CardGrid'
import { ExpandOverlay }      from './components/ExpandOverlay'
import { DocumentModal }      from './components/DocumentModal'
import { MoreQuestionPanel }  from './components/MoreQuestionPanel'
import { ZoneLabel }          from './components/ZoneLabel'
import { LinkZone }           from './components/LinkZone'
import { useCards }           from './hooks/useCards'
import { getFilterCategory }  from './data/filterCategories'
import type { CardZone, ThemeName, SearchMode, ActiveFilterChip, FilterCategory } from './types'
import styles from './App.module.css'

// Detect category from query text + topic
function detectCategory(query: string, topic: string): FilterCategory {
  const q = (query + ' ' + topic).toLowerCase()
  const academiaRx = /math|calculus|algebra|science|physics|chemistry|biology|history|philosophy|economics|literature|psychology|sociology|engineering|medicine|law|course|lecture|university|grade|school|student|research|academia|study|theorem|proof|equation|hypothesis/
  const buyRx = /buy|sell|price|rent|lease|house|condo|car|truck|shop|store|deal|discount|market|real estate|property|listing|vehicle|product|amazon|ebay|cost|fee|rate|mortgage/
  if (academiaRx.test(q)) return 'academia'
  if (buyRx.test(q)) return 'buying-selling'
  return 'general'
}

// Smart mode fusion: merge explicit mode tab + prompt intent
function fuseSearchMode(explicitMode: SearchMode, query: string): { mode: SearchMode; hint: string } {
  const q = query.toLowerCase()
  // Prompt overrides tab if it's more specific
  if (explicitMode !== 'all') return { mode: explicitMode, hint: '' }
  if (/\bvideo(s)?\b|\bwatch\b|\byoutube\b|\bclip\b/.test(q))       return { mode: 'videos',   hint: 'video' }
  if (/\bnews\b|\bheadline\b|\barticle\b|\bbreaking\b/.test(q))     return { mode: 'news',     hint: 'news' }
  if (/\bimage(s)?\b|\bphoto(s)?\b|\bpicture(s)?\b/.test(q))       return { mode: 'images',   hint: 'image' }
  if (/\bforum\b|\breddit\b|\bdiscussion\b|\bthread\b/.test(q))     return { mode: 'forums',   hint: 'forum' }
  if (/\bbuy\b|\bshop\b|\bprice\b|\bpurchase\b|\bproduct\b/.test(q))return { mode: 'shopping', hint: 'shopping' }
  if (/\bsport\b|\bscore\b|\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b/.test(q))return { mode: 'sports',  hint: 'sports' }
  return { mode: 'all', hint: '' }
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
  const [filterResetKey,  setFilterResetKey]  = useState(0)
  const [removedChipId,   setRemovedChipId]   = useState<string | null>(null)

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

  function handleModeChange(mode: SearchMode, sub = '') {
    setSearchMode(mode); setSubMode(sub)
  }

  function handleSearch(query: string) {
    const { mode } = fuseSearchMode(searchMode, query)
    const cat = detectCategory(query, '')
    setFilterCat(cat)
    setActiveChips([])
    search(query, mode, subMode)
    setExpandedId(null); setShowDoc(false); setShowMoreQ(false)
  }

  // Update category when topic arrives from API
  useEffect(() => {
    if (currentTopic) setFilterCat(getFilterCategory(currentTopic))
  }, [currentTopic])

  const handleRefine = useCallback((chips: ActiveFilterChip[]) => {
    setActiveChips(chips)
  }, [])

  const handleApply = useCallback((chips: ActiveFilterChip[]) => {
    setActiveChips(chips)
    clientRefine(chips)   // filter existing cards only — no API call, sidebar unchanged
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
      // Re-apply remaining filters to cards immediately
      clientRefine(next)
      return next
    })
  }

  const expandedCard = expandedId
    ? [...webCards, ...fileCards, ...moreCards].find(c => c.id === expandedId) ?? null
    : null
  const allVisible = [...webCards, ...fileCards, ...moreCards]

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
          {(['light','dark','blue'] as ThemeName[]).map(t => (
            <button key={t} className={`${styles.themeBtn} ${theme===t ? styles.themeBtnOn:''}`}
              onClick={() => setTheme(t)} title={t}>
              {t==='light'?'☀':t==='dark'?'🌙':'🔷'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Two-column layout ── */}
      <div className={styles.layout}>

        {/* LEFT sidebar */}
        <aside className={styles.sidebarCol}>
          <SidebarFilters
            category={filterCat}
            topic={currentTopic || ''}
            sections={sidebarFilters}
            isSearching={isSearching}
            resetKey={filterResetKey}
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
            searchMode={searchMode} subMode={subMode}
            onSearch={(q, _mode, _sub) => handleSearch(q)}
            onAnalyze={f => { analyze(f); setExpandedId(null) }}
            onMoreQuestion={() => setShowMoreQ(v => !v)}
            onClearWeb={clearWeb} onClearFile={clearFile}
            onReset={() => { reset(); setActiveChips([]); setExpandedId(null); setShowDoc(false); setShowMoreQ(false) }}
          />

          <SearchModeBar active={searchMode} subMode={subMode} onChange={handleModeChange} />

          {/* Active filter chips below prompt */}
          <ActiveFilterChips
            chips={activeChips}
            onRemove={removeChip}
            onClearAll={() => { setActiveChips([]); setFilterResetKey(k => k + 1) }}
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
            <ExpandOverlay card={expandedCard} onClose={() => setExpandedId(null)}
              onToggleDoc={() => expandedZone && toggleDocSelect(expandedCard.id, expandedZone)} />
          )}
          {showDoc && <DocumentModal cards={allSelected} onClose={() => setShowDoc(false)} />}

          {hasWeb && (
            <div className={styles.zone}>
              <ZoneLabel color="web" label="Web + LLM results" count={webCards.length} />
              <CardGrid cards={webCards} zone="web" cols={cols} expandedId={expandedId}
                onReorder={reorderCards}
                onExpand={id => { setExpandedId(p => p===id?null:id); setExpandedZone('web') }}
                onDismiss={id => dismissCard(id,'web')}
                onToggleDoc={id => toggleDocSelect(id,'web')} />
            </div>
          )}

          {hasLinks && <LinkZone links={linkResults} onConvert={convertLinksToCards} />}

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
