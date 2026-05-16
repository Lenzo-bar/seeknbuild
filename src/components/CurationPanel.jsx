// src/components/CurationPanel.jsx
// Claude reviews all cards and recommends which to include, in what order,
// with section groupings and identified gaps.
// Show this when user enters "All Results" / publishing preparation mode.

import { useState } from 'react'
import styles from './CurationPanel.module.css'

export function CurationPanel({ cards, query, onApplyCuration, onClose }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [curation, setCuration] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [documentGoal, setDocumentGoal] = useState('')

  async function runCuration() {
    if (!cards || cards.length === 0) return
    setStatus('loading')
    setCuration(null)
    setErrorMsg('')

    try {
      const res = await fetch('/api/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, query, documentGoal }),
      })
      const data = await res.json()
      if (data.error) {
        setErrorMsg(data.error)
        setStatus('error')
      } else {
        setCuration(data)
        setStatus('done')
      }
    } catch (err) {
      setErrorMsg(String(err))
      setStatus('error')
    }
  }

  function handleApply() {
    if (!curation) return
    onApplyCuration?.({
      selectedIds: curation.selectedIds,
      orderedSections: curation.orderedSections,
      suggestedTitle: curation.suggestedTitle,
    })
    onClose?.()
  }

  // Find card by id for display
  const cardMap = Object.fromEntries((cards || []).map(c => [c.id, c]))

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={styles.panel}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.snbBadge}>SnB</span>
            <h2 className={styles.headerTitle}>AI Editorial Curation</h2>
            <span className={styles.cardCount}>{cards?.length || 0} cards</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>

          {/* Idle state — prompt to start */}
          {status === 'idle' && (
            <div className={styles.startSection}>
              <p className={styles.intro}>
                Claude will review all your search cards and recommend which ones to include in your document,
                suggest an editorial structure, and flag any gaps in coverage.
              </p>
              <div className={styles.goalRow}>
                <label className={styles.goalLabel} htmlFor="docGoal">
                  Document goal <span className={styles.optional}>(optional)</span>
                </label>
                <input
                  id="docGoal"
                  className={styles.goalInput}
                  placeholder="e.g. executive summary, investor pitch, research report…"
                  value={documentGoal}
                  onChange={e => setDocumentGoal(e.target.value)}
                />
              </div>
              <button className={styles.runBtn} onClick={runCuration}>
                ✦ Run AI Curation
              </button>
            </div>
          )}

          {/* Loading */}
          {status === 'loading' && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <div className={styles.loadingText}>
                <span>Reviewing {cards?.length} cards…</span>
                <span>Evaluating relevance and quality…</span>
                <span>Building editorial structure…</span>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className={styles.errorState}>
              <p>⚠ Curation failed: {errorMsg}</p>
              <button className={styles.retryBtn} onClick={() => setStatus('idle')}>Try Again</button>
            </div>
          )}

          {/* Done — show results */}
          {status === 'done' && curation && (
            <div className={styles.results}>

              {/* Editorial brief */}
              {curation.editorialBrief && (
                <div className={styles.brief}>
                  <p className={styles.briefLabel}>Editorial brief</p>
                  <p className={styles.briefText}>{curation.editorialBrief}</p>
                  {curation.suggestedTitle && (
                    <p className={styles.suggestedTitle}>
                      <span className={styles.suggestedTitleLabel}>Suggested title:</span>
                      {curation.suggestedTitle}
                    </p>
                  )}
                </div>
              )}

              {/* Stats row */}
              <div className={styles.statsRow}>
                <div className={styles.stat}>
                  <span className={styles.statNum} style={{ color: '#22c55e' }}>{curation.selectedIds?.length || 0}</span>
                  <span className={styles.statLabel}>Selected</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum} style={{ color: '#ef4444' }}>{curation.rejectedIds?.length || 0}</span>
                  <span className={styles.statLabel}>Rejected</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum} style={{ color: '#f59e0b' }}>{curation.gaps?.length || 0}</span>
                  <span className={styles.statLabel}>Gaps found</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{curation.orderedSections?.length || 0}</span>
                  <span className={styles.statLabel}>Sections</span>
                </div>
              </div>

              {/* Ordered sections */}
              {curation.orderedSections?.length > 0 && (
                <div className={styles.sections}>
                  <p className={styles.sectionGroupLabel}>Proposed document structure</p>
                  {curation.orderedSections.map((section, si) => (
                    <div key={si} className={styles.sectionBlock}>
                      <div className={styles.sectionHeader}>
                        <span className={styles.sectionNum}>{si + 1}</span>
                        <span className={styles.sectionTitle}>{section.sectionTitle}</span>
                      </div>
                      {section.rationale && (
                        <p className={styles.sectionRationale}>{section.rationale}</p>
                      )}
                      <div className={styles.sectionCards}>
                        {(section.cardIds || []).map(id => {
                          const c = cardMap[id]
                          return c ? (
                            <div key={id} className={styles.sectionCard}>
                              <span className={styles.sectionCardIcon}>📄</span>
                              <span className={styles.sectionCardTitle}>{c.title}</span>
                            </div>
                          ) : null
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Rejected cards */}
              {curation.rejectedIds?.length > 0 && (
                <div className={styles.rejected}>
                  <p className={styles.rejectedLabel}>Not recommended</p>
                  {curation.rejectedIds.map(({ id, reason }) => {
                    const c = cardMap[id]
                    return c ? (
                      <div key={id} className={styles.rejectedCard}>
                        <span className={styles.rejectedTitle}>{c.title}</span>
                        <span className={styles.rejectedReason}>{reason}</span>
                      </div>
                    ) : null
                  })}
                </div>
              )}

              {/* Content gaps */}
              {curation.gaps?.length > 0 && (
                <div className={styles.gaps}>
                  <p className={styles.gapsLabel}>Coverage gaps — consider searching for:</p>
                  <ul className={styles.gapsList}>
                    {curation.gaps.map((gap, i) => (
                      <li key={i} className={styles.gapItem}>
                        <span className={styles.gapIcon}>→</span>
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {status === 'done' && (
            <>
              <button className={styles.rerunBtn} onClick={() => setStatus('idle')}>
                ↺ Re-run
              </button>
              <button className={styles.applyBtn} onClick={handleApply}>
                Apply Curation & Go to Publisher →
              </button>
            </>
          )}
          {status === 'idle' && (
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          )}
        </div>

      </div>
    </div>
  )
}
