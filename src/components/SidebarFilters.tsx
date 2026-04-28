import { useState, useEffect } from 'react'
import type { SidebarFilterSection } from '../types'
import styles from './SidebarFilters.module.css'

interface Props {
  sections: SidebarFilterSection[]
  onRefine: (values: Record<string, unknown>) => void
  isSearching: boolean
}

export function SidebarFilters({ sections, onRefine, isSearching }: Props) {
  const [values,    setValues]    = useState<Record<string, unknown>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => { setValues({}) }, [sections])

  function toggleSection(id: string) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function setCheck(sectionId: string, option: string, checked: boolean) {
    setValues(prev => {
      const current = (prev[sectionId] as Record<string, boolean>) || {}
      return { ...prev, [sectionId]: { ...current, [option]: checked } }
    })
  }

  function setRadio(sectionId: string, value: string) {
    setValues(prev => ({ ...prev, [sectionId]: value }))
  }

  function setSelect(sectionId: string, value: string) {
    setValues(prev => ({ ...prev, [sectionId]: value }))
  }

  function setRange(sectionId: string, which: 'min' | 'max', value: string) {
    setValues(prev => {
      const current = (prev[sectionId] as { min?: string; max?: string }) || {}
      return { ...prev, [sectionId]: { ...current, [which]: value } }
    })
  }

  function handleApply() { onRefine(values) }

  function handleReset() { setValues({}); onRefine({}) }

  const hasAnyValue = Object.values(values).some(v => {
    if (!v) return false
    if (typeof v === 'object') return Object.values(v as object).some(Boolean)
    return true
  })

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Refine results</span>
        {hasAnyValue && (
          <button className={styles.resetBtn} onClick={handleReset}>Clear all</button>
        )}
      </div>

      {/* Always-visible body — shows state, filters, or loading */}
      <div className={styles.body}>
        {isSearching ? (
          <div className={styles.statusArea}>
            <div className={styles.spinner} />
            <span className={styles.statusText}>Building filters…</span>
          </div>
        ) : sections.length === 0 ? (
          <div className={styles.statusArea}>
            <span className={styles.emptyIcon}>⊞</span>
            <span className={styles.statusText}>Search to see<br/>dynamic filters</span>
          </div>
        ) : (
          <>
            <div className={styles.sections}>
              {sections.map(section => {
                const isCollapsed = collapsed[section.id]
                return (
                  <div key={section.id} className={styles.section}>
                    <button className={styles.sectionHeader} onClick={() => toggleSection(section.id)}>
                      <span className={styles.sectionLabel}>{section.label}</span>
                      <svg
                        className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ''}`}
                        width="12" height="12" viewBox="0 0 12 12" fill="none"
                        stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 4.5L6 7.5L9 4.5"/>
                      </svg>
                    </button>

                    {!isCollapsed && (
                      <div className={styles.sectionBody}>
                        {section.type === 'checkboxes' && section.options?.map(opt => (
                          <label key={opt} className={styles.checkItem}>
                            <input
                              type="checkbox"
                              checked={!!((values[section.id] as Record<string, boolean>)?.[opt])}
                              onChange={e => setCheck(section.id, opt, e.target.checked)}
                              className={styles.checkbox}
                            />
                            <span className={styles.checkLabel}>{opt}</span>
                          </label>
                        ))}

                        {section.type === 'radio' && section.options?.map(opt => (
                          <label key={opt} className={styles.checkItem}>
                            <input
                              type="radio"
                              name={section.id}
                              checked={values[section.id] === opt}
                              onChange={() => setRadio(section.id, opt)}
                              className={styles.checkbox}
                            />
                            <span className={styles.checkLabel}>{opt}</span>
                          </label>
                        ))}

                        {section.type === 'select' && section.options && (
                          <select
                            className={styles.select}
                            value={(values[section.id] as string) || ''}
                            onChange={e => setSelect(section.id, e.target.value)}
                          >
                            <option value="">Any</option>
                            {section.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {section.type === 'range' && (
                          <div className={styles.rangeRow}>
                            <input
                              type="number"
                              className={styles.rangeInput}
                              placeholder={`Min${section.unit ? ` (${section.unit})` : ''}`}
                              value={((values[section.id] as { min?: string })?.min) || ''}
                              onChange={e => setRange(section.id, 'min', e.target.value)}
                            />
                            <span className={styles.rangeSep}>–</span>
                            <input
                              type="number"
                              className={styles.rangeInput}
                              placeholder={`Max${section.unit ? ` (${section.unit})` : ''}`}
                              value={((values[section.id] as { max?: string })?.max) || ''}
                              onChange={e => setRange(section.id, 'max', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <button className={styles.applyBtn} onClick={handleApply}>
              Apply filters
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
