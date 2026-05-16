import { useState } from 'react'
import styles from './UrlAnalyzer.module.css'

interface Props {
  isAnalyzing: boolean
  onAnalyze: (urls: string[], task: string) => void
}

const TASKS = [
  { id: 'summarize', label: 'Summarize',  icon: '📋', desc: 'Independent summary of each URL' },
  { id: 'compare',   label: 'Compare',    icon: '⇄',  desc: 'Side-by-side comparison' },
  { id: 'analyze',   label: 'Analyze',    icon: '🔍', desc: 'Quality, credibility, insights' },
  { id: 'combine',   label: 'Combine',    icon: '🔗', desc: 'Merge into one synthesis' },
]

export function UrlAnalyzer({ isAnalyzing, onAnalyze }: Props) {
  const [raw,     setRaw]     = useState('')
  const [task,    setTask]    = useState('summarize')
  const [error,   setError]   = useState('')

  function parseUrls(text: string): string[] {
    return text
      .split(/[\n,\s]+/)
      .map(s => s.trim())
      .filter(s => /^https?:\/\//i.test(s))
  }

  function handleSubmit() {
    const urls = parseUrls(raw)
    if (urls.length === 0) { setError('Paste at least one URL starting with http:// or https://'); return }
    if (urls.length > 8)   { setError('Maximum 8 URLs at once'); return }
    setError('')
    onAnalyze(urls, task)
  }

  const urls = parseUrls(raw)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.icon}>🔗</span>
        <div>
          <p className={styles.title}>URL Analyzer</p>
          <p className={styles.sub}>Paste URLs to summarize, compare, or synthesize their content using Claude.</p>
        </div>
      </div>

      <textarea
        className={styles.textarea}
        placeholder={'Paste URLs here, one per line or comma-separated:\nhttps://example.com/article-1\nhttps://example.com/article-2'}
        value={raw}
        onChange={e => { setRaw(e.target.value); setError('') }}
        rows={4}
        disabled={isAnalyzing}
      />

      {urls.length > 0 && (
        <div className={styles.urlChips}>
          {urls.map((u, i) => (
            <span key={i} className={styles.urlChip} title={u}>
              🔗 {new URL(u).hostname}
            </span>
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.taskRow}>
        {TASKS.map(t => (
          <button
            key={t.id}
            className={`${styles.taskBtn} ${task === t.id ? styles.taskBtnActive : ''}`}
            onClick={() => setTask(t.id)}
            title={t.desc}
            disabled={isAnalyzing}
          >
            <span className={styles.taskIcon}>{t.icon}</span>
            <span className={styles.taskLabel}>{t.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.footer}>
        <span className={styles.hint}>
          {urls.length === 0 ? 'No valid URLs detected yet' : `${urls.length} URL${urls.length > 1 ? 's' : ''} ready · Task: ${TASKS.find(t => t.id === task)?.desc}`}
        </span>
        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={isAnalyzing || urls.length === 0}
        >
          {isAnalyzing ? '⏳ Analyzing...' : `${TASKS.find(t => t.id === task)?.icon} ${TASKS.find(t => t.id === task)?.label}`}
        </button>
      </div>
    </div>
  )
}
