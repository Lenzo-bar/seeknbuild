import styles from './Toolbar.module.css'

interface Props {
  visible: number
  cols: number
  onColsChange: (n: number) => void
}

export function Toolbar({ visible, cols, onColsChange }: Props) {
  return (
    <div className={styles.bar}>
      <span className={styles.info}>
        {visible} card{visible !== 1 ? 's' : ''} &nbsp;·&nbsp; 0.41 s &nbsp;·&nbsp; LLM + Web synthesis
      </span>
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
