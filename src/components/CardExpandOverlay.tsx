import { useEffect, useRef } from 'react'
import type { SearchCard } from '../types'
import styles from './CardExpandOverlay.module.css'

interface Props {
  card: SearchCard
  onClose: () => void
  onToggleDoc: () => void
}

export function CardExpandOverlay({ card, onClose, onToggleDoc }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Click outside to close
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  const typeIcon: Record<string, string> = {
    math: '∑', article: '📄', video: '▶', image: '🖼',
    file: '📁', news: '📰', forum: '💬', shopping: '🛒', llm: '✦',
  }

  const typeLabel: Record<string, string> = {
    math: 'Math', article: 'Article', video: 'Video', image: 'Image',
    file: 'File', news: 'News', forum: 'Forum', shopping: 'Shopping', llm: 'AI Answer',
  }

  return (
    <div
      ref={overlayRef}
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={card.title}
    >
      <div className={styles.panel}>

        {/* ── Header bar ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={`${styles.typeBadge} ${styles[`type_${card.type}`]}`}>
              <span className={styles.typeIcon}>{typeIcon[card.type] ?? '•'}</span>
              {typeLabel[card.type] ?? card.type}
            </span>
            {card.outlet && (
              <span className={styles.outlet}>{card.outlet}</span>
            )}
          </div>
          <div className={styles.headerRight}>
            <button
              className={`${styles.iconBtn} ${card.docSelected ? styles.iconBtnOn : ''}`}
              onClick={onToggleDoc}
              title={card.docSelected ? 'Remove from doc' : 'Add to doc'}
            >
              <DocIcon />
              {card.docSelected ? 'In doc' : 'Add to doc'}
            </button>
            <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className={styles.body}>

          {/* Title */}
          <h2 className={styles.title}>{card.title}</h2>

          {/* Source + date row */}
          <div className={styles.meta}>
            {card.source && (
              <span className={styles.source}>
                <GlobeIcon />
                {card.source}
              </span>
            )}
            {card.publishedAt && (
              <span className={styles.date}>{card.publishedAt}</span>
            )}
            {card.videoChannel && (
              <span className={styles.source}>
                <span style={{ fontSize: 11 }}>▶</span>
                {card.videoChannel}
              </span>
            )}
          </div>

          {/* Video embed */}
          {card.type === 'video' && card.videoId && (
            <div className={styles.videoWrap}>
              <iframe
                src={`https://www.youtube.com/embed/${card.videoId}?autoplay=0`}
                title={card.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className={styles.videoFrame}
              />
            </div>
          )}

          {/* Image */}
          {card.imageUrl && card.type !== 'video' && (
            <div className={styles.imageWrap}>
              <img src={card.imageUrl} alt={card.title} className={styles.image} />
            </div>
          )}

          {/* Snippet / full content */}
          {card.snippet && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Summary</div>
              <p className={styles.snippet}>{card.snippet}</p>
            </div>
          )}

          {/* Math block */}
          {card.math && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.mathIcon}>∑</span> Mathematical expression
              </div>
              <div className={styles.mathBlock}>
                <code className={styles.math}>{card.math}</code>
              </div>
            </div>
          )}

          {/* Step-by-step */}
          {card.steps && card.steps.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Step-by-step</div>
              <ol className={styles.steps}>
                {card.steps.map((step, i) => (
                  <li key={i} className={styles.step}>
                    <span className={styles.stepNum}>{i + 1}</span>
                    <span className={styles.stepText}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Price / rating (shopping) */}
          {(card.price || card.rating) && (
            <div className={styles.shoppingRow}>
              {card.price && (
                <span className={styles.price}>{card.price}</span>
              )}
              {card.rating && (
                <span className={styles.rating}>
                  {'★'.repeat(Math.round(card.rating))}{'☆'.repeat(5 - Math.round(card.rating))}
                  <span className={styles.ratingNum}> {card.rating.toFixed(1)}</span>
                </span>
              )}
            </div>
          )}

          {/* Forum stats */}
          {card.type === 'forum' && (card.upvotes !== undefined || card.replies !== undefined) && (
            <div className={styles.forumRow}>
              {card.upvotes !== undefined && (
                <span className={styles.forumStat}>▲ {card.upvotes} upvotes</span>
              )}
              {card.replies !== undefined && (
                <span className={styles.forumStat}>💬 {card.replies} replies</span>
              )}
              {card.forum && (
                <span className={styles.forumStat}>📌 {card.forum}</span>
              )}
            </div>
          )}

          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className={styles.tagsRow}>
              {card.tags.map(tag => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}

          {/* Visit source */}
          {card.source && (
            <div className={styles.visitRow}>
              <a
                href={card.source.startsWith('http') ? card.source : `https://${card.source}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.visitLink}
              >
                Visit source <ExternalIcon />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Icons ── */
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}
function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}
function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}
