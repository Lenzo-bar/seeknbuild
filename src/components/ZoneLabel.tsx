import styles from './ZoneLabel.module.css'

type ZoneColor = 'web' | 'file' | 'more'

interface Props {
  color: ZoneColor
  label: string
  count: number
}

export function ZoneLabel({ color, label, count }: Props) {
  return (
    <div className={`${styles.wrap} ${styles[color]}`}>
      <span className={styles.dot} />
      <span className={styles.label}>{label}</span>
      <span className={styles.count}>{count} card{count !== 1 ? 's' : ''}</span>
    </div>
  )
}
