import { useState } from 'react'
import type { FilterState } from '../types'
import { CHECKBOX_FILTERS, LEARNER_LEVELS, EXTRA_FILTERS } from '../data/integralCards'
import styles from './FilterBar.module.css'

interface Props {
  visible: number
  total: number
  selected: number
  onRefine: (f: FilterState) => void
}

export function FilterBar({ visible, total, selected, onRefine }: Props) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CHECKBOX_FILTERS.map((l, i) => [l, i < 3]))
  )
  const [level, setLevel] = useState('University — undergraduate')
  const [extra, setExtra] = useState('Select a filter...')

  function toggle(label: string) {
    setChecks(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function handleRefine() {
    onRefine({ checkboxes: checks, learnerLevel: level, extraFilter: extra })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.sectionLabel}>Top 10 filters — Calculus / Integration</div>

      <div className={styles.cbGrid}>
        {CHECKBOX_FILTERS.map(label => (
          <label key={label} className={`${styles.cbItem} ${checks[label] ? styles.cbOn : ''}`}>
            <input
              type="checkbox"
              checked={!!checks[label]}
              onChange={() => toggle(label)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className={styles.dropRow}>
        <div className={styles.selectWrap}>
          <span className={styles.selectLabel}>Learner level</span>
          <select value={level} onChange={e => setLevel(e.target.value)} className={styles.select}>
            {LEARNER_LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>

        <div className={styles.selectWrap}>
          <span className={styles.selectLabel}>Additional filter</span>
          <select value={extra} onChange={e => setExtra(e.target.value)} className={styles.select}>
            {EXTRA_FILTERS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>

        <button className={styles.refineBtn} onClick={handleRefine}>
          Refine results
        </button>
      </div>

      <div className={styles.stats}>
        Showing <strong>{visible}</strong> of <strong>{total}</strong> cards
        {selected > 0 && <> · <strong>{selected}</strong> selected for document</>}
        {total - visible > 0 && <> · {total - visible} dismissed</>}
      </div>
    </div>
  )
}
