import { useState } from 'react'
import styles from './MoreQuestionPanel.module.css'
import type { MoreHistoryEntry } from '../hooks/useCards'

interface Props {
  onSubmit:  (query: string) => void
  onCancel:  () => void
  isLoading?: boolean
  history?:   MoreHistoryEntry[]
  onRerun?:   (q: string) => void
}

export function MoreQuestionPanel({
  onSubmit,
  onCancel,
  isLoading = false,
  history   = [],
  onRerun,
}: Props) {
  const [text, setText] = useState('')

  function handleSubmit() {
    if (!text.trim() || isLoading) return
    onSubmit(text.trim())
    setText('')
  }

  return (
    <div className={styles.panel}>

      {/* History list */}
      {history.length > 0 && (
        <div className={styles.history}>
          <div className={styles.historyLabel}>Follow-up history</div>
          {history.map((h, i) => (
            <button
              key={i}
              className={styles.historyEntry}
              onClick={() => onRerun?.(h.question)}
              title="Click to re-run this question"
            >
              <span className={styles.historyQ}>{h.question}</span>
              <span className={styles.historyMeta}>
                {h.cardCount} card{h.cardCount !== 1 ? 's' : ''} · {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.label}>
        <span className={styles.labelIcon}>➕</span>
        Additional question — new cards will appear in a separate zone below current results
      </div>

      <textarea
        className={styles.textarea}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit() }}
        placeholder="Type a follow-up or supplementary question…"
        rows={2}
        autoFocus
        disabled={isLoading}
      />

      <div className={styles.actions}>
        <span className={styles.hint}>Ctrl+Enter to submit</span>
        <button className={styles.cancelBtn} onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
        <button
          className={styles.submitBtn}
          disabled={!text.trim() || isLoading}
          onClick={handleSubmit}
        >
          {isLoading
            ? <><span className={styles.spinner} /> Searching…</>
            : 'Submit question'}
        </button>
      </div>

    </div>
  )
}