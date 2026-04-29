import { useState, useEffect } from 'react'
import type { FilterCategory, ActiveFilterChip } from '../types'
import type { SidebarFilterSection } from '../types'
import {
  ACADEMIA_PRIMARIES, ACADEMIA_LEVELS,
  ACADEMIA_SECONDARY_A, ACADEMIA_SECONDARY_B,
  BUYING_SELLING_FILTERS,
} from '../data/filterCategories'
import styles from './SidebarFilters.module.css'

interface Props {
  category:    FilterCategory
  topic:       string
  sections:    SidebarFilterSection[]   // for buying-selling (from API)
  isSearching: boolean
  resetKey:    number                   // increment to force-reset all filters
  onRefine:    (chips: ActiveFilterChip[]) => void
}

// ── Skeleton loader ───────────────────────────────────────────────
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
            <div className={`${styles.skelLine} ${styles.skelLabel}`} style={{width: `${55+Math.random()*35}%`}} />
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

// ── Academia panel ────────────────────────────────────────────────
function AcademiaPanel({ topic, onChipsChange }: {
  topic: string
  onChipsChange: (chips: ActiveFilterChip[]) => void
}) {
  const key = Object.keys(ACADEMIA_PRIMARIES).find(k => topic.includes(k)) || 'default'
  const primaries  = ACADEMIA_PRIMARIES[key]
  const secondaryA = ACADEMIA_SECONDARY_A[key] || ACADEMIA_SECONDARY_A.default
  const secondaryB = ACADEMIA_SECONDARY_B[key] || ACADEMIA_SECONDARY_B.default

  const [checks, setChecks]   = useState<Record<string,boolean>>({})
  const [level,  setLevel]    = useState('')
  const [secA,   setSecA]     = useState('')
  const [secB,   setSecB]     = useState('')

  // Reset when topic changes
  useEffect(() => { setChecks({}); setLevel(''); setSecA(''); setSecB('') }, [topic])

  // Emit chips whenever any value changes
  useEffect(() => {
    const chips: ActiveFilterChip[] = []
    Object.entries(checks).forEach(([label, on]) => {
      if (on) chips.push({ id: `ck-${label}`, label, value: label, category: 'academia' })
    })
    if (level) chips.push({ id: 'level', label: 'Level', value: level, category: 'academia' })
    if (secA)  chips.push({ id: 'secA',  label: 'Sub-topic', value: secA, category: 'academia' })
    if (secB)  chips.push({ id: 'secB',  label: 'Format', value: secB, category: 'academia' })
    onChipsChange(chips)
  }, [checks, level, secA, secB, onChipsChange])

  function toggleCheck(label: string) {
    setChecks(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className={styles.body}>
      {/* Primary checkboxes */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Primary filters</div>
        <div className={styles.sectionBody}>
          {primaries.map(p => (
            <label key={p} className={styles.checkItem}>
              <input type="checkbox" className={styles.checkbox}
                checked={!!checks[p]} onChange={() => toggleCheck(p)} />
              <span className={styles.checkLabel}>{p}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Level dropdown */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Learner level</div>
        <div className={styles.sectionBody}>
          <select className={styles.select} value={level}
            onChange={e => setLevel(e.target.value)}>
            <option value="">Any level</option>
            {ACADEMIA_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Secondary A dropdown */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Sub-topic</div>
        <div className={styles.sectionBody}>
          <select className={styles.select} value={secA}
            onChange={e => setSecA(e.target.value)}>
            <option value="">Any sub-topic</option>
            {secondaryA.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Secondary B dropdown */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Format / type</div>
        <div className={styles.sectionBody}>
          <select className={styles.select} value={secB}
            onChange={e => setSecB(e.target.value)}>
            <option value="">Any format</option>
            {secondaryB.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <button className={styles.applyBtn} onClick={() => {/* chips already emitted live */}}>
        Apply filters
      </button>
    </div>
  )
}

// ── Buying/Selling panel ──────────────────────────────────────────
function BuyingSellingPanel({ topic, sections, onChipsChange }: {
  topic: string
  sections: SidebarFilterSection[]
  onChipsChange: (chips: ActiveFilterChip[]) => void
}) {
  const topicKey = Object.keys(BUYING_SELLING_FILTERS).find(k => topic.includes(k)) || 'general'
  const displaySections = sections.length > 0 ? sections : BUYING_SELLING_FILTERS[topicKey] || BUYING_SELLING_FILTERS.general
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => { setValues({}) }, [topic])

  useEffect(() => {
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
          const val = [r.min && `${sec.unit || ''}${r.min}`, r.max && `${sec.unit || ''}${r.max}`].filter(Boolean).join(' – ')
          chips.push({ id: sec.id, label: sec.label, value: val, category: 'buying-selling' })
        }
      }
    })
    onChipsChange(chips)
  }, [values, displaySections, onChipsChange])

  function setCheck(secId: string, opt: string, checked: boolean) {
    setValues(prev => ({ ...prev, [secId]: { ...((prev[secId] as Record<string,boolean>) || {}), [opt]: checked } }))
  }
  function setRadio(secId: string, val: string) { setValues(prev => ({ ...prev, [secId]: val })) }
  function setSelect(secId: string, val: string) { setValues(prev => ({ ...prev, [secId]: val })) }
  function setRange(secId: string, which: 'min'|'max', val: string) {
    setValues(prev => ({ ...prev, [secId]: { ...((prev[secId] as Record<string,string>) || {}), [which]: val } }))
  }

  return (
    <div className={styles.body}>
      {displaySections.map(sec => (
        <div key={sec.id} className={styles.section}>
          <button className={styles.sectionHeader} onClick={() => setCollapsed(p => ({ ...p, [sec.id]: !p[sec.id] }))}>
            <span className={styles.sectionLabel}>{sec.label}</span>
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
      ))}
      <button className={styles.applyBtn} onClick={() => {/* chips emitted live */}}>
        Apply filters
      </button>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────
export function SidebarFilters({ category, topic, sections, isSearching, resetKey, onRefine }: Props) {
  const [chips, setChips] = useState<ActiveFilterChip[]>([])

  // When resetKey changes (from parent Clear All), wipe local chips too
  useEffect(() => {
    setChips([])
  }, [resetKey])

  function handleChips(incoming: ActiveFilterChip[]) {
    setChips(incoming)
    onRefine(incoming)
  }

  const hasAny = chips.length > 0

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Refine results</span>
        <span className={styles.categoryBadge}>
          {category === 'academia' ? '🎓 Academia' : category === 'buying-selling' ? '🛒 Buy / Sell' : '🔍 General'}
        </span>
        {hasAny && (
          <button className={styles.resetBtn} onClick={() => { setChips([]); onRefine([]) }}>Clear</button>
        )}
      </div>

      {isSearching ? (
        category === 'academia' ? <SkeletonAcademia /> : <SkeletonBuying />
      ) : category === 'academia' ? (
        // key=resetKey forces full remount → resets all checkboxes/dropdowns
        <AcademiaPanel key={`acad-${resetKey}`} topic={topic} onChipsChange={handleChips} />
      ) : (
        <BuyingSellingPanel key={`buy-${resetKey}`} topic={topic} sections={sections} onChipsChange={handleChips} />
      )}
    </aside>
  )
}
