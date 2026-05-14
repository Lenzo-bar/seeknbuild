import { useState, useEffect } from 'react'
import type { FilterCategory, ActiveFilterChip } from '../types'
import type { SidebarFilterSection } from '../types'
import { ACADEMIA_LEVELS, ACADEMIA_PRIMARIES, ACADEMIA_SECONDARY_A, ACADEMIA_SECONDARY_B, BUYING_SELLING_FILTERS, getFilterCategory } from '../data/filterCategories'
import styles from './SidebarFilters.module.css'

// Section IDs that are location-related (only these reset on location change)
const LOCATION_SECTION_IDS = new Set(['region', 'city', 'location', 'area', 'zone', 'neighborhood', 'district'])

interface Props {
  category:           FilterCategory
  topic:              string
  sections:           SidebarFilterSection[]
  isFirstSearch:      boolean   // true only during the very first search — shows skeleton
  resetKey:           number    // full reset — wipes everything (fresh search only)
  locationRefreshKey: number
  removedChipId:      string | null
  onRefine:           (chips: ActiveFilterChip[]) => void
  onApply:            (chips: ActiveFilterChip[]) => void
}

// ── Skeleton loaders ──────────────────────────────────────────────
function SkeletonBuying() {
  return (
    <div className={styles.skeleton}>
      {[1,2,3,4].map(i => (
        <div key={i} className={styles.skelSection}>
          <div className={`${styles.skelLine} ${styles.skelTitle}`} />
          {[1,2,3].map(j => (
            <div key={j} className={styles.skelRow}>
              <div className={styles.skelCheck} />
              <div className={`${styles.skelLine} ${styles.skelLabel}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function SkeletonAcademia() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skelSection}>
        <div className={`${styles.skelLine} ${styles.skelTitle}`} />
        {Array.from({length:10}).map((_,i) => (
          <div key={i} className={styles.skelRow}>
            <div className={styles.skelCheck} />
            <div className={`${styles.skelLine} ${styles.skelLabel}`} style={{width:`${55+Math.random()*35}%`}} />
          </div>
        ))}
      </div>
      <div className={styles.skelSection}>
        <div className={`${styles.skelLine} ${styles.skelTitle}`} />
        <div className={styles.skelDropdown} />
      </div>
      <div className={styles.skelSection}>
        <div className={`${styles.skelLine} ${styles.skelTitle}`} />
        <div className={styles.skelDropdown} />
      </div>
    </div>
  )
}

// ── Academia helpers ──────────────────────────────────────────────
function buildAcademiaChips(
  checks: Record<string,boolean>, level: string, secA: string, secB: string
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []
  Object.entries(checks).forEach(([label, on]) => {
    if (on) chips.push({ id: `ck-${label}`, label, value: label, category: 'academia' })
  })
  if (level) chips.push({ id: 'level', label: 'Level',     value: level, category: 'academia' })
  if (secA)  chips.push({ id: 'secA',  label: 'Sub-topic', value: secA,  category: 'academia' })
  if (secB)  chips.push({ id: 'secB',  label: 'Format',    value: secB,  category: 'academia' })
  return chips
}

// ── Academia panel ────────────────────────────────────────────────
function AcademiaPanel({ topic, onChipsChange, removedChipId, onApply, resetKey }: {
  topic: string
  removedChipId: string | null
  resetKey: number
  onChipsChange: (chips: ActiveFilterChip[]) => void
  onApply: (chips: ActiveFilterChip[]) => void
}) {
  const key = Object.keys(ACADEMIA_PRIMARIES).find(k => topic.includes(k)) || 'default'
  const primaries  = ACADEMIA_PRIMARIES[key]
  const secondaryA = ACADEMIA_SECONDARY_A[key] || ACADEMIA_SECONDARY_A.default
  const secondaryB = ACADEMIA_SECONDARY_B[key] || ACADEMIA_SECONDARY_B.default

  const [checks, setChecks] = useState<Record<string,boolean>>({})
  const [level,  setLevel]  = useState('')
  const [secA,   setSecA]   = useState('')
  const [secB,   setSecB]   = useState('')

  // Full wipe on fresh search (resetKey bump) or topic change
  useEffect(() => { setChecks({}); setLevel(''); setSecA(''); setSecB('') }, [resetKey, topic])

  useEffect(() => {
    if (!removedChipId) return
    if (removedChipId === 'level') { setLevel(''); return }
    if (removedChipId === 'secA')  { setSecA('');  return }
    if (removedChipId === 'secB')  { setSecB('');  return }
    if (removedChipId.startsWith('ck-')) {
      const label = removedChipId.slice(3)
      setChecks(prev => ({ ...prev, [label]: false }))
    }
  }, [removedChipId])

  useEffect(() => {
    onChipsChange(buildAcademiaChips(checks, level, secA, secB))
  }, [checks, level, secA, secB, onChipsChange])

  const hasPending = Object.values(checks).some(Boolean) || !!level || !!secA || !!secB

  return (
    <div className={styles.body}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Primary filters</div>
        <div className={styles.sectionBody}>
          {primaries.map(p => (
            <label key={p} className={styles.checkItem}>
              <input type="checkbox" className={styles.checkbox}
                checked={!!checks[p]} onChange={() => setChecks(prev => ({ ...prev, [p]: !prev[p] }))} />
              <span className={styles.checkLabel}>{p}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Learner level</div>
        <div className={styles.sectionBody}>
          <select className={styles.select} value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">Any level</option>
            {ACADEMIA_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Sub-topic</div>
        <div className={styles.sectionBody}>
          <select className={styles.select} value={secA} onChange={e => setSecA(e.target.value)}>
            <option value="">Any sub-topic</option>
            {secondaryA.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Format / type</div>
        <div className={styles.sectionBody}>
          <select className={styles.select} value={secB} onChange={e => setSecB(e.target.value)}>
            <option value="">Any format</option>
            {secondaryB.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <button
        className={styles.applyBtn}
        onClick={() => onApply(buildAcademiaChips(checks, level, secA, secB))}
      >
        {hasPending ? '✓ Apply filters' : '↩ Revert to previous results'}
      </button>
    </div>
  )
}

// ── Buying/Selling panel ──────────────────────────────────────────
function BuyingSellingPanel({ topic, sections, onChipsChange, removedChipId, onApply, locationRefreshKey, resetKey }: {
  topic:              string
  sections:           SidebarFilterSection[]
  removedChipId:      string | null
  locationRefreshKey: number
  resetKey:           number
  onChipsChange:      (chips: ActiveFilterChip[]) => void
  onApply:            (chips: ActiveFilterChip[]) => void
}) {
  const topicKey = Object.keys(BUYING_SELLING_FILTERS).find(k => topic.includes(k)) || 'general'
  const displaySections = sections.length > 0 ? sections : BUYING_SELLING_FILTERS[topicKey] || BUYING_SELLING_FILTERS.general
  const [values,    setValues]    = useState<Record<string, unknown>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Full reset on fresh search (resetKey bump) or topic change
  useEffect(() => { setValues({}) }, [resetKey, topic])

  // Partial reset: only clear location-related section values when location changes
  useEffect(() => {
    if (locationRefreshKey === 0) return
    setValues(prev => {
      const next = { ...prev }
      displaySections.forEach(sec => {
        if (LOCATION_SECTION_IDS.has(sec.id)) {
          delete next[sec.id]
        }
      })
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationRefreshKey])

  // Sync when chip is individually removed
  useEffect(() => {
    if (!removedChipId) return
    setValues(prev => {
      const next = { ...prev }
      if (next[removedChipId] !== undefined) {
        delete next[removedChipId]
        return next
      }
      const dashIdx = removedChipId.lastIndexOf('-')
      if (dashIdx > 0) {
        const secId = removedChipId.slice(0, dashIdx)
        const opt   = removedChipId.slice(dashIdx + 1)
        if (next[secId] && typeof next[secId] === 'object') {
          next[secId] = { ...(next[secId] as Record<string,boolean>), [opt]: false }
          return next
        }
      }
      return prev
    })
  }, [removedChipId])

  function buildChips(): ActiveFilterChip[] {
    const chips: ActiveFilterChip[] = []
    displaySections.forEach(sec => {
      const v = values[sec.id]
      if (!v) return
      if (sec.type === 'checkboxes' && typeof v === 'object') {
        Object.entries(v as Record<string,boolean>).forEach(([opt, on]) => {
          if (on) chips.push({ id: `${sec.id}-${opt}`, label: sec.label, value: opt, category: 'buying-selling' })
        })
      } else if (sec.type === 'radio' || sec.type === 'select') {
        if (v) chips.push({ id: sec.id, label: sec.label, value: String(v), category: 'buying-selling' })
      } else if (sec.type === 'range') {
        const r = v as { min?: string; max?: string }
        if (r.min || r.max) {
          const val = [r.min && `${sec.unit||''}${r.min}`, r.max && `${sec.unit||''}${r.max}`].filter(Boolean).join(' – ')
          chips.push({ id: sec.id, label: sec.label, value: val, category: 'buying-selling' })
        }
      }
    })
    return chips
  }

  useEffect(() => {
    onChipsChange(buildChips())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, displaySections])

  function setCheck(secId: string, opt: string, checked: boolean) {
    setValues(prev => ({ ...prev, [secId]: { ...((prev[secId] as Record<string,boolean>) || {}), [opt]: checked } }))
  }
  function setRadio(secId: string, val: string)  { setValues(prev => ({ ...prev, [secId]: val })) }
  function setSelect(secId: string, val: string) { setValues(prev => ({ ...prev, [secId]: val })) }
  function setRange(secId: string, which: 'min'|'max', val: string) {
    setValues(prev => ({ ...prev, [secId]: { ...((prev[secId] as Record<string,string>) || {}), [which]: val } }))
  }

  const hasPending = buildChips().length > 0

  return (
    <div className={styles.body}>
      {displaySections.map(sec => {
        const isLocationSec = LOCATION_SECTION_IDS.has(sec.id)
        return (
          <div key={sec.id} className={styles.section}>
            <button className={styles.sectionHeader}
              onClick={() => setCollapsed(p => ({ ...p, [sec.id]: !p[sec.id] }))}>
              <span className={styles.sectionLabel}>
                {sec.label}
                {/* Small indicator on location sections so user can see they're location-aware */}
                {isLocationSec && <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--teal)', fontWeight: 500 }}>📍</span>}
              </span>
              <svg className={`${styles.chevron} ${collapsed[sec.id] ? styles.chevronCollapsed : ''}`}
                width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 4.5L6 7.5L9 4.5"/>
              </svg>
            </button>

            {!collapsed[sec.id] && (
              <div className={styles.sectionBody}>
                {sec.type === 'checkboxes' && sec.options?.map(opt => (
                  <label key={opt} className={styles.checkItem}>
                    <input type="checkbox" className={styles.checkbox}
                      checked={!!((values[sec.id] as Record<string,boolean>)?.[opt])}
                      onChange={e => setCheck(sec.id, opt, e.target.checked)} />
                    <span className={styles.checkLabel}>{opt}</span>
                  </label>
                ))}
                {sec.type === 'radio' && sec.options?.map(opt => (
                  <label key={opt} className={styles.checkItem}>
                    <input type="radio" name={sec.id} className={styles.checkbox}
                      checked={values[sec.id] === opt}
                      onChange={() => setRadio(sec.id, opt)} />
                    <span className={styles.checkLabel}>{opt}</span>
                  </label>
                ))}
                {sec.type === 'select' && (
                  <select className={styles.select} value={(values[sec.id] as string) || ''}
                    onChange={e => setSelect(sec.id, e.target.value)}>
                    <option value="">Any</option>
                    {sec.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                {sec.type === 'range' && (
                  <div className={styles.rangeRow}>
                    <input type="number" className={styles.rangeInput}
                      placeholder={`Min${sec.unit ? ` (${sec.unit})` : ''}`}
                      value={((values[sec.id] as {min?:string})?.min) || ''}
                      onChange={e => setRange(sec.id, 'min', e.target.value)} />
                    <span className={styles.rangeSep}>–</span>
                    <input type="number" className={styles.rangeInput}
                      placeholder={`Max${sec.unit ? ` (${sec.unit})` : ''}`}
                      value={((values[sec.id] as {max?:string})?.max) || ''}
                      onChange={e => setRange(sec.id, 'max', e.target.value)} />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button
        className={styles.applyBtn}
        onClick={() => onApply(buildChips())}
      >
        {hasPending ? '✓ Apply filters' : '↩ Revert to previous results'}
      </button>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────
export function SidebarFilters({
  category, topic, sections, isFirstSearch,
  resetKey, locationRefreshKey, removedChipId, onRefine, onApply
}: Props) {
  const [chips, setChips] = useState<ActiveFilterChip[]>([])

  // Only wipe chips display on full reset
  useEffect(() => { setChips([]) }, [resetKey])

  function handleChips(incoming: ActiveFilterChip[]) {
    setChips(incoming)
    onRefine(incoming)
  }

  const hasAny = chips.length > 0

  return (
    <aside className={styles.sidebar}
      onMouseEnter={e => e.currentTarget.querySelector(`.${styles.body}`)?.classList.add(styles.scrollVisible)}
      onMouseLeave={e => e.currentTarget.querySelector(`.${styles.body}`)?.classList.remove(styles.scrollVisible)}
    >
      <div className={styles.header}>
        <span className={styles.headerTitle}>Refine results</span>
        <span className={styles.categoryBadge}>
          {category === 'academia' ? '🎓 Academia' : category === 'buying-selling' ? '🛒 Buy / Sell' : '🔍 General'}
        </span>
        {hasAny && (
          <button className={styles.resetBtn} onClick={() => { setChips([]); onRefine([]) }}>Clear</button>
        )}
      </div>

      {/* Skeleton only on the very first search — never during same-context re-searches */}
      {isFirstSearch ? (
        category === 'academia' ? <SkeletonAcademia /> : <SkeletonBuying />
      ) : category === 'academia' ? (
        <AcademiaPanel
          topic={topic}
          resetKey={resetKey}
          removedChipId={removedChipId}
          onChipsChange={handleChips}
          onApply={onApply}
        />
      ) : (
        <BuyingSellingPanel
          topic={topic}
          sections={sections}
          resetKey={resetKey}
          removedChipId={removedChipId}
          locationRefreshKey={locationRefreshKey}
          onChipsChange={handleChips}
          onApply={onApply}
        />
      )}
    </aside>
  )
}
