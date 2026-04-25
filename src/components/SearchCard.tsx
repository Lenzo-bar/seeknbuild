import { useRef, useEffect } from 'react'
import type { SearchCard as CardData, CardZone } from '../types'
import styles from './SearchCard.module.css'

async function renderMath(el: HTMLElement, latex: string, display = false) {
  try {
    const katex = await import('katex')
    katex.default.render(latex, el, { throwOnError: false, displayMode: display, output: 'html' })
  } catch { el.textContent = latex }
}

function MathBlock({ latex, display = false }: { latex: string; display?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => { if (ref.current) renderMath(ref.current, latex, display) }, [latex, display])
  return <span ref={ref} />
}

interface Props {
  card: CardData
  zone: CardZone
  faded: boolean
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
  style?: React.CSSProperties
  onExpand:    () => void
  onDismiss:   () => void
  onToggleDoc: () => void
}

export function SearchCard({ card, zone, faded, dragListeners, dragAttributes, style, onExpand, onDismiss, onToggleDoc }: Props) {
  const rankClass = zone === 'web' ? styles.rankWeb : zone === 'file' ? styles.rankFile : styles.rankMore
  const badgeClass = card.type === 'math' ? styles.badgeMath : card.type === 'video' ? styles.badgeVid : styles.badgeArt
  const badgeLabel = card.type === 'math' ? 'Math' : card.type === 'video' ? 'Video' : 'Article'

  return (
    <div
      className={`${styles.card} ${faded ? styles.faded : ''} ${card.docSelected ? styles.docSelected : ''}`}
      style={style}
    >
      <div className={styles.dragHandle} {...dragListeners} {...dragAttributes}>
        <div className={styles.header}>
          <span className={`${styles.rank} ${rankClass}`}>#{card.rank}</span>
          <span className={`${styles.badge} ${badgeClass}`}>{badgeLabel}</span>
          <span className={styles.source}>{card.source}</span>
        </div>

        {card.hasVideo && <div className={styles.vidThumb}>▶</div>}

        <h3 className={styles.title}>{card.title}</h3>

        {card.math && (
          <div className={styles.mathBlock}>
            <MathBlock latex={card.math} display />
          </div>
        )}

        <p className={styles.snippet}>{card.snippet}</p>

        {card.steps && card.steps.length > 0 && (
          <div className={styles.stepPreview}>Step 1: {card.steps[0].replace(/\\\(.*?\\\)/g, '…')}</div>
        )}

        <div className={styles.tags}>
          {card.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
        </div>
      </div>

      {/* Unified footer toolbar */}
      <div className={styles.footer}>
        <div className={styles.docGroup}>
          {!card.hasVideo ? (
            <>
              <input type="checkbox" id={`doc-${card.id}`} checked={card.docSelected}
                onChange={onToggleDoc} className={styles.docCheck} />
              <label htmlFor={`doc-${card.id}`} className={styles.docLabel}>doc</label>
            </>
          ) : (
            <span className={styles.noDoc}>no doc</span>
          )}
        </div>

        <div className={styles.sep} />
        <button className={styles.footBtn} title="Print"><PrintIcon /></button>
        <button className={styles.footBtn} title="Email"><MailIcon /></button>
        <button className={styles.footBtn} title="Message"><MsgIcon /></button>

        <div className={styles.footRight}>
          <div className={styles.sep} />
          <button className={`${styles.footBtn} ${styles.expandBtn}`} title="Expand" onClick={onExpand}><ExpandIcon /></button>
          <div className={styles.sep} />
          <button className={`${styles.footBtn} ${styles.closeBtn}`} title="Dismiss" onClick={onDismiss}><CloseIcon /></button>
        </div>
      </div>
    </div>
  )
}

const ico = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)
function PrintIcon()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> }
function MailIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg> }
function MsgIcon()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function ExpandIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> }
function CloseIcon()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
