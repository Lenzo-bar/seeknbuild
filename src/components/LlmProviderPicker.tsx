import { useState, useRef, useEffect } from 'react'
import { LLM_PROVIDERS } from '../hooks/useLlmMulti'
import type { LlmProviderId } from '../hooks/useLlmMulti'

interface Props {
  selected:    Set<LlmProviderId>
  isLoading:   boolean
  disabled:    boolean
  onToggle:    (id: LlmProviderId) => void
  onSearch:    () => void
  onSelectAll: () => void
  onClearAll:  () => void
}

export function LlmProviderPicker({
  selected, isLoading, disabled, onToggle, onSearch, onSelectAll, onClearAll,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedCount = selected.size
  const canSearch = selectedCount > 0 && !isLoading && !disabled

  return (
    <div ref={ref} style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>

      {/* Main search button */}
      <button
        disabled={!canSearch}
        onClick={() => { if (canSearch) { onSearch(); setOpen(false) } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
          borderRadius: 'var(--r-md)', border: 'none',
          background: canSearch ? '#0F6E56' : 'var(--surface-2)',
          color: canSearch ? '#fff' : 'var(--text-3)',
          fontSize: 13, fontWeight: 600, cursor: canSearch ? 'pointer' : 'default',
          transition: 'all 0.15s',
        }}
      >
        {isLoading ? (
          <><Spinner /> Asking LLMs...</>
        ) : selectedCount === 0 ? (
          <><BrainIcon /> Pick LLMs below</>
        ) : (
          <><BrainIcon /> Ask {selectedCount === 1
            ? LLM_PROVIDERS.find(p => selected.has(p.id))!.label
            : `${selectedCount} LLMs`}</>
        )}
      </button>

      {/* Dropdown toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '9px 10px', borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
          background: open ? 'var(--surface-2)' : 'var(--surface)',
          color: 'var(--text-2)', cursor: 'pointer', fontSize: 13,
        }}
        title="Choose which LLMs to query"
      >
        ▾
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 3000, marginTop: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-overlay)',
          padding: '10px 12px', minWidth: 260,
        }}>
          {/* Controls */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button onClick={onSelectAll} style={btnSm}>Select all</button>
            <button onClick={onClearAll}  style={btnSm}>Clear</button>
            <span style={{ flex: 1 }} />
            <button onClick={() => setOpen(false)} style={btnSm}>✕</button>
          </div>

          {/* LLM grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 6,
          }}>
            {LLM_PROVIDERS.map(p => {
              const on = selected.has(p.id)
              return (
                <button key={p.id} onClick={() => onToggle(p.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 10px', borderRadius: 'var(--r-sm)',
                  border: `2px solid ${on ? p.color : 'var(--border)'}`,
                  background: on ? p.color + '14' : 'var(--surface-2)',
                  color: on ? p.color : 'var(--text-2)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.12s',
                }}>
                  <span style={{ fontSize: 16 }}>{p.icon}</span>
                  {p.label}
                  {on && (
                    <span style={{
                      marginLeft: 'auto', width: 14, height: 14, borderRadius: 7,
                      background: p.color, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <polyline points="1.5 5 4 7.5 8.5 2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {selectedCount > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, lineHeight: 1.5 }}>
              Each selected LLM creates its own result tab with a summary, cards, and web links.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function BrainIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14"/>
    </svg>
  )
}

function Spinner() {
  return (
    <span style={{
      width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      display: 'inline-block', animation: 'spin 0.7s linear infinite',
    }} />
  )
}

const btnSm: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text-2)', cursor: 'pointer',
}
