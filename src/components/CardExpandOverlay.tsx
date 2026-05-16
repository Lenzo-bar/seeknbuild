// src/components/CardExpandOverlay.tsx
// Card expand overlay with on-demand AI enrichment.
// Enrichment fires automatically when the overlay opens.

import { useEffect, useRef, useState } from 'react'
import type { SearchCard } from '../types'
import styles from './CardExpandOverlay.module.css'

// ── Enrichment types ──────────────────────────────────────────────────────────

interface Citation { label: string; url?: string }

interface ChartData { label: string; value: number }

interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'table'
  title: string
  description?: string
  data: ChartData[]
}

interface Enrichment {
  paragraphs:           string[]
  imageQueries:         string[]
  chart:                ChartSpec | null
  citations:            Citation[]
  relevanceNote:        string
  recommendationScore:  number | null
  recommendationReason: string
}

// ── Mini chart (no external deps) ────────────────────────────────────────────

function MiniChart({ chart }: { chart: ChartSpec }) {
  if (!chart?.data?.length) return null

  if (chart.type === 'pie') {
    const total  = chart.data.reduce((s, d) => s + (d.value || 0), 0)
    const COLORS = ['#4f9cf9','#f9a24f','#4fd9a2','#f94f7c','#b44ff9','#f9f04f']
    let cumAngle = -Math.PI / 2
    const slices = chart.data.map((d, i) => {
      const angle = (d.value / total) * 2 * Math.PI
      const x1 = 80 + 70 * Math.cos(cumAngle)
      const y1 = 80 + 70 * Math.sin(cumAngle)
      cumAngle += angle
      const x2 = 80 + 70 * Math.cos(cumAngle)
      const y2 = 80 + 70 * Math.sin(cumAngle)
      const large = angle > Math.PI ? 1 : 0
      return { d:`M80,80 L${x1},${y1} A70,70 0 ${large},1 ${x2},${y2} Z`, color:COLORS[i%COLORS.length], label:d.label, pct:Math.round((d.value/total)*100) }
    })
    return (
      <div className={styles.chartWrap}>
        <p className={styles.chartTitle}>{chart.title}</p>
        <div className={styles.pieGrid}>
          <svg viewBox="0 0 160 160" width="140" height="140">
            {slices.map((s,i)=><path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth="2"/>)}
          </svg>
          <ul className={styles.pieLegend}>
            {slices.map((s,i)=>(
              <li key={i} className={styles.pieLegendItem}>
                <span className={styles.pieDot} style={{background:s.color}}/>
                {s.label} — {s.pct}%
              </li>
            ))}
          </ul>
        </div>
        {chart.description&&<p className={styles.chartDesc}>{chart.description}</p>}
      </div>
    )
  }

  if (chart.type === 'table') {
    return (
      <div className={styles.chartWrap}>
        <p className={styles.chartTitle}>{chart.title}</p>
        <table className={styles.dataTable}>
          <tbody>
            {chart.data.map((row,i)=>(
              <tr key={i}>
                <td className={styles.tdLabel}>{row.label}</td>
                <td className={styles.tdValue}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {chart.description&&<p className={styles.chartDesc}>{chart.description}</p>}
      </div>
    )
  }

  // Bar / line — horizontal bars
  const max = Math.max(...chart.data.map(d => d.value || 0))
  return (
    <div className={styles.chartWrap}>
      <p className={styles.chartTitle}>{chart.title}</p>
      <div className={styles.barChart}>
        {chart.data.map((d,i)=>(
          <div key={i} className={styles.barRow}>
            <span className={styles.barLabel}>{d.label}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{width:`${(d.value/max)*100}%`}}/>
            </div>
            <span className={styles.barVal}>{d.value}</span>
          </div>
        ))}
      </div>
      {chart.description&&<p className={styles.chartDesc}>{chart.description}</p>}
    </div>
  )
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score, reason }: { score: number; reason?: string }) {
  const color = score >= 8 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444'
  const label = score >= 8 ? 'Recommended' : score >= 5 ? 'Consider' : 'Low priority'
  return (
    <div className={styles.scoreBadge}>
      <span className={styles.scoreNum} style={{color}}>{score}/10</span>
      <span className={styles.scoreLabel} style={{color}}>{label}</span>
      {reason&&<span className={styles.scoreReason}>{reason}</span>}
    </div>
  )
}

// ── Image strip (Unsplash free tier) ─────────────────────────────────────────

function ImageStrip({ queries }: { queries: string[] }) {
  if (!queries?.length) return null
  return (
    <div className={styles.imageStrip}>
      {queries.slice(0,3).map((q,i)=>(
        <div key={i} className={styles.imageCell}>
          <img
            src={`https://source.unsplash.com/featured/400x220?${encodeURIComponent(q)}&sig=${i}`}
            alt={q}
            className={styles.cardImage}
            onError={e=>{(e.target as HTMLImageElement).style.display='none'}}
          />
          <span className={styles.imageCaption}>{q}</span>
        </div>
      ))}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  card:         any   // SearchCard | LlmCard | FileCardData — all share the fields we need
  query?:       string
  onClose:      () => void
  onToggleDoc:  () => void
}

// ── Main component ────────────────────────────────────────────────────────────

export function CardExpandOverlay({ card, query = '', onClose, onToggleDoc }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const [enrichStatus,  setEnrichStatus]  = useState<'loading'|'done'|'error'>('loading')
  const [enrichment,    setEnrichment]    = useState<Enrichment|null>(null)
  const [enrichError,   setEnrichError]   = useState('')

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Fire enrichment on open
  useEffect(() => {
    if (!card) return
    setEnrichStatus('loading')
    setEnrichment(null)
    setEnrichError('')

    fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardTitle:   card.title,
        cardSnippet: card.snippet,
        cardUrl:     card.source || card.url || '',
        cardType:    card.type,
        query,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setEnrichError(data.error); setEnrichStatus('error') }
        else            { setEnrichment(data);          setEnrichStatus('done')  }
      })
      .catch(err => { setEnrichError(String(err)); setEnrichStatus('error') })
  }, [card?.id])

  if (!card) return null

  const typeIcon: Record<string,string> = {
    article:'📄', video:'▶', image:'🖼', file:'📁',
    news:'📰', forum:'💬', shopping:'🛒', llm:'✦', math:'∑',
  }

  const isSelected = card.docSelected

  return (
    <div
      ref={backdropRef}
      className={styles.backdrop}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      role="dialog" aria-modal="true"
    >
      <div className={styles.panel}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.typeBadge}>
              {typeIcon[card.type] ?? '•'} {card.type ?? 'result'}
            </span>
            {(card.tags ?? []).slice(0,3).map((t:string) => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div className={styles.body}>

          {/* Original card content — always at top */}
          <div className={styles.originalSection}>
            <h2 className={styles.cardTitle}>{card.title}</h2>
            {(card.source || card.url) && (
              <a
                href={card.source || card.url}
                target="_blank" rel="noopener noreferrer"
                className={styles.sourceLink}
              >
                {card.source || card.url}
              </a>
            )}
            <p className={styles.snippetText}>{card.snippet}</p>

            {/* Steps (LLM / File cards) */}
            {card.steps?.length > 0 && (
              <ol className={styles.stepList}>
                {card.steps.map((s:string, i:number) => (
                  <li key={i} className={styles.stepItem}>{s}</li>
                ))}
              </ol>
            )}

            {/* Math */}
            {card.math && (
              <div className={styles.mathBlock}>
                <code>{card.math}</code>
              </div>
            )}
          </div>

          {/* ── Enrichment zone ── */}
          <div className={styles.enrichZone}>
            <div className={styles.enrichDivider}>
              <span className={styles.snbLabel}>✦ SnB Enrichment</span>
            </div>

            {enrichStatus === 'loading' && (
              <div className={styles.loadingState}>
                <div className={styles.spinner}/>
                <div className={styles.loadingLines}>
                  <span>Enriching content…</span>
                  <span>Sourcing images…</span>
                  <span>Checking for data…</span>
                </div>
              </div>
            )}

            {enrichStatus === 'error' && (
              <div className={styles.errorState}>
                <span>⚠ Enrichment unavailable: {enrichError}</span>
              </div>
            )}

            {enrichStatus === 'done' && enrichment && (
              <>
                {/* Relevance + score row */}
                <div className={styles.relevanceRow}>
                  {enrichment.relevanceNote && (
                    <p className={styles.relevanceNote}>{enrichment.relevanceNote}</p>
                  )}
                  {enrichment.recommendationScore != null && (
                    <ScoreBadge
                      score={enrichment.recommendationScore}
                      reason={enrichment.recommendationReason}
                    />
                  )}
                </div>

                {/* Images */}
                <ImageStrip queries={enrichment.imageQueries}/>

                {/* Paragraphs */}
                <div className={styles.paragraphs}>
                  {enrichment.paragraphs.map((p,i) => (
                    <p key={i} className={styles.para}>{p}</p>
                  ))}
                </div>

                {/* Chart */}
                {enrichment.chart && <MiniChart chart={enrichment.chart}/>}

                {/* Citations */}
                {enrichment.citations?.length > 0 && (
                  <div className={styles.citations}>
                    <p className={styles.citationsLabel}>Sources</p>
                    <ul className={styles.citationList}>
                      {enrichment.citations.map((c,i) => (
                        <li key={i}>
                          {c.url
                            ? <a href={c.url} target="_blank" rel="noopener noreferrer" className={styles.citationLink}>{c.label||c.url}</a>
                            : <span className={styles.citationText}>{c.label}</span>
                          }
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <button
            className={`${styles.docBtn} ${isSelected ? styles.docBtnSelected : ''}`}
            onClick={onToggleDoc}
          >
            {isSelected ? '✓ Selected for Publishing' : '+ Add to Document'}
          </button>
          {enrichStatus === 'done' && (
            <span className={styles.enrichedBadge}>✦ AI Enriched</span>
          )}
          {(card.source || card.url) && (
            <a
              href={card.source || card.url}
              target="_blank" rel="noopener noreferrer"
              className={styles.visitBtn}
            >
              Visit source ↗
            </a>
          )}
        </div>

      </div>
    </div>
  )
}
