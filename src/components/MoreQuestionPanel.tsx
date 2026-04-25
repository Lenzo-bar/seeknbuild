import { useState } from 'react'
import styles from './MoreQuestionPanel.module.css'

interface Props {
  onSubmit: (query: string) => void
  onCancel: () => void
}

export function MoreQuestionPanel({ onSubmit, onCancel }: Props) {
  const [text, setText] = useState('')
  return (
    <div className={styles.panel}>
      <div className={styles.label}>
        Additional question — new cards will appear in a separate zone below
      </div>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type a follow-up or supplementary question…"
        rows={2}
        autoFocus
      />
      <div className={styles.actions}>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button
          className={styles.submitBtn}
          disabled={!text.trim()}
          onClick={() => { onSubmit(text); setText('') }}
        >
          Submit question
        </button>
      </div>
    </div>
  )
}
