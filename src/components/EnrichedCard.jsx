// src/components/EnrichedCard.jsx
// Expanded card UI with on-demand AI enrichment.
// Drop this into your existing card grid — call it when user clicks "Expand".

import { useState, useEffect } from 'react'
import styles from './EnrichedCard.module.css'

/* ─── Mini chart renderer (no external deps) ─────────────────────────── */
function MiniChart({ chart }) {
  if (!chart || !Array.isArray(chart.data) || chart.data.length === 0) return null

  if (chart.type === 'table') {
    return (
      <div className={styles.chartWrap}>
        <p className={styles.chartTitle}>{chart.title}</p>
        <table className={styles.dataTable}>
          <tbody>
            {chart.data.map((row, i) => (
              <tr key={i}>
                <td className={styles.tdLabel}>{row.label}</td>
                <td className={styles.tdValue}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {chart.description && <p className={styles.chartDesc}>{chart.description}</p>}
      </div>
    )
  }

  if (chart.type === 'pie') {
    const total = chart.data.reduce((s, d) => s + (d.value || 0), 0)
    const COLORS = ['#4f9cf9', '#f9a24f', '#4fd9a2', '#f94f7c', '#b44ff9', '#f9f04f']
    let cumAngle = -Math.PI / 2
    const slices = chart.data.map((d, i) => {
      const angle = (d.value / total) * 2 * Math.PI
      const x1 = 80 + 70 * Math.cos(cumAngle)
      const y1 = 80 + 70 * Math.sin(cumAngle)
      cumAngle += angle
      const x2 = 80 + 70 * Math.cos(cumAngle)
      const y2 = 80 + 70 * Math.sin(cumAngle)
      const large = angle > Math.PI ? 1 : 0
      return { d: `M80,80 L${x1},${y1} A70,70 0 ${large},1 ${x2},${y2} Z`, color: COLORS[i % COLORS.length], label: d.label, pct: Math.round((d.value / total) * 100) }
    })
    return (
      <div className={styles.chartWrap}>
        <p className={styles.chartTitle}>{chart.title}</p>
        <div className={styles.pieGrid}>
          <svg viewBox="0 0 160 160" width="160" height="160">
            {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth="2" />)}
          </svg>
          <ul className={styles.pieLegend}>
            {slices.map((s, i) => (
              <li key={i} className={styles.pieLegendItem}>
                <span className={styles.pieDot} style={{ background: s.color }} />
                {s.label} — {s.pct}%
              </li>
            ))}
          </ul>
        </div>
        {chart.description && <p className={styles.chartDesc}>{chart.description}</p>}
      </div>
    )
  }

  // Bar / Line — rendered as horizontal bars (works without canvas)
  const max = Math.max(...chart.data.map(d => d.value || 0))
  return (
    <div className={styles.chartWrap}>
      <p className={styles.chartTitle}>{chart.title}</p>
      <div className={styles.barChart}>
        {chart.data.map((d, i) => (
          <div key={i} className={styles.barRow}>
            <span className={styles.barLabel}>{d.label}</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </div>
            <span className={styles.barVal}>{d.value}</span>
          </div>
        ))}
      </div>
      {chart.description && <p className={styles.chartDesc}>{chart.description}</p>}
    </div>
  )
}

/* ─── Score badge ─────────────────────────────────────────────────────── */
function ScoreBadge({ score, reason }) {
  if (!score) return null
  const color = score >= 8 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444'
  const label = score >= 8 ? 'Recommended' : score >= 5 ? 'Consider' : 'Low priority'
  return (
    <div className={styles.scoreBadge} style={{ '--score-color': color }}>
      <span className={styles.scoreNum}>{score}/10</span>
      <span className={styles.scoreLabel}>{label}</span>
      {reason && <span className={styles.scoreReason}>{reason}</span>}
    </div>
  )
}

/* ─── Image strip ─────────────────────────────────────────────────────── */
function ImageStrip({ queries }) {
  // Uses Unsplash Source (free, no key needed) for demo-quality images
  if (!queries || queries.length === 0) return null
  return (
    <div className={styles.imageStrip}>
      {queries.slice(0, 3).map((q, i) => {
        const seed = encodeURIComponent(q)
        const src = `https://source.unsplash.com/featured/400x220?${seed}&sig=${i}`
        return (
          <div key={i} className={styles.imageCell}>
            <img
              src={src}
              alt={q}
              className={styles.cardImage}
              onError={e => { e.target.style.display = 'none' }}
            />
            <span className={styles.imageCaption}>{q}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Main EnrichedCard ───────────────────────────────────────────────── */
export function EnrichedCard({ card, query, isSelected, onToggleSelect, onClose }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [enrichment, setEnrichment] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!card) return
    setStatus('loading')
    setEnrichment(null)
    setErrorMsg('')

    fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardTitle: card.title,
        cardSnippet: card.snippet,
        cardUrl: card.url,
        cardType: card.type,
        query,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setErrorMsg(data.error)
          setStatus('error')
        } else {
          setEnrichment(data)
          setStatus('done')
        }
      })
      .catch(err => {
        setErrorMsg(String(err))
        setStatus('error')
      })
  }, [card?.id])

  if (!card) return null

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={styles.panel}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <span className={styles.typeTag}>{card.type || 'article'}</span>
            {card.tags?.slice(0, 3).map(t => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>

          {/* ── Original card content (always visible) ── */}
          <div className={styles.original}>
            <h2 className={styles.cardTitle}>{card.title}</h2>
            {card.url && (
              <a className={styles.sourceLink} href={card.url} target="_blank" rel="noopener noreferrer">
                {card.url}
              </a>
            )}
            <p className={styles.snippet}>{card.snippet}</p>
          </div>

          {/* ── Enrichment zone ── */}
          <div className={styles.enrichZone}>
            {status === 'loading' && (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <div className={styles.loadingLines}>
                  <span>Enriching content…</span>
                  <span>Sourcing images…</span>
                  <span>Checking for data…</span>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className={styles.errorState}>
                <span className={styles.errorIcon}>⚠</span>
                <span>Enrichment failed: {errorMsg}</span>
              </div>
            )}

            {status === 'done' && enrichment && (
              <>
                {/* Relevance note + score */}
                <div className={styles.relevanceRow}>
                  {enrichment.relevanceNote && (
                    <p className={styles.relevanceNote}>
                      <span className={styles.snbBadge}>SnB</span>
                      {enrichment.relevanceNote}
                    </p>
                  )}
                  <ScoreBadge
                    score={enrichment.recommendationScore}
                    reason={enrichment.recommendationReason}
                  />
                </div>

                {/* Images */}
                <ImageStrip queries={enrichment.imageQueries} />

                {/* Paragraphs */}
                <div className={styles.paragraphs}>
                  {enrichment.paragraphs.map((p, i) => (
                    <p key={i} className={styles.para}>{p}</p>
                  ))}
                </div>

                {/* Chart */}
                <MiniChart chart={enrichment.chart} />

                {/* Citations */}
                {enrichment.citations?.length > 0 && (
                  <div className={styles.citations}>
                    <p className={styles.citationsLabel}>Sources</p>
                    <ul className={styles.citationList}>
                      {enrichment.citations.map((c, i) => (
                        <li key={i}>
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className={styles.citationLink}>
                              {c.label || c.url}
                            </a>
                          ) : (
                            <span className={styles.citationText}>{c.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className={styles.footer}>
          <button
            className={`${styles.selectBtn} ${isSelected ? styles.selected : ''}`}
            onClick={() => onToggleSelect?.(card.id)}
          >
            {isSelected ? '✓ Selected for Publishing' : '+ Add to Document'}
          </button>
          {status === 'done' && (
            <span className={styles.enrichedBadge}>✦ AI Enriched</span>
          )}
        </div>

      </div>
    </div>
  )
}
