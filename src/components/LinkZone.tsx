import { useState } from 'react'
import type { LinkResult } from '../types'
import styles from './LinkZone.module.css'

interface Props {
  links: LinkResult[]
  onConvert: (count: number) => void
}

const INCREMENT = 5

export function LinkZone({ links, onConvert }: Props) {
  const [customN, setCustomN] = useState(INCREMENT)

  if (links.length === 0) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.badge}>🔗 Additional results</span>
          <span className={styles.subtitle}>
            {links.length} more result{links.length !== 1 ? 's' : ''} shown as links —
            convert any number into cards
          </span>
        </div>

        {/* Convert controls */}
        <div className={styles.controls}>
          <button
            className={styles.convertBtn}
            onClick={() => onConvert(INCREMENT)}
            disabled={links.length === 0}
          >
            +{INCREMENT} cards
          </button>

          <div className={styles.customGroup}>
            <input
              type="number"
              min={1}
              max={links.length}
              value={customN}
              onChange={e => setCustomN(Math.max(1, Math.min(links.length, Number(e.target.value))))}
              className={styles.customInput}
            />
            <button
              className={styles.convertBtn}
              onClick={() => onConvert(customN)}
              disabled={links.length === 0}
            >
              Add as cards
            </button>
          </div>

          <button
            className={`${styles.convertBtn} ${styles.allBtn}`}
            onClick={() => onConvert(links.length)}
            disabled={links.length === 0}
          >
            All ({links.length})
          </button>
        </div>
      </div>

      <ol className={styles.list}>
        {links.map((link) => (
          <li key={link.id} className={styles.item}>
            <span className={styles.rank}>#{link.rank}</span>
            <div className={styles.body}>
              <a href={`https://${link.url}`} className={styles.title} target="_blank" rel="noopener noreferrer">
                {link.title}
              </a>
              <span className={styles.url}>{link.url}</span>
              <p className={styles.snippet}>{link.snippet}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
