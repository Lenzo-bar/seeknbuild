import type { ActiveFilterChip } from '../types'
import styles from './ActiveFilterChips.module.css'

interface Props {
  chips: ActiveFilterChip[]
  onRemove: (id: string) => void
  onClearAll: () => void
}

export function ActiveFilterChips({ chips, onRemove, onClearAll }: Props) {
  if (chips.length === 0) return null

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Filtering by:</span>
      <div className={styles.chips}>
        {chips.map(chip => (
          <span key={chip.id} className={`${styles.chip} ${styles[chip.category.replace('-','_')]}`}>
            <span className={styles.chipLabel}>{chip.label}:</span>
            <span className={styles.chipValue}>{chip.value}</span>
            <button className={styles.chipX} onClick={() => onRemove(chip.id)} title="Remove filter">×</button>
          </span>
        ))}
      </div>
      {chips.length > 1 && (
        <button className={styles.clearAll} onClick={onClearAll}>Clear all</button>
      )}
    </div>
  )
}
