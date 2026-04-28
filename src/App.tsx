import { useState, useEffect } from 'react'
import { PromptBox }         from './components/PromptBox'
import { SearchModeBar }     from './components/SearchModeBar'
import { SidebarFilters }    from './components/SidebarFilters'
import { DocBar }            from './components/DocBar'
import { Toolbar }           from './components/Toolbar'
import { CardGrid }          from './components/CardGrid'
import { ExpandOverlay }     from './components/ExpandOverlay'
import { DocumentModal }     from './components/DocumentModal'
import { MoreQuestionPanel } from './components/MoreQuestionPanel'
import { ZoneLabel }         from './components/ZoneLabel'
import { LinkZone }          from './components/LinkZone'
import { useCards }          from './hooks/useCards'
import type { CardZone, ThemeName, SearchMode } from './types'
import styles from './App.module.css'

export default function App() {
  const {
    webCards, fileCards, moreCards, linkResults, allSelected, sidebarFilters, apiError,
    hasWeb, hasFile, hasMore, hasLinks, hasAny,
    isAnalyzing, isSearching,
    search, analyze, addMoreQuestion,
    refine, clearWeb, clearFile, reset,
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function handleExpand(id: string, zone: CardZone) {
    setExpandedId(prev => prev === id ? null : id)
    setExpandedZone(zone)
  }

  function handleModeChange(mode: SearchMode, sub = '') {
    setSearchMode(mode)
    setSubMode(sub)
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
            <button key={t}
              className={`${styles.themeBtn} ${theme === t ? styles.themeBtnOn : ''}`}
              onClick={() => setTheme(t)} title={t}>
              {t === 'light' ? '☀' : t === 'dark' ? '🌙' : '🔷'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Two-column layout ── */}
      <div className={styles.layout}>

        {/* LEFT: Sidebar — always rendered */}
        <aside className={styles.sidebarCol}>
          <SidebarFilters
            sections={sidebarFilters}
            isSearching={isSearching}
            onRefine={vals => {
              refine({ checkboxes: vals as Record<string,boolean>, learnerLevel: 'All levels', extraFilter: '' })
            }}
          />
        </aside>

        {/* RIGHT: Main content */}
        <main className={styles.mainCol}>

          <PromptBox
            hasAny={hasAny} hasWeb={hasWeb || hasLinks} hasFile={hasFile}
            isAnalyzing={isAnalyzing} isSearching={isSearching}
            searchMode={searchMode} subMode={subMode}
            onSearch={(q, mode, sub) => {
              search(q, mode, sub)
              setExpandedId(null); setShowDoc(false); setShowMoreQ(false)
            }}
            onAnalyze={f => { analyze(f); setExpandedId(null) }}
            onMoreQuestion={() => setShowMoreQ(v => !v)}
            onClearWeb={clearWeb} onClearFile={clearFile}
            onReset={() => { reset(); setExpandedId(null); setShowDoc(false); setShowMoreQ(false) }}
          />

          {/* Search mode tabs */}
          <SearchModeBar active={searchMode} subMode={subMode} onChange={handleModeChange} />

          {/* API Error banner */}
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

          {hasAny && (
            <Toolbar visible={allVisible.length} cols={cols} onColsChange={setCols} />
          )}

          {expandedCard && (
            <ExpandOverlay card={expandedCard} onClose={() => setExpandedId(null)}
              onToggleDoc={() => expandedZone && toggleDocSelect(expandedCard.id, expandedZone)} />
          )}

          {showDoc && (
            <DocumentModal cards={allSelected} onClose={() => setShowDoc(false)} />
          )}

          {hasWeb && (
            <div className={styles.zone}>
              <ZoneLabel color="web" label="Web + LLM results" count={webCards.length} />
              <CardGrid cards={webCards} zone="web" cols={cols} expandedId={expandedId}
                onReorder={reorderCards}
                onExpand={id => handleExpand(id, 'web')}
                onDismiss={id => dismissCard(id, 'web')}
                onToggleDoc={id => toggleDocSelect(id, 'web')} />
            </div>
          )}

          {hasLinks && <LinkZone links={linkResults} onConvert={convertLinksToCards} />}

          {hasFile && (
            <>
              <div className={styles.zoneSep}>
                <div className={styles.zoneSepLine} />
                <span className={styles.zoneSepText}>file analysis cards</span>
                <div className={styles.zoneSepLine} />
              </div>
              <div className={styles.zone}>
                <ZoneLabel color="file" label="From file analysis" count={fileCards.length} />
                <CardGrid cards={fileCards} zone="file" cols={cols} expandedId={expandedId}
                  onReorder={reorderCards}
                  onExpand={id => handleExpand(id, 'file')}
                  onDismiss={id => dismissCard(id, 'file')}
                  onToggleDoc={id => toggleDocSelect(id, 'file')} />
              </div>
            </>
          )}

          {hasMore && (
            <>
              <div className={styles.zoneSep}>
                <div className={styles.zoneSepLine} />
                <span className={styles.zoneSepText}>additional question cards</span>
                <div className={styles.zoneSepLine} />
              </div>
              <div className={styles.zone}>
                <ZoneLabel color="more" label="Additional question" count={moreCards.length} />
                <CardGrid cards={moreCards} zone="more" cols={cols} expandedId={expandedId}
                  onReorder={reorderCards}
                  onExpand={id => handleExpand(id, 'more')}
                  onDismiss={id => dismissCard(id, 'more')}
                  onToggleDoc={id => toggleDocSelect(id, 'more')} />
              </div>
            </>
          )}

          {!hasAny && !hasLinks && !apiError && (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>⟳</div>
              <p>Enter a query and click <strong>Search</strong> to see live results as interactive cards.</p>
              <p className={styles.welcomeHint}>Use the mode tabs to filter by News, Images, Videos, and more. Filters appear on the left after you search.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
