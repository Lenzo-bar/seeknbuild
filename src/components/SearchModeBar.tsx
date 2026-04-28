import { useState, useRef, useEffect } from 'react'
import type { SearchMode, SearchModeConfig } from '../types'
import { SEARCH_MODES } from '../data/searchModes'
import styles from './SearchModeBar.module.css'

interface Props {
  active: SearchMode
  subMode: string
  onChange: (mode: SearchMode, sub?: string) => void
}

export function SearchModeBar({ active, subMode, onChange }: Props) {
  const [openDropdown, setOpenDropdown] = useState<SearchMode | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleModeClick(mode: SearchModeConfig) {
    if (mode.subOptions && mode.subOptions.length > 0) {
      setOpenDropdown(prev => prev === mode.id ? null : mode.id)
    } else {
      setOpenDropdown(null)
      onChange(mode.id)
    }
  }

  function handleSubClick(mode: SearchMode, subId: string) {
    setOpenDropdown(null)
    onChange(mode, subId)
  }

  return (
    <div className={styles.bar} ref={ref}>
      {SEARCH_MODES.map(mode => {
        const isActive = active === mode.id
        const hasDropdown = !!mode.subOptions?.length
        const activeSubLabel = isActive && subMode
          ? mode.subOptions?.find(s => s.id === subMode)?.label
          : null

        return (
          <div key={mode.id} className={styles.item}>
            <button
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => handleModeClick(mode)}
              aria-haspopup={hasDropdown ? 'listbox' : undefined}
              aria-expanded={openDropdown === mode.id}
            >
              {mode.label}
              {activeSubLabel && <span className={styles.subLabel}> · {activeSubLabel}</span>}
              {hasDropdown && (
                <svg className={`${styles.chevron} ${openDropdown === mode.id ? styles.chevronOpen : ''}`}
                  width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5L5 6.5L8 3.5"/>
                </svg>
              )}
            </button>

            {hasDropdown && openDropdown === mode.id && (
              <div className={styles.dropdown} role="listbox">
                <button
                  className={`${styles.dropItem} ${isActive && !subMode ? styles.dropItemActive : ''}`}
                  onClick={() => { setOpenDropdown(null); onChange(mode.id, '') }}
                >
                  All {mode.label}
                </button>
                {mode.subOptions!.map(sub => (
                  <button
                    key={sub.id}
                    className={`${styles.dropItem} ${isActive && subMode === sub.id ? styles.dropItemActive : ''}`}
                    onClick={() => handleSubClick(mode.id, sub.id)}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
