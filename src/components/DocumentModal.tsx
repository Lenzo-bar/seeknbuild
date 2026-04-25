import { useRef, useEffect } from 'react'
import type { SearchCard } from '../types'
import styles from './DocumentModal.module.css'

// ── KaTeX helpers ────────────────────────────────────────────────────

async function renderKatex(el: HTMLElement, latex: string, display: boolean) {
  try {
    const katex = await import('katex')
    katex.default.render(latex, el, { throwOnError: false, displayMode: display, output: 'html' })
  } catch { el.textContent = latex }
}

/** Display-mode math block (for card.math) */
function MathBlock({ latex }: { latex: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => { if (ref.current) renderKatex(ref.current, latex, true) }, [latex])
  return <span ref={ref} />
}

/**
 * Inline step renderer — parses \(...\) delimiters and renders each
 * fragment as inline KaTeX, leaving plain text as-is.
 */
function StepLine({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    // Split on \( ... \) inline math delimiters
    const parts = text.split(/(\\\(.*?\\\))/gs)
    ref.current.innerHTML = ''
    for (const part of parts) {
      const mathMatch = part.match(/^\\\((.*?)\\\)$/s)
      if (mathMatch) {
        const span = document.createElement('span')
        import('katex').then(({ default: katex }) => {
          katex.render(mathMatch[1], span, { throwOnError: false, displayMode: false, output: 'html' })
        })
        ref.current!.appendChild(span)
      } else {
        ref.current!.appendChild(document.createTextNode(part))
      }
    }
  }, [text])

  return <span ref={ref}>{text}</span>
}

// ── Zone labels ──────────────────────────────────────────────────────

const ZONE_META: Record<string, { label: string; color: string }> = {
  web:  { label: 'Web + LLM',          color: '#1B3A6B' },
  file: { label: 'File analysis',       color: '#0D7A8A' },
  more: { label: 'Additional question', color: '#854F0B' },
}

// ── Component ────────────────────────────────────────────────────────

interface Props {
  cards: SearchCard[]
  onClose: () => void
}

export function DocumentModal({ cards, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handlePrint() { window.print() }

  function handleDownloadTxt() {
    // Strip LaTeX delimiters for plain-text export
    const stripMath = (s: string) => s.replace(/\\\(|\\\)/g, '').replace(/\\[a-zA-Z]+\{[^}]*\}/g, '…')
    const lines: string[] = [
      'SeekNBuild Research Document',
      `Generated: ${new Date().toLocaleString()}`,
      '='.repeat(60),
    ]
    for (const card of cards) {
      const zl = ZONE_META[card.zone]?.label ?? card.zone
      lines.push('', `[${zl}]`, `## ${card.title}`, card.snippet)
      if (card.steps?.length) {
        lines.push('Steps:')
        card.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${stripMath(s)}`))
      }
      lines.push(`Source: ${card.source}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'seeknbuild-document.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Document preview — {cards.length} section{cards.length !== 1 ? 's' : ''}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.docTitle}>SeekNBuild Research Document</div>
          <div className={styles.docMeta}>
            Generated {new Date().toLocaleString()} · {cards.length} section{cards.length !== 1 ? 's' : ''} selected
          </div>

          {cards.map(card => {
            const zm = ZONE_META[card.zone] ?? { label: card.zone, color: '#666' }
            return (
              <div key={card.id} className={styles.section}>
                <div className={styles.sourceTag} style={{ color: zm.color }}>
                  {zm.label}
                </div>
                <h3 className={styles.sectionTitle}>{card.title}</h3>
                <p className={styles.sectionBody}>{card.snippet}</p>

                {/* Display-mode math formula */}
                {card.math && (
                  <div className={styles.mathBlock}>
                    <MathBlock latex={card.math} />
                  </div>
                )}

                {/* Solution steps — inline math rendered properly */}
                {card.steps && card.steps.length > 0 && (
                  <ol className={styles.steps}>
                    {card.steps.map((step, i) => (
                      <li key={i}><StepLine text={step} /></li>
                    ))}
                  </ol>
                )}

                <div className={styles.tagRow}>
                  {card.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.actionBtn} onClick={handlePrint}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print
          </button>
          <button className={styles.actionBtn} onClick={handleDownloadTxt}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download .txt
          </button>
          <button className={styles.actionBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Open in editor
          </button>
          <button className={styles.closeFootBtn} onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  )
}
