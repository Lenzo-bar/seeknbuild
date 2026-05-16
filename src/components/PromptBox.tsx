import { useState, useRef } from 'react'
import type { AppMode, SearchMode } from '../types'
import { HistoryPanel } from './HistoryPanel'
import { LlmProviderPicker } from './LlmProviderPicker'
import type { HistoryEntry } from '../hooks/usePromptHistory'
import type { LlmProviderId } from '../hooks/useLlmMulti'
import { LLM_PROVIDERS } from '../hooks/useLlmMulti'
import styles from './PromptBox.module.css'

interface Props {
  hasAny:           boolean
  hasWeb:           boolean
  hasFile:          boolean
  isAnalyzing:      boolean
  isSearching:      boolean
  hasSearched:      boolean
  hasActiveFilters: boolean
  searchMode:       SearchMode
  subMode:          string
  onSearch:         (query: string, mode: SearchMode, sub: string, appMode: AppMode) => void
  onPromptChange?:  (query: string) => void
  onAnalyze:        (file: File) => void
  onAnalyzeSolve:   (file: File) => void
  onAnalyzeUrls:    (urls: string[], task: string) => void
  onMoreQuestion:   () => void
  onClearWeb:       () => void
  onClearFile:      () => void
  onReset:          () => void

  topicDlgOpen?:   boolean
  sessionTopic?:   string
  onModeChange?:   (mode: AppMode) => void

  // ── History (Feature ①) ──────────────────────────────────────────────────
  historyEntries:  HistoryEntry[]
  currentMode:     AppMode
  onHistorySelect: (query: string) => void
  onHistoryRemove: (id: string) => void
  onHistoryClear:  (mode: AppMode) => void
  onHistoryClearAll: () => void

  // ── LLM multi-provider (Feature ⑤) ──────────────────────────────────────
  selectedLlms:     Set<LlmProviderId>
  isMultiLlmLoading: boolean
  onToggleLlm:      (id: LlmProviderId) => void
  onSelectAllLlms:  () => void
  onClearLlms:      () => void
  onMultiLlmSearch: () => void
}

const URL_TASKS = [
  { id: 'summarize', label: 'Summarize',  icon: '📋' },
  { id: 'compare',   label: 'Compare',    icon: '⇄'  },
  { id: 'analyze',   label: 'Analyze',    icon: '🔍' },
  { id: 'combine',   label: 'Combine',    icon: '🔗' },
  { id: 'rewrite',   label: 'Rewrite',    icon: '✏️' },
]

const MODE_CONFIG: { id: AppMode; label: string; icon: string; desc: string }[] = [
  { id: 'web',     label: 'Web + LLM',    icon: '🌐', desc: 'Live web search with AI synthesis' },
  { id: 'llm',     label: 'LLM Only',     icon: '⚙',  desc: 'Ask one or more LLMs — math, code, explanations' },
  { id: 'file',    label: 'File Analysis',icon: '📄', desc: 'Upload and analyze documents into cards' },
  { id: 'webonly', label: 'Web Only',      icon: '⚡', desc: 'Fast web search — no LLM, pure results' },
  { id: 'urls',    label: 'URL Analyzer', icon: '🔗', desc: 'Paste URLs — Claude reads, reorganizes into cards' },
]

function parseUrls(text: string): string[] {
  return text.split(/[\n,\s]+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s))
}

export function PromptBox({
  hasAny, hasWeb, hasFile, isAnalyzing, isSearching, hasSearched, hasActiveFilters,
  topicDlgOpen, onModeChange, sessionTopic,
  onPromptChange, searchMode, subMode,
  onSearch, onAnalyze, onAnalyzeSolve, onAnalyzeUrls, onMoreQuestion,
  onClearWeb, onClearFile, onReset,
  historyEntries, currentMode, onHistorySelect, onHistoryRemove, onHistoryClear, onHistoryClearAll,
  selectedLlms, isMultiLlmLoading, onToggleLlm, onSelectAllLlms, onClearLlms, onMultiLlmSearch,
}: Props) {
  const [query,       setQuery]       = useState('')
  const [mode,        setMode]        = useState<AppMode>('web')
  const [mathOn,      setMathOn]      = useState(true)
  const [deepOn,      setDeepOn]      = useState(false)
  const [file,        setFile]        = useState<File | null>(null)
  const [queryEdited, setQueryEdited] = useState(false)
  const [urlText,     setUrlText]     = useState('')
  const [urlTask,     setUrlTask]     = useState('summarize')
  const [urlError,    setUrlError]    = useState('')

  const fileRef  = useRef<HTMLInputElement>(null)
  const solveRef = useRef<HTMLInputElement>(null)

  const isFile    = mode === 'file'
  const isLlm     = mode === 'llm'
  const isWebOnly = mode === 'webonly'
  const isUrls    = mode === 'urls'

  const searchLocked = hasSearched && !queryEdited && mode !== 'llm'
  const parsedUrls   = parseUrls(urlText)

  const canSearch  = (isWebOnly || (!isFile && !isUrls && !isLlm)) && query.trim().length > 0 && !isSearching && !searchLocked
  const canAnalyze = isFile && !!file && !isAnalyzing
  const canUrls    = isUrls && parsedUrls.length > 0 && !isSearching
  const canMoreQ   = hasAny
  const canClearW  = hasWeb
  const canClearF  = hasFile
  const canReset   = hasAny || query.trim().length > 0

  const searchLockedLabel = hasActiveFilters
    ? 'Use "Apply filters" to refine'
    : 'Edit prompt to search again'

  // Inject a history selection into the prompt box
  function handleHistorySelect(q: string) {
    setQuery(q)
    setQueryEdited(true)
    onHistorySelect(q)
    onPromptChange?.(q)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setQuery(`Analyze and organize "${f.name}" into cards by section and chapter`)
  }

  function handleSolveFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    onAnalyzeSolve(f)
  }

  function handleModeClick(m: AppMode) {
    setMode(m)
    if (m !== 'file') setFile(null)
    setUrlError('')
    setQueryEdited(true)
    onModeChange?.(m)
  }

  function handleReset() {
    setQuery(''); setFile(null); setMode('web'); setQueryEdited(false)
    setUrlText(''); setUrlError('')
    onReset()
  }

  function handleSearch() {
    if (isUrls) {
      if (parsedUrls.length === 0) { setUrlError('Paste at least one URL starting with https://'); return }
      if (parsedUrls.length > 8)   { setUrlError('Maximum 8 URLs at once'); return }
      setUrlError('')
      onAnalyzeUrls(parsedUrls, urlTask)
      return
    }
    if (isLlm) {
      // Multi-LLM: delegate to the picker's search handler
      onMultiLlmSearch()
      return
    }
    if (canSearch) {
      onSearch(query, searchMode, subMode, mode)
      setQueryEdited(false)
    }
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setQuery(val)
    setQueryEdited(true)
    onPromptChange?.(val)
  }

  const placeholder = isLlm
    ? 'Ask one or more LLMs — math, code, explanations, research...'
    : isFile
    ? 'Describe what to extract or analyze from the file...'
    : isWebOnly
    ? 'Search the web fast — pure results, no AI processing...'
    : isUrls
    ? 'Optional: describe what to do with these URLs...'
    : 'Ask anything, search any topic — results appear as interactive cards...'

  return (
    <div className={styles.wrap}>

      {/* ── Mode pills ── */}
      <div className={styles.modes}>
        {MODE_CONFIG.map(m => (
          <button
            key={m.id}
            className={`${styles.pill} ${mode === m.id ? styles.pillOn : ''} ${styles[`pill_${m.id}`]}`}
            onClick={() => handleModeClick(m.id)}
            title={m.desc}
          >
            <span className={styles.pillIcon}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── History panel row (Feature ①) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <HistoryPanel
          entries={historyEntries}
          currentMode={mode}
          onSelect={handleHistorySelect}
          onRemove={onHistoryRemove}
          onClearMode={onHistoryClear}
          onClearAll={onHistoryClearAll}
        />
        {historyEntries.filter(e => e.mode === mode).length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {historyEntries.filter(e => e.mode === mode).length} saved for this mode
          </span>
        )}
      </div>

      {/* ── URL Analyzer input ── */}
      {isUrls && (
        <div className={styles.urlWrap}>
          <div className={styles.urlHeader}>
            <span className={styles.urlTitle}>🔗 URL Analyzer</span>
            <span className={styles.urlSub}>Paste URLs to read, reorganize into cards, and synthesize content</span>
          </div>
          <textarea
            className={styles.urlTextarea}
            placeholder={'Paste URLs here — one per line or comma-separated:\nhttps://example.com/article-1\nhttps://example.com/article-2'}
            value={urlText}
            onChange={e => { setUrlText(e.target.value); setUrlError('') }}
            rows={3}
          />
          {parsedUrls.length > 0 && (
            <div className={styles.urlChips}>
              {parsedUrls.map((u, i) => {
                let host = u
                try { host = new URL(u).hostname } catch {}
                return <span key={i} className={styles.urlChip} title={u}>🔗 {host}</span>
              })}
            </div>
          )}
          {urlError && <p className={styles.urlError}>{urlError}</p>}
          <div className={styles.urlTasks}>
            <span className={styles.urlTaskLabel}>Task:</span>
            {URL_TASKS.map(t => (
              <button
                key={t.id}
                className={`${styles.urlTaskBtn} ${urlTask === t.id ? styles.urlTaskBtnOn : ''}`}
                onClick={() => setUrlTask(t.id)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Main textarea ── */}
      {!isUrls && (
        <textarea
          className={styles.textarea}
          value={query}
          onChange={handleQueryChange}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSearch() }}
          placeholder={placeholder}
          rows={3}
        />
      )}

      {/* ── Session topic hint ── */}
      {!isUrls && sessionTopic && query.trim() !== sessionTopic.trim() && (
        <div className={styles.topicHint}>
          <span>📌 Session topic:</span>{' '}
          {sessionTopic.length > 90 ? sessionTopic.slice(0, 90) + '…' : sessionTopic}
        </div>
      )}

      {/* ── File drop zone ── */}
      {isFile && (
        <div className={styles.dropZone} onClick={() => fileRef.current?.click()}>
          {file
            ? <><span className={styles.dropIcon}>📄</span>
                <span className={styles.dropName}>{file.name}</span>
                <small>{(file.size / 1024).toFixed(0)} KB — click Analyze to process</small></>
            : <><span className={styles.dropIcon}>⊕</span>
                <span>Drop any file here or click to browse</span>
                <small>PDF · DOCX · TXT · MD · CSV</small></>
          }
          <input ref={fileRef} type="file" style={{ display: 'none' }}
            accept=".pdf,.docx,.txt,.md,.csv,.xlsx" onChange={handleFile} />
        </div>
      )}

      {/* ── LLM mode — solve from file strip ── */}
      {isLlm && (
        <div className={styles.dropZone} style={{ cursor:'pointer' }} onClick={() => solveRef.current?.click()}>
          <span className={styles.dropIcon}>🧮</span>
          <span>Attach PDF or DOCX to solve math problems from the file</span>
          <small>PDF · DOCX</small>
          <input ref={solveRef} type="file" style={{ display: 'none' }}
            accept=".pdf,.docx" onChange={handleSolveFile} />
        </div>
      )}

      {/* ── Tool strip ── */}
      {!isUrls && (
        <div className={styles.toolStrip}>
          <button className={`${styles.tool} ${mathOn ? styles.toolOn : ''}`} onClick={() => setMathOn(v => !v)}>
            <span>∑</span> Math {mathOn ? 'on' : 'off'}
          </button>
          <button className={`${styles.tool} ${deepOn ? styles.toolOn : ''}`} onClick={() => setDeepOn(v => !v)}>
            <span>⟳</span> Deep research
          </button>
          <button className={styles.tool} onClick={() => {
            if (isLlm) { solveRef.current?.click() }
            else { setMode('file'); setTimeout(() => fileRef.current?.click(), 50) }
          }}>
            <span>⊕</span> Attach file
          </button>
          <span className={styles.hint}>{query.length} chars</span>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className={styles.btnRow}>

        {/* LLM Only: multi-provider picker replaces the single Ask Claude button */}
        {isLlm && (
          <LlmProviderPicker
            selected={selectedLlms}
            isLoading={isMultiLlmLoading}
            disabled={query.trim().length === 0}
            onToggle={onToggleLlm}
            onSearch={() => {
              if (query.trim().length > 0) {
                onMultiLlmSearch()
                setQueryEdited(false)
              }
            }}
            onSelectAll={onSelectAllLlms}
            onClearAll={onClearLlms}
          />
        )}

        {!isFile && !isUrls && !isLlm && (
          <button
            className={`${styles.btn} ${
              canSearch
                ? isWebOnly ? styles.btnAmber : styles.btnPrimary
                : searchLocked ? styles.btnLocked
                : styles.btnDisabled
            }`}
            disabled={!canSearch}
            title={searchLocked ? searchLockedLabel : undefined}
            onClick={handleSearch}
          >
            {isSearching
              ? <><span className={styles.spinner}/> Searching...</>
              : searchLocked
              ? <><LockIcon/> {searchLockedLabel}</>
              : isWebOnly
              ? <><BoltIcon/> Search Web</>
              : <><SearchIcon/> Search</>}
          </button>
        )}

        {isFile && (
          <button className={`${styles.btn} ${canAnalyze ? styles.btnTeal : styles.btnDisabled}`}
            disabled={!canAnalyze} onClick={() => file && onAnalyze(file)}>
            {isAnalyzing
              ? <><span className={styles.spinner}/> Analyzing...</>
              : <><DocIcon/> Analyze</>}
          </button>
        )}

        {isUrls && (
          <button
            className={`${styles.btn} ${canUrls ? styles.btnPurple : styles.btnDisabled}`}
            disabled={!canUrls || isSearching}
            onClick={handleSearch}
          >
            {isSearching
              ? <><span className={styles.spinner}/> Analyzing URLs...</>
              : <><LinkIcon/> {URL_TASKS.find(t=>t.id===urlTask)?.icon} {URL_TASKS.find(t=>t.id===urlTask)?.label} {parsedUrls.length > 0 ? `(${parsedUrls.length})` : ''}</>}
          </button>
        )}

        <button className={`${styles.btn} ${canMoreQ ? styles.btnOutline : styles.btnDisabled}`}
          disabled={!canMoreQ} onClick={onMoreQuestion}>
          <PlusIcon/> More question
        </button>

        <span style={{ flex: 1 }} />

        <button className={`${styles.btn} ${canClearW ? styles.btnOutline : styles.btnDisabled}`}
          disabled={!canClearW} onClick={onClearWeb}>
          <TrashIcon/> Clear web
        </button>

        <button className={`${styles.btn} ${canClearF ? styles.btnOutline : styles.btnDisabled}`}
          disabled={!canClearF} onClick={onClearFile}>
          <FileXIcon/> Clear file
        </button>

        <button className={`${styles.btn} ${canReset ? styles.btnDanger : styles.btnDisabled}`}
          disabled={!canReset} onClick={handleReset}>
          <ResetIcon/> Reset
        </button>
      </div>
    </div>
  )
}

function LockIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> }
function SearchIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function BoltIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }
function DocIcon()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg> }
function LinkIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> }
function PlusIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> }
function TrashIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg> }
function FileXIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="18" y1="13" x2="6" y2="13"/></svg> }
function ResetIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> }
