import { useState, useRef, useEffect } from 'react'
import styles from './CardGroupBar.module.css'

export interface CardGroupOption {
  id:          string
  label:       string        // e.g. "By location"
  description: string        // e.g. "Group by city or region"
  subItems:    string[]      // e.g. ["Copenhagen", "Paris", "Gothenburg"]
  cardKeyword: string        // hint for frontend matching
}

interface Props {
  groups:          CardGroupOption[]    // AI-suggested groups
  activeGroupId:   string | null        // currently selected group id
  groupingEnabled: boolean              // checkbox toggle
  onGroupChange:   (groupId: string | null) => void
  onToggle:        (enabled: boolean) => void
}

export function CardGroupBar({
  groups,
  activeGroupId,
  groupingEnabled,
  onGroupChange,
  onToggle,
}: Props) {
  const [customInput, setCustomInput] = useState('')
  const [showCustom,  setShowCustom]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeGroup = groups.find(g => g.id === activeGroupId)

  useEffect(() => {
    if (showCustom) inputRef.current?.focus()
  }, [showCustom])

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (val === '__custom__') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    setCustomInput('')
    onGroupChange(val || null)
  }

  function handleCustomSubmit() {
    const trimmed = customInput.trim()
    if (!trimmed) { setShowCustom(false); return }
    // Create a synthetic group from the custom input and pass its id
    onGroupChange(`custom:${trimmed}`)
    setShowCustom(false)
  }

  function handleCustomKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCustomSubmit()
    if (e.key === 'Escape') { setShowCustom(false); setCustomInput('') }
  }

  if (groups.length === 0) return null

  return (
    <div className={styles.bar}>
      {/* Left: group by label + dropdown */}
      <div className={styles.left}>
        <span className={styles.label}>Group by</span>

        {!showCustom ? (
          <select
            className={styles.select}
            value={activeGroupId || ''}
            onChange={handleSelectChange}
          >
            <option value="">— none (original order) —</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
            <option value="__custom__">✏ Custom group name…</option>
          </select>
        ) : (
          <div className={styles.customRow}>
            <input
              ref={inputRef}
              className={styles.customInput}
              placeholder="Type group name and press Enter…"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={handleCustomKey}
            />
            <button className={styles.customOk} onClick={handleCustomSubmit}>OK</button>
            <button className={styles.customCancel} onClick={() => { setShowCustom(false); setCustomInput('') }}>✕</button>
          </div>
        )}

        {/* Sub-items preview */}
        {activeGroup && activeGroup.subItems.length > 0 && !showCustom && (
          <span className={styles.subItems}>
            {activeGroup.subItems.slice(0, 5).join(' · ')}
            {activeGroup.subItems.length > 5 && ` · +${activeGroup.subItems.length - 5} more`}
          </span>
        )}
      </div>

      {/* Right: on/off toggle */}
      {activeGroupId && (
        <label className={styles.toggleLabel}>
          <div
            className={`${styles.toggle} ${groupingEnabled ? styles.toggleOn : ''}`}
            onClick={() => onToggle(!groupingEnabled)}
            role="switch"
            aria-checked={groupingEnabled}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onToggle(!groupingEnabled) }}
          >
            <div className={styles.toggleKnob} />
          </div>
          <span className={styles.toggleText}>
            {groupingEnabled ? 'grouped' : 'original order'}
          </span>
        </label>
      )}
    </div>
  )
}
