import { useState, useRef } from 'react'
import type { AppMode } from '../types'
import styles from './PromptBox.module.css'

interface Props {
  hasAny:     boolean
  hasWeb:     boolean
  hasFile:    boolean
  isAnalyzing: boolean
  isSearching: boolean
  onSearch:       (query: string) => void
  onAnalyze:      (file: File) => void   // now passes the real File
  onMoreQuestion: () => void
  onClearWeb:     () => void
  onClearFile:    () => void
  onReset:        () => void
}

export function PromptBox({
  hasAny, hasWeb, hasFile, isAnalyzing, isSearching,
  onSearch, onAnalyze, onMoreQuestion,
  onClearWeb, onClearFile, onReset,
}: Props) {
  const [query,    setQuery]    = useState(
    'Create at least one example of each of the different types of definite integrals in Calculus?'
  )
  const [mode,     setMode]     = useState<AppMode>('web')
  const [mathOn,   setMathOn]   = useState(true)
  const [deepOn,   setDeepOn]   = useState(false)
  const [file,     setFile]     = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isFile = mode === 'file'
  const canSearch  = !isFile && query.trim().length > 0 && !isSearching
  const canAnalyze = isFile && !!file && !isAnalyzing
  const canMoreQ   = hasAny
  const canClearW  = hasWeb
  const canClearF  = hasFile
  const canReset   = hasAny || query.trim().length > 0

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setQuery(`Analyze and organize "${f.name}" into cards by section and chapter`)
  }

  function handleModeClick(m: AppMode) {
    setMode(m)
    if (m !== 'file') setFile(null)
  }

  function handleReset() {
    setQuery(''); setFile(null); setMode('web')
    onReset()
  }

  return (
    <div className={styles.wrap}>
      {/* Mode pills */}
      <div className={styles.modes}>
        {(['web', 'llm', 'file'] as AppMode[]).map(m => (
          <button
            key={m}
            className={`${styles.pill} ${mode === m ? styles.pillOn : ''}`}
            onClick={() => handleModeClick(m)}
          >
            {m === 'web' ? 'Web + LLM' : m === 'llm' ? 'LLM only' : 'File analysis'}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        className={styles.textarea}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') canSearch && onSearch(query) }}
        placeholder="Ask anything — or switch to File analysis to upload a document…"
        rows={3}
      />

      {/* File drop zone */}
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

      {/* Tool strip */}
      <div className={styles.toolStrip}>
        <button className={`${styles.tool} ${mathOn ? styles.toolOn : ''}`} onClick={() => setMathOn(v => !v)}>
          <span>∑</span> Math {mathOn ? 'on' : 'off'}
        </button>
        <button className={`${styles.tool} ${deepOn ? styles.toolOn : ''}`} onClick={() => setDeepOn(v => !v)}>
          <span>⟳</span> Deep research
        </button>
        <button className={styles.tool} onClick={() => { setMode('file'); setTimeout(() => fileRef.current?.click(), 50) }}>
          <span>⊕</span> Attach file
        </button>
        <span className={styles.hint}>{query.length} chars</span>
      </div>

      {/* Action buttons */}
      <div className={styles.btnRow}>
        <button className={`${styles.btn} ${canSearch ? styles.btnPrimary : styles.btnDisabled}`}
          disabled={!canSearch} onClick={() => onSearch(query)} title="Search">
          {isSearching
            ? <><span className={styles.spinner} /> Searching…</>
            : <><SearchIcon /> Search</>}
        </button>

        <button className={`${styles.btn} ${canAnalyze ? styles.btnTeal : styles.btnDisabled}`}
          disabled={!canAnalyze} onClick={() => file && onAnalyze(file)}
          title={isFile ? (file ? 'Analyze the uploaded file' : 'Select a file first') : 'Switch to File analysis mode'}>
          {isAnalyzing
            ? <><span className={styles.spinner} /> Analyzing…</>
            : <><DocIcon /> Analyze</>}
        </button>

        <button className={`${styles.btn} ${canMoreQ ? styles.btnOutline : styles.btnDisabled}`}
          disabled={!canMoreQ} onClick={onMoreQuestion} title="Add a follow-up question">
          <PlusIcon /> More question
        </button>

        <span style={{ flex: 1 }} />

        <button className={`${styles.btn} ${canClearW ? styles.btnOutline : styles.btnDisabled}`}
          disabled={!canClearW} onClick={onClearWeb} title="Clear web result cards — keeps prompt">
          <TrashIcon /> Clear web result
        </button>

        <button className={`${styles.btn} ${canClearF ? styles.btnOutline : styles.btnDisabled}`}
          disabled={!canClearF} onClick={onClearFile} title="Clear file analysis cards">
          <FileXIcon /> Clear file info
        </button>

        <button className={`${styles.btn} ${canReset ? styles.btnDanger : styles.btnDisabled}`}
          disabled={!canReset} onClick={handleReset} title="Reset everything">
          <ResetIcon /> Reset
        </button>
      </div>
    </div>
  )
}

function SearchIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function DocIcon()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg> }
function PlusIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> }
function TrashIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg> }
function FileXIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="18" y1="13" x2="6" y2="13"/></svg> }
function ResetIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> }
