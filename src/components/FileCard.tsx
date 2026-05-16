import { useRef, useEffect, useState } from 'react'
import styles from './FileCard.module.css'

export interface FileCardData {
  id:          string
  rank:        number
  type:        'file'
  zone:        'file'
  cardKind:    string
  title:       string
  snippet:     string
  steps:       string[]
  math:        string
  solution:    string
  chartSpec:   ChartSpec | null
  tags:        string[]
  difficulty:  string
  pairId:      string | null
  pairType:    string | null
  source:      string
  visible:     boolean
  docSelected: boolean
  groupValues: Record<string, string>
}

interface ChartSpec {
  type:        string
  labels:      string[]
  values:      number[]
  description: string
}

interface Props {
  card:           FileCardData
  onExpand:       () => void
  onDismiss:      () => void
  onToggleDoc:    () => void
  isDragging?:    boolean
  dragListeners?: Record<string, unknown>
  dragAttributes?: Record<string, unknown>
}

// ── KaTeX fix: unescape double-backslashes from API ───────────────────────────
function fixLatex(raw: string): string {
  return raw.replace(/\\\\/g, '\\')
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

function InlineMath({ text }: { text: string }) {
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

// ── Mini chart (unchanged) ────────────────────────────────────────────────────
function MiniChart({ spec }: { spec: ChartSpec }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !spec.labels?.length || !spec.values?.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width = canvas.offsetWidth || 240
    const h = canvas.height = 120
    const pad = { top: 12, right: 12, bottom: 28, left: 36 }
    const chartW = w - pad.left - pad.right
    const chartH = h - pad.top - pad.bottom
    ctx.clearRect(0, 0, w, h)
    const max = Math.max(...spec.values, 1)
    const colors = ['#0E7490','#065F46','#854F0B','#3C3489','#991B1B']
    if (spec.type === 'bar') {
      const barW = chartW / spec.labels.length - 4
      spec.values.forEach((val, i) => {
        const x = pad.left + i * (chartW / spec.labels.length) + 2
        const bh = (val / max) * chartH
        const y = pad.top + chartH - bh
        ctx.fillStyle = colors[i % colors.length]
        ctx.fillRect(x, y, barW, bh)
        ctx.fillStyle = '#64748B'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText(String(spec.labels[i]).slice(0, 8), x + barW / 2, h - 4)
      })
    } else if (spec.type === 'line') {
      ctx.beginPath(); ctx.strokeStyle = '#0E7490'; ctx.lineWidth = 2
      spec.values.forEach((val, i) => {
        const x = pad.left + i * (chartW / (spec.values.length - 1))
        const y = pad.top + chartH - (val / max) * chartH
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
    } else if (spec.type === 'pie') {
      const cx = w / 2, cy = h / 2 - 4, r = Math.min(cx, cy) - 10
      const total = spec.values.reduce((a, b) => a + b, 0)
      let angle = -Math.PI / 2
      spec.values.forEach((val, i) => {
        const slice = (val / total) * Math.PI * 2
        ctx.beginPath(); ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r, angle, angle + slice)
        ctx.closePath(); ctx.fillStyle = colors[i % colors.length]; ctx.fill()
        angle += slice
      })
    }
  }, [spec])
  return (
    <div className={styles.chartWrap}>
      <canvas ref={ref} className={styles.chart} />
      {spec.description && <p className={styles.chartDesc}>{spec.description}</p>}
    </div>
  )
}

// ── Card kind config ──────────────────────────────────────────────────────────
function kindMeta(kind: string) {
  switch (kind) {
    case 'question':   return { icon: '❓', label: 'Question',   color: '#185FA5', bg: '#E6F1FB' }
    case 'solution':   return { icon: '✅', label: 'Solution',   color: '#065F46', bg: '#DCFCE7' }
    case 'formula':    return { icon: '∑',  label: 'Formula',    color: '#3C3489', bg: '#EEEDFE' }
    case 'chapter':    return { icon: '📖', label: 'Chapter',    color: '#854F0B', bg: '#FAEEDA' }
    case 'comparison': return { icon: '⇄',  label: 'Comparison', color: '#991B1B', bg: '#FEE2E2' }
    case 'data':       return { icon: '📊', label: 'Data',       color: '#065F46', bg: '#DCFCE7' }
    case 'summary':    return { icon: '✦',  label: 'Summary',    color: '#1B2E4B', bg: '#E6F1FB' }
    default:           return { icon: '📄', label: 'Note',       color: '#64748B', bg: '#F1EFE8' }
  }
}

function DiffBadge({ level }: { level: string }) {
  if (!level) return null
  const cls = level === 'advanced' ? styles.diffAdv : level === 'intermediate' ? styles.diffMid : styles.diffBeg
  return <span className={`${styles.diffBadge} ${cls}`}>{level}</span>
}

function PairBadge({ pairId, pairType }: { pairId: string; pairType: string }) {
  const isQ = pairType === 'question'
  return (
    <span className={styles.pairBadge} title={`${isQ ? 'Question' : 'Solution'} — pair #${pairId}`}>
      {isQ ? '❓' : '✅'} #{pairId}
    </span>
  )
}

// ── Shared footer icons ───────────────────────────────────────────────────────
function PrintIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> }
function MailIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg> }
function MsgIcon()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function ExpandIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> }
function CloseIcon()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function GripIcon()   { return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.2"/><circle cx="11" cy="3" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="13" r="1.2"/><circle cx="11" cy="13" r="1.2"/></svg> }

// ── Main component ────────────────────────────────────────────────────────────
export function FileCard({
  card, onExpand, onDismiss, onToggleDoc,
  isDragging, dragListeners, dragAttributes,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const meta = kindMeta(card.cardKind)

  return (
    <div
      className={`${styles.card} ${card.docSelected ? styles.docSelected : ''}`}
      style={{ borderTopColor: meta.color }}
    >
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
        {/* Header row — matches SearchCard layout */}
        <div className={styles.header}>
          <span className={styles.kindBadge} style={{ background: meta.bg, color: meta.color }}>
            {meta.icon} {meta.label}
          </span>
          {card.pairId && card.pairType && (
            <PairBadge pairId={card.pairId} pairType={card.pairType} />
          )}
          {card.difficulty && <DiffBadge level={card.difficulty} />}
          {/* Drag grip — far right */}
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

        {card.snippet && (
          <p className={styles.snippet}><InlineMath text={card.snippet} /></p>
        )}

        {card.math && <MathBlock latex={card.math} display={true} />}

        {card.steps && card.steps.length > 0 && (
          <div className={styles.steps}>
            {(expanded ? card.steps : card.steps.slice(0, 2)).map((step, i) => (
              <div key={i} className={styles.step}>
                <span className={styles.stepNum} style={{ background: meta.color }}>{i + 1}</span>
                <span className={styles.stepText}><InlineMath text={step} /></span>
              </div>
            ))}
            {card.steps.length > 2 && (
              <button
                className={styles.showMore}
                style={{ color: meta.color }}
                onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              >
                {expanded ? '▲ Show less' : `▼ ${card.steps.length - 2} more steps`}
              </button>
            )}
          </div>
        )}

        {card.solution && (
          <div className={styles.solution} style={{ borderLeftColor: meta.color, background: meta.bg }}>
            <span className={styles.solutionLabel} style={{ color: meta.color }}>Answer: </span>
            <InlineMath text={card.solution} />
          </div>
        )}

        {card.chartSpec && <MiniChart spec={card.chartSpec} />}

        {card.tags.length > 0 && (
          <div className={styles.tags}>
            {card.tags.slice(0, 4).map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
          </div>
        )}
      </div>

      {/* ── Footer — identical chrome to SearchCard ── */}
      <div className={styles.footer}>
        <div className={styles.docGroup}>
          <input type="checkbox" id={`doc-file-${card.id}`}
            checked={card.docSelected} onChange={onToggleDoc} className={styles.docCheck} />
          <label htmlFor={`doc-file-${card.id}`} className={styles.docLabel}>doc</label>
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
