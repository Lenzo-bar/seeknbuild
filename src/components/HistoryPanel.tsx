import { useState, useRef, useEffect } from 'react'
import type { AppMode } from '../types'
import type { HistoryEntry } from '../hooks/usePromptHistory'

interface Props {
  entries:     HistoryEntry[]
  currentMode: AppMode
  onSelect:    (query: string) => void
  onRemove:    (id: string) => void
  onClearMode: (mode: AppMode) => void
  onClearAll:  () => void
}

const MODE_LABELS: Record<AppMode, string> = {
  web:     'Web + LLM',
  llm:     'LLM Only',
  file:    'File Analysis',
  webonly: 'Web Only',
  urls:    'URL Analyzer',
}

const MODE_COLORS: Record<AppMode, string> = {
  web:     '#185FA5',
  llm:     '#0F6E56',
  file:    '#854F0B',
  webonly: '#854F0B',
  urls:    '#3C3489',
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts
  if (d < 60000)   return 'just now'
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`
  return `${Math.floor(d / 86400000)}d ago`
}

export function HistoryPanel({ entries, currentMode, onSelect, onRemove, onClearMode, onClearAll }: Props) {
  const [open, setOpen]   = useState(false)
  const [tab,  setTab]    = useState<AppMode | 'all'>(currentMode)
  const ref               = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Sync tab to current mode when it changes
  useEffect(() => { setTab(currentMode) }, [currentMode])

  const displayed = tab === 'all'
    ? [...entries].sort((a, b) => b.ts - a.ts).slice(0, 60)
    : entries.filter(e => e.mode === tab).sort((a, b) => b.ts - a.ts)

  const totalCount = entries.length
  if (totalCount === 0 && !open) return null

  const modeCount = (m: AppMode) => entries.filter(e => e.mode === m).length

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Search history"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 600, padding: '5px 10px',
          borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
          background: open ? 'var(--surface-2)' : 'var(--surface)',
          color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <HistoryIcon />
        History
        {totalCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
            background: 'var(--navy)', color: '#fff',
            borderRadius: 9, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 4px',
          }}>
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 3000,
          marginTop: 6, width: 440, maxHeight: 480,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-overlay)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '12px 16px 0', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
              Search history
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {tab !== 'all' && modeCount(tab as AppMode) > 0 && (
                <button onClick={() => onClearMode(tab as AppMode)} style={btnSm}>
                  Clear {MODE_LABELS[tab as AppMode]}
                </button>
              )}
              {totalCount > 0 && (
                <button onClick={onClearAll} style={{ ...btnSm, color: 'var(--danger)' }}>
                  Clear all
                </button>
              )}
              <button onClick={() => setOpen(false)} style={btnSm}>✕</button>
            </div>
          </div>

          {/* Mode tabs */}
          <div style={{
            display: 'flex', gap: 4, padding: '10px 16px 8px',
            borderBottom: '1px solid var(--border)', overflowX: 'auto',
          }}>
            {(['all', 'web', 'llm', 'webonly', 'urls'] as const).map(m => {
              const count = m === 'all' ? totalCount : modeCount(m as AppMode)
              return (
                <button key={m} onClick={() => setTab(m)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 9px',
                    borderRadius: 10, border: '1px solid var(--border)',
                    background: tab === m ? 'var(--navy)' : 'var(--surface-2)',
                    color: tab === m ? '#fff' : 'var(--text-2)',
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                  {m === 'all' ? 'All' : MODE_LABELS[m as AppMode]} {count > 0 ? `(${count})` : ''}
                </button>
              )
            })}
          </div>

          {/* Entry list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {displayed.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                No history yet for this mode.
              </div>
            ) : (
              displayed.map(entry => (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '9px 16px', borderBottom: '1px solid var(--border-light)',
                  cursor: 'default',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Mode badge */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px',
                    borderRadius: 8, flexShrink: 0, marginTop: 1,
                    background: MODE_COLORS[entry.mode] + '18',
                    color: MODE_COLORS[entry.mode],
                  }}>
                    {MODE_LABELS[entry.mode].split(' ')[0]}
                  </span>

                  {/* Query text — clickable */}
                  <span
                    onClick={() => { onSelect(entry.query); setOpen(false) }}
                    style={{
                      flex: 1, fontSize: 12, color: 'var(--text-1)', lineHeight: 1.5,
                      cursor: 'pointer', wordBreak: 'break-word',
                    }}
                    title="Click to reuse"
                  >
                    {entry.query.length > 120 ? entry.query.slice(0, 120) + '…' : entry.query}
                  </span>

                  {/* Right side: time + remove */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{timeAgo(entry.ts)}</span>
                    <button
                      onClick={() => onRemove(entry.id)}
                      style={{
                        fontSize: 11, color: 'var(--text-3)', background: 'none',
                        border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1,
                      }}
                      title="Remove"
                    >✕</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const btnSm: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--surface-2)',
  color: 'var(--text-2)', cursor: 'pointer',
}

function HistoryIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
      <polyline points="12 7 12 12 15 15"/>
    </svg>
  )
}
