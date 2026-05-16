import { useRef, useEffect, useState } from 'react'
import styles from './LlmCard.module.css'

interface LlmCardData {
  id:          string
  rank:        number
  title:       string
  snippet:     string
  steps:       string[]
  math:        string
  solution:    string
  tags:        string[]
  difficulty:  string
  docSelected: boolean
  visible:     boolean
}

interface Props {
  card:          LlmCardData
  onExpand:      () => void
  onDismiss:     () => void
  onToggleDoc:   () => void
  isDragging?:   boolean
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
}

// ── KaTeX fix: unescape double-backslashes from API (\\frac → \frac) ─────────
function fixLatex(raw: string): string {
  return raw
    .replace(/\\\\/g, '\\')
    // Unicode math symbols → KaTeX commands
    .replace(/—/g, '-')      // ← ADD THIS — em dash → hyphen
    .replace(/–/g, '-')      // ← ADD THIS — en dash → hyphen  
    .replace(/≈/g, '\\approx')
    .replace(/≠/g, '\\neq')
    .replace(/≤/g, '\\leq')
    .replace(/≥/g, '\\geq')
    .replace(/→/g, '\\rightarrow')
    .replace(/←/g, '\\leftarrow')
    .replace(/↔/g, '\\leftrightarrow')
    .replace(/∞/g, '\\infty')
    .replace(/∑/g, '\\sum')
    .replace(/∏/g, '\\prod')
    .replace(/∫/g, '\\int')
    .replace(/√/g, '\\sqrt')
    .replace(/∂/g, '\\partial')
    .replace(/∇/g, '\\nabla')
    .replace(/∈/g, '\\in')
    .replace(/∉/g, '\\notin')
    .replace(/⊂/g, '\\subset')
    .replace(/⊃/g, '\\supset')
    .replace(/∪/g, '\\cup')
    .replace(/∩/g, '\\cap')
    .replace(/∅/g, '\\emptyset')
    .replace(/±/g, '\\pm')
    .replace(/×/g, '\\times')
    .replace(/÷/g, '\\div')
    .replace(/°/g, '^{\\circ}')
    .replace(/α/g, '\\alpha').replace(/β/g, '\\beta').replace(/γ/g, '\\gamma')
    .replace(/δ/g, '\\delta').replace(/ε/g, '\\epsilon').replace(/θ/g, '\\theta')
    .replace(/λ/g, '\\lambda').replace(/μ/g, '\\mu').replace(/π/g, '\\pi')
    .replace(/σ/g, '\\sigma').replace(/τ/g, '\\tau').replace(/φ/g, '\\phi')
    .replace(/ω/g, '\\omega')
}

async function renderMath(el: HTMLElement, latex: string, display = true) {
  try {
    const katex = await import('katex')
    katex.default.render(fixLatex(latex), el, {
      throwOnError: false, displayMode: display, output: 'html',
    })
  } catch { el.textContent = latex }
}

function MathBlock({ latex, display = true }: { latex: string; display?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current && latex) renderMath(ref.current, latex, display) }, [latex, display])
  return <div ref={ref} className={styles.mathBlock} />
}

function StepLine({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const parts = text.split(/(\$[^$]+\$)/)
    el.innerHTML = ''
    parts.forEach(part => {
      if (part.startsWith('$') && part.endsWith('$')) {
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

function DiffBadge({ level }: { level: string }) {
  const cls = level === 'advanced'     ? styles.diffAdvanced
            : level === 'intermediate' ? styles.diffIntermediate
            : styles.diffBeginner
  return <span className={`${styles.diffBadge} ${cls}`}>{level}</span>
}

// ── Shared footer icons (identical SVGs to SearchCard) ───────────────────────
function PrintIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> }
function MailIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg> }
function MsgIcon()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function ExpandIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> }
function CloseIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function GripIcon()   { return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.2"/><circle cx="11" cy="3" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="13" r="1.2"/><circle cx="11" cy="13" r="1.2"/></svg> }

export function LlmCard({
  card, onExpand, onDismiss, onToggleDoc,
  isDragging, dragListeners, dragAttributes,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const isSummary = card.rank === 0

  return (
    <div className={`${styles.card} ${card.docSelected ? styles.docSelected : ''} ${isSummary ? styles.summaryCard : ''}`}>

      {/* ── Scrollable body ── */}
      <div
        className={styles.cardContent}
        onClick={e => {
          const t = e.target as HTMLElement
          if (!t.closest('button') && !t.closest('input') && !t.closest('label')) onExpand()
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).classList.add(styles.scrollVisible)}
        onMouseLeave={e => (e.currentTarget as HTMLElement).classList.remove(styles.scrollVisible)}
      >
        {/* Header row — matches SearchCard exactly */}
        <div className={styles.header}>
          {!isSummary && <span className={styles.rank}>#{card.rank}</span>}
          <span className={styles.typeBadge}>{isSummary ? '✦ LLM Summary' : '⚙ LLM'}</span>
          {card.difficulty && !isSummary && <DiffBadge level={card.difficulty} />}
          {/* Drag grip — far right of header */}
          <div
            className={`${styles.grip} ${isDragging ? styles.gripDragging : ''}`}
            {...dragListeners}
            {...dragAttributes}
            title="Drag to reorder"
            onClick={e => e.stopPropagation()}
          >
            <GripIcon />
          </div>
        </div>

        <h3 className={styles.title}>{card.title}</h3>
        <p className={styles.snippet}>{card.snippet}</p>

        {card.math && !isSummary && <MathBlock latex={card.math} display={true} />}

        {card.steps && card.steps.length > 0 && !isSummary && (
          <div className={styles.steps}>
            {(expanded ? card.steps : card.steps.slice(0, 2)).map((step, i) => (
              <div key={i} className={styles.step}>
                <span className={styles.stepNum}>{i + 1}</span>
                <span className={styles.stepText}><StepLine text={step} /></span>
              </div>
            ))}
            {card.steps.length > 2 && (
              <button className={styles.showMore} onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}>
                {expanded ? '▲ Show less' : `▼ ${card.steps.length - 2} more steps`}
              </button>
            )}
          </div>
        )}

        {card.solution && !isSummary && (
          <div className={styles.solution}>
            <span className={styles.solutionLabel}>Answer: </span>
            <StepLine text={card.solution} />
          </div>
        )}

        {card.tags.length > 0 && (
          <div className={styles.tags}>
            {card.tags.slice(0, 4).map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
          </div>
        )}
      </div>

      {/* ── Footer — identical chrome to SearchCard ── */}
      <div className={styles.footer}>
        <div className={styles.docGroup}>
          <input type="checkbox" id={`doc-llm-${card.id}`}
            checked={card.docSelected} onChange={onToggleDoc} className={styles.docCheck} />
          <label htmlFor={`doc-llm-${card.id}`} className={styles.docLabel}>doc</label>
        </div>

        <div className={styles.sep} />

        <button className={styles.footBtn} title="Print" onClick={e => e.stopPropagation()}><PrintIcon /></button>
        <button className={styles.footBtn} title="Email" onClick={e => e.stopPropagation()}><MailIcon /></button>
        <button className={styles.footBtn} title="Message" onClick={e => e.stopPropagation()}><MsgIcon /></button>

        <div className={styles.footRight}>
          <div className={styles.sep} />
          <button className={`${styles.footBtn} ${styles.expandBtn}`} title="Expand card"
            onClick={e => { e.stopPropagation(); onExpand() }}><ExpandIcon /></button>
          <div className={styles.sep} />
          <button className={`${styles.footBtn} ${styles.closeBtn}`} title="Remove card"
            onClick={e => { e.stopPropagation(); onDismiss() }}><CloseIcon /></button>
        </div>
      </div>
    </div>
  )
}
