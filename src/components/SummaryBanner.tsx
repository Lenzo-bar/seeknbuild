import type { SearchCard } from '../types'
import styles from './SummaryBanner.module.css'

interface Props {
  card:        SearchCard
  onExpand:    () => void
  onDismiss:   () => void
  onToggleDoc: () => void
}

export function SummaryBanner({ card, onExpand, onDismiss, onToggleDoc }: Props) {
  return (
    <div className={`${styles.banner} ${card.docSelected ? styles.docSelected : ''}`}>

      {/* ── Left accent + icon ── */}
      <div className={styles.accent}>
        <span className={styles.accentIcon}>✦</span>
      </div>

      {/* ── Main content ── */}
      <div className={styles.body}
        onMouseEnter={e => (e.currentTarget as HTMLElement).classList.add(styles.scrollVisible)}
        onMouseLeave={e => (e.currentTarget as HTMLElement).classList.remove(styles.scrollVisible)}
        onClick={e => {
        const target = e.target as HTMLElement
        if (!target.closest('button') && !target.closest('input') && !target.closest('label')) onExpand()
      }}>
        <div className={styles.header}>
          <span className={styles.label}>AI Summary</span>
          {card.source && (
            <span className={styles.source}>
              {card.source.replace(/^https?:\/\//, '').split('/')[0]}
            </span>
          )}
          {card.tags.length > 0 && (
            <div className={styles.tags}>
              {card.tags.slice(0, 6).map(tag => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        <h2 className={styles.title}>{card.title}</h2>
        <p className={styles.snippet}>{card.snippet}</p>

        {card.steps && card.steps.length > 0 && (
          <div className={styles.steps}>
            {card.steps.slice(0, 3).map((step, i) => (
              <div key={i} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <span className={styles.stepText}>{step.replace(/\\\(.*?\\\)/g, '…')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right action strip ── */}
      <div className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${styles.expandBtn}`}
          title="Expand summary"
          onClick={e => { e.stopPropagation(); onExpand() }}
        >
          <ExpandIcon />
        </button>

        {!card.hasVideo && (
          <label className={styles.docToggle} title="Add to document">
            <input
              type="checkbox"
              checked={card.docSelected}
              onChange={onToggleDoc}
              className={styles.docCheck}
            />
            <span className={styles.docLabel}>doc</span>
          </label>
        )}

        <button
          className={`${styles.actionBtn} ${styles.dismissBtn}`}
          title="Dismiss summary"
          onClick={e => { e.stopPropagation(); onDismiss() }}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

function ExpandIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
}
function CloseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
