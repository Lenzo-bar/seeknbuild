import styles from './Toolbar.module.css'

interface Props {
  visible:      number
  total:        number
  cols:         number
  isSearching:  boolean
  isFiltering:  boolean
  searchTime:   number | null   // ms
  filterTime:   number | null   // ms
  onColsChange: (n: number) => void
}

function fmt(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`
}

export function Toolbar({ visible, total, cols, isSearching, isFiltering, searchTime, filterTime, onColsChange }: Props) {
  const isFiltered = total > 0 && visible < total

  return (
    <div className={styles.bar}>
      <div className={styles.left}>

        {/* Searching spinner */}
        {isSearching && (
          <span className={styles.statusChip}>
            <span className={styles.spinner} />
            Searching…
          </span>
        )}

        {/* Filtering spinner */}
        {!isSearching && isFiltering && (
          <span className={`${styles.statusChip} ${styles.filterChip}`}>
            <span className={`${styles.spinner} ${styles.spinnerTeal}`} />
            Applying filters…
          </span>
        )}

        {/* Results count */}
        {!isSearching && !isFiltering && total > 0 && (
          <span className={styles.info}>
            {isFiltered ? (
              <>
                <span className={styles.countHighlight}>{visible}</span>
                <span className={styles.countMuted}> of {total}</span>
                <span className={styles.dot}>·</span>
                <span className={styles.filterTag}>filtered</span>
              </>
            ) : (
              <>
                <span className={styles.countHighlight}>{total}</span>
                <span className={styles.countMuted}> card{total !== 1 ? 's' : ''}</span>
              </>
            )}

            {/* Timing */}
            {filterTime !== null && isFiltered && (
              <>
                <span className={styles.dot}>·</span>
                <span className={styles.time}>{fmt(filterTime)}</span>
              </>
            )}
            {filterTime === null && searchTime !== null && (
              <>
                <span className={styles.dot}>·</span>
                <span className={styles.time}>{fmt(searchTime)}</span>
              </>
            )}

            <span className={styles.dot}>·</span>
            <span className={styles.source}>LLM + Web synthesis</span>
          </span>
        )}
      </div>

      <div className={styles.controls}>
        <span className={styles.label}>Columns</span>
        {[2, 3, 4].map(n => (
          <button
            key={n}
            className={`${styles.colBtn} ${cols === n ? styles.colBtnOn : ''}`}
            onClick={() => onColsChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
