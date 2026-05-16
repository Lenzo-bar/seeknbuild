import { useState, useRef, useEffect } from 'react'
import type { SearchCard } from '../types'
import styles from './SummaryBanner.module.css'

// ── Icon map — Tabler icon names for weather conditions ──────────────────────
const CONDITION_ICONS: Record<string, string> = {
  sun:        '☀️',  sunny:       '☀️',
  'cloud-sun':'⛅',  'partly cloudy':'⛅', 'partly sunny':'⛅',
  cloud:      '☁️',  cloudy:      '☁️',
  'cloud-rain':'🌧️', rain:        '🌧️', rainy: '🌧️',
  snowflake:  '❄️',  snow:        '❄️', snowy: '❄️',
  'cloud-bolt':'⛈️', storm:       '⛈️', thunder: '⛈️',
  wind:       '💨',  fog:         '🌫️', mist: '🌫️',
  hot:        '🔥',  warm:        '🌤️',  mild: '🌡️', cool: '🧊', cold: '❄️',
}

function resolveIcon(condition: string): string {
  const key = condition.toLowerCase().trim()
  // direct match
  if (CONDITION_ICONS[key]) return CONDITION_ICONS[key]
  // partial match
  for (const [k, v] of Object.entries(CONDITION_ICONS)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return '📋'
}

// ── Chip colour based on feel/season ────────────────────────────────────────
function feelChip(feel: string): { bg: string; color: string } {
  const f = feel.toLowerCase()
  if (/hot|very warm/.test(f))   return { bg: '#FAEEDA', color: '#633806' }
  if (/warm/.test(f))            return { bg: '#FEF3C7', color: '#92400E' }
  if (/mild/.test(f))            return { bg: '#DCFCE7', color: '#166534' }
  if (/cool|cold|freezing/.test(f)) return { bg: '#E6F1FB', color: '#0C447C' }
  return { bg: 'var(--surface-2)', color: 'var(--text-2)' }
}

// ── Types ────────────────────────────────────────────────────────────────────
interface SummaryTableData {
  headers: string[]
  rows: string[][]
  icons?: Record<string, string>   // condition string → icon key
}

interface Props {
  card:          SearchCard
  summaryTable?: SummaryTableData | null
  onExpand:      () => void
  onDismiss:     () => void
  onToggleDoc:   () => void
}

export function SummaryBanner({ card, summaryTable, onExpand, onDismiss, onToggleDoc }: Props) {
  const [expanded,    setExpanded]    = useState(false)
  const [hasScroll,   setHasScroll]   = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  // Detect if content overflows the cap — show scroll indicator
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    setHasScroll(el.scrollHeight > el.clientHeight + 4)
  }, [card.snippet, summaryTable])

  const isUpdated = card.title.toLowerCase().includes('updated')

  return (
    <div className={`${styles.banner} ${expanded ? styles.bannerExpanded : ''}`}>

      {/* ── Header row ── */}
      <div className={styles.bannerHeader}>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>
            ✦ {isUpdated ? 'Summary (updated)' : 'Summary'}
          </span>
          {card.tags.filter(t => t.startsWith('📍')).map(t => (
            <span key={t} className={styles.queryTag}>{t}</span>
          ))}
        </div>
        <div className={styles.headerActions}>
          {hasScroll && !expanded && (
            <button
              className={styles.expandTextBtn}
              onClick={() => setExpanded(v => !v)}
              title="Expand summary"
            >
              ↕ scroll
            </button>
          )}
          {expanded && (
            <button
              className={styles.expandTextBtn}
              onClick={() => setExpanded(false)}
              title="Collapse"
            >
              ↑ collapse
            </button>
          )}
          <button className={styles.actionBtn} title="Expand card" onClick={onExpand}>⤢</button>
          <button className={`${styles.actionBtn} ${styles.closeBtn}`} title="Dismiss" onClick={onDismiss}>✕</button>
        </div>
      </div>

      {/* ── Summary text — scrollable, height-capped unless expanded ── */}
      <div
        ref={textRef}
        className={`${styles.summaryText} ${expanded ? styles.summaryTextExpanded : ''}`}
      >
        {card.snippet}
      </div>

      {/* ── Scroll fade indicator ── */}
      {hasScroll && !expanded && (
        <div className={styles.scrollFade} />
      )}

      {/* ── AI-generated comparison table ── */}
      {summaryTable && summaryTable.headers.length > 0 && summaryTable.rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {summaryTable.headers.map((h, i) => (
                  <th key={i} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryTable.rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? styles.trEven : styles.trOdd}>
                  {row.map((cell, ci) => {
                    // Detect condition/feel cells to render icon + chip
                    const isConditionCol = summaryTable.headers[ci]?.toLowerCase().includes('condition')
                    const isFeelCol      = summaryTable.headers[ci]?.toLowerCase().match(/feel|season|climate/)
                    const isHiCol        = summaryTable.headers[ci]?.toLowerCase().includes('high')
                    const isLoCol        = summaryTable.headers[ci]?.toLowerCase().includes('low')

                    if (isFeelCol) {
                      const { bg, color } = feelChip(cell)
                      return (
                        <td key={ci} className={styles.td}>
                          <span className={styles.feelChip} style={{ background: bg, color }}>
                            {cell}
                          </span>
                        </td>
                      )
                    }

                    if (isConditionCol) {
                      // look up icon from the icons map or resolve from string
                      const iconKey = summaryTable.icons?.[cell] || cell
                      const icon    = resolveIcon(iconKey)
                      return (
                        <td key={ci} className={styles.td}>
                          <span className={styles.conditionCell}>
                            <span className={styles.condIcon}>{icon}</span>
                            {cell}
                          </span>
                        </td>
                      )
                    }

                    if (isHiCol) {
                      return <td key={ci} className={`${styles.td} ${styles.hiTemp}`}>{cell}</td>
                    }
                    if (isLoCol) {
                      return <td key={ci} className={`${styles.td} ${styles.loTemp}`}>{cell}</td>
                    }

                    // First column — bold row label
                    if (ci === 0) {
                      return <td key={ci} className={`${styles.td} ${styles.tdLabel}`}>{cell}</td>
                    }

                    return <td key={ci} className={styles.td}>{cell}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer: doc checkbox ── */}
      <div className={styles.bannerFooter}>
        <input
          type="checkbox" id={`doc-${card.id}`}
          checked={card.docSelected} onChange={onToggleDoc}
          className={styles.docCheck}
        />
        <label htmlFor={`doc-${card.id}`} className={styles.docLabel}>include in doc</label>
      </div>
    </div>
  )
}
