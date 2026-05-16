import { useRef, useEffect } from 'react'
import type { SearchCard } from '../types'
import styles from './ExpandOverlay.module.css'

// ── KaTeX fix: unescape double-backslashes from API (\\frac → \frac) ─────────
function fixLatex(raw: string): string {
  return raw.replace(/\\\\/g, '\\')
}

async function renderMath(el: HTMLElement, latex: string, display = false) {
  try {
    const katex = await import('katex')
    katex.default.render(fixLatex(latex), el, { throwOnError: false, displayMode: display, output: 'html' })
  } catch {
    el.textContent = latex
  }
}

function MathBlock({ latex, display = false }: { latex: string; display?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => { if (ref.current) renderMath(ref.current, latex, display) }, [latex, display])
  return <span ref={ref} />
}

// ── Step: splits on $...$ and \(...\) and renders each part via KaTeX ────────
function Step({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const parts = text.split(/(\\\(.*?\\\)|\$[^$]+\$)/g)
    el.innerHTML = ''
    parts.forEach(part => {
      if (part.startsWith('\\(') && part.endsWith('\\)')) {
        const span = document.createElement('span')
        renderMath(span, part.slice(2, -2), false)
        el.appendChild(span)
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const span = document.createElement('span')
        renderMath(span, part.slice(1, -1), false)
        el.appendChild(span)
      } else {
        el.appendChild(document.createTextNode(part))
      }
    })
  }, [text])

  return <span ref={ref} />
}

interface Props {
  card: SearchCard
  onClose: () => void
  onToggleDoc: () => void
}

export function ExpandOverlay({ card, onClose, onToggleDoc }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.panel} role="dialog" aria-modal="true">
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Header */}
        <div className={styles.meta}>
          <span className={styles.rank}>#{card.rank}</span>
          <span className={styles.src}>{card.source}</span>
          <span className={styles.typePill}>{card.type}</span>
        </div>

        <h2 className={styles.title}>{card.title}</h2>

        {/* Video */}
        {card.hasVideo && (
          <div className={styles.vidBlock}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="rgba(147,197,253,0.85)" stroke="none">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span>Video player — opens in full SeekNBuild player</span>
          </div>
        )}

        {/* Main math */}
        {card.math && (
          <div className={styles.mathBlock}>
            <MathBlock latex={card.math} display />
          </div>
        )}

        {/* Snippet */}
        <p className={styles.snippet}>{card.snippet}</p>

        {/* Solution steps */}
        {card.steps && card.steps.length > 0 && (
          <div className={styles.stepsSection}>
            <div className={styles.stepsLabel}>Solution steps</div>
            <ol className={styles.steps}>
              {card.steps.map((step, i) => (
                <li key={i} className={styles.step}>
                  <Step text={step} />
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Tags */}
        <div className={styles.tags}>
          {card.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={onClose}>← Back to results</button>
          <button className={styles.actionBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print
          </button>
          <button className={styles.actionBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
            </svg>
            Email
          </button>
          <button className={styles.actionBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Copy link
          </button>
          {!card.hasVideo && (
            <button className={styles.actionBtnPrimary} onClick={() => { onToggleDoc(); onClose() }}>
              {card.docSelected ? '✓ In document' : '+ Add to document'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
