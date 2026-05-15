import { useState, useEffect, useCallback } from 'react'
import type { FilterCategory, ActiveFilterChip } from '../types'
import type { SidebarFilterSection } from '../types'
import { ACADEMIA_LEVELS, ACADEMIA_PRIMARIES, ACADEMIA_SECONDARY_A, ACADEMIA_SECONDARY_B, BUYING_SELLING_FILTERS, getFilterCategory } from '../data/filterCategories'
import styles from './SidebarFilters.module.css'

const LOCATION_SECTION_IDS = new Set(['region', 'city', 'location', 'area', 'zone', 'neighborhood', 'district'])

interface Props {
  category:           FilterCategory
  topic:              string
  sections:           SidebarFilterSection[]
  appendedSections?:  SidebarFilterSection[]
  isFirstSearch:      boolean
  resetKey:           number
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
  }, [checks, level, secA, secB]) // intentionally omitting onChipsChange — it's stable via useCallback in parent

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
function BuyingSellingPanel({ topic, sections, onChipsChange, removedChipId,
  locationRefreshKey, resetKey, labelPrefix = '' }: {
  topic:              string
  sections:           SidebarFilterSection[]
  removedChipId:      string | null
  locationRefreshKey: number
  resetKey:           number
  labelPrefix?:       string
  onChipsChange:      (chips: ActiveFilterChip[]) => void
}) {
  const topicKey = Object.keys(BUYING_SELLING_FILTERS).find(k => topic.includes(k)) || 'general'
  const displaySections = sections.length > 0 ? sections : BUYING_SELLING_FILTERS[topicKey] || BUYING_SELLING_FILTERS.general
  const [values,    setValues]    = useState<Record<string, unknown>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => { setValues({}) }, [resetKey, topic])

  useEffect(() => {
    if (locationRefreshKey === 0) return
    setValues(prev => {
      const next = { ...prev }
      displaySections.forEach(sec => {
        if (LOCATION_SECTION_IDS.has(sec.id)) delete next[sec.id]
      })
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationRefreshKey])

  useEffect(() => {
    if (!removedChipId) return
    setValues(prev => {
      const next = { ...prev }
      const strippedId = removedChipId.startsWith(labelPrefix) ? removedChipId.slice(labelPrefix.length) : removedChipId
      if (next[strippedId] !== undefined) { delete next[strippedId]; return next }
      const dashIdx = strippedId.lastIndexOf('-')
      if (dashIdx > 0) {
        const secId = strippedId.slice(0, dashIdx)
        const opt   = strippedId.slice(dashIdx + 1)
        if (next[secId] && typeof next[secId] === 'object') {
          next[secId] = { ...(next[secId] as Record<string,boolean>), [opt]: false }
          return next
        }
      }
      return prev
    })
  }, [removedChipId, labelPrefix])

  function buildChips(): ActiveFilterChip[] {
    const chips: ActiveFilterChip[] = []
    displaySections.forEach(sec => {
      const v = values[sec.id]
      if (!v) return
      if (sec.type === 'checkboxes' && typeof v === 'object') {
        Object.entries(v as Record<string,boolean>).forEach(([opt, on]) => {
          if (on) chips.push({ id: `${labelPrefix}${sec.id}-${opt}`, label: sec.label, value: opt, category: 'buying-selling' })
        })
      } else if (sec.type === 'radio' || sec.type === 'select') {
        if (v) chips.push({ id: `${labelPrefix}${sec.id}`, label: sec.label, value: String(v), category: 'buying-selling' })
      } else if (sec.type === 'range') {
        const r = v as { min?: string; max?: string }
        if (r.min || r.max) {
          const val = [r.min && `${sec.unit||''}${r.min}`, r.max && `${sec.unit||''}${r.max}`].filter(Boolean).join(' – ')
          chips.push({ id: `${labelPrefix}${sec.id}`, label: sec.label, value: val, category: 'buying-selling' })
        }
      }
    })
    return chips
  }

  // FIX: only depend on `values` — not `displaySections` (new array ref every render)
  // and not `onChipsChange` (stabilised via useCallback in parent)
  useEffect(() => { onChipsChange(buildChips()) }, [values]) // eslint-disable-line react-hooks/exhaustive-deps

  function setCheck(secId: string, opt: string, checked: boolean) {
    setValues(prev => ({ ...prev, [secId]: { ...((prev[secId] as Record<string,boolean>) || {}), [opt]: checked } }))
  }
  function setRadio(secId: string, val: string)  { setValues(prev => ({ ...prev, [secId]: val })) }
  function setSelect(secId: string, val: string) { setValues(prev => ({ ...prev, [secId]: val })) }
  function setRange(secId: string, which: 'min'|'max', val: string) {
    setValues(prev => ({ ...prev, [secId]: { ...((prev[secId] as Record<string,string>) || {}), [which]: val } }))
  }

  return (
    <div>
      {displaySections.map(sec => {
        const isLocationSec = LOCATION_SECTION_IDS.has(sec.id)
        return (
          <div key={`${labelPrefix}${sec.id}`} className={styles.section}>
            <button className={styles.sectionHeader}
              onClick={() => setCollapsed(p => ({ ...p, [sec.id]: !p[sec.id] }))}>
              <span className={styles.sectionLabel}>
                {sec.label}
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
                    <input type="radio" name={`${labelPrefix}${sec.id}`} className={styles.checkbox}
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
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────
export function SidebarFilters({
  category, topic, sections, appendedSections = [],
  isFirstSearch, resetKey, locationRefreshKey, removedChipId, onRefine, onApply
}: Props) {
  const [initialChips,  setInitialChips]  = useState<ActiveFilterChip[]>([])
  const [appendedChips, setAppendedChips] = useState<ActiveFilterChip[]>([])

  useEffect(() => { setInitialChips([]); setAppendedChips([]) }, [resetKey])

  // FIX: useCallback so these don't get recreated on every render,
  // which was causing BuyingSellingPanel's useEffect to loop infinitely
  const handleInitialChips = useCallback((incoming: ActiveFilterChip[]) => {
    setInitialChips(incoming)
    onRefine([...incoming, ...appendedChips])
  }, [appendedChips, onRefine])

  const handleAppendedChips = useCallback((incoming: ActiveFilterChip[]) => {
    setAppendedChips(incoming)
    onRefine([...initialChips, ...incoming])
  }, [initialChips, onRefine])

  const allChips = [...initialChips, ...appendedChips]
  const hasAny   = allChips.length > 0

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
          <button className={styles.resetBtn} onClick={() => { setInitialChips([]); setAppendedChips([]); onRefine([]) }}>Clear</button>
        )}
      </div>

      <div className={styles.body}>
        {isFirstSearch ? (
          category === 'academia' ? <SkeletonAcademia /> : <SkeletonBuying />
        ) : category === 'academia' ? (
          <AcademiaPanel
            topic={topic}
            resetKey={resetKey}
            removedChipId={removedChipId}
            onChipsChange={handleInitialChips}
            onApply={onApply}
          />
        ) : (
          <>
            {/* ── Block A: Initial Filters ── */}
            {sections.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  padding: '6px 0 4px 0', marginBottom: 2,
                  borderBottom: '1px solid var(--border)',
                }}>
                  Initial Filters
                </div>
                <BuyingSellingPanel
                  topic={topic}
                  sections={sections}
                  resetKey={resetKey}
                  removedChipId={removedChipId}
                  locationRefreshKey={locationRefreshKey}
                  onChipsChange={handleInitialChips}
                  labelPrefix=""
                />
              </div>
            )}

            {/* ── Block B: Additional Filters (appended on YES) ── */}
            {appendedSections.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--teal)',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  padding: '6px 0 4px 0', marginBottom: 2,
                  borderBottom: '1px solid var(--teal)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span>➕</span> Additional Filters
                </div>
                <BuyingSellingPanel
                  topic={topic}
                  sections={appendedSections}
                  resetKey={resetKey}
                  removedChipId={removedChipId}
                  locationRefreshKey={locationRefreshKey}
                  onChipsChange={handleAppendedChips}
                  labelPrefix="appended_"
                />
                {/* Combined Apply button when both blocks present */}
                <button
                  className={styles.applyBtn}
                  style={{ marginTop: 8 }}
                  onClick={() => onApply(allChips)}
                >
                  {hasAny ? '✓ Apply all filters' : '↩ Revert to previous results'}
                </button>
              </div>
            )}

            {/* ── Single Apply button when only initial filters (no appended block) ── */}
            {appendedSections.length === 0 && sections.length > 0 && (
              <button
                className={styles.applyBtn}
                onClick={() => onApply(initialChips)}
              >
                {initialChips.length > 0 ? '✓ Apply filters' : '↩ Revert to previous results'}
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
