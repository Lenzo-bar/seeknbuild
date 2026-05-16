import type { UrlListEntry } from '../hooks/useUrlList'

interface Props {
  entries:       UrlListEntry[]
  onToggle:      (id: string) => void
  onRemove:      (id: string) => void
  onSelectAll:   (active: boolean) => void
  onClearAll:    () => void
  onReanalyze:   (urls: string[], task: string) => void
}

const TASK_ICONS: Record<string, string> = {
  summarize: '📋', compare: '⇄', analyze: '🔍', combine: '🔗', rewrite: '✏️',
}

export function UrlListPanel({ entries, onToggle, onRemove, onSelectAll, onClearAll, onReanalyze }: Props) {
  if (entries.length === 0) return null

  const activeCount  = entries.filter(e => e.active).length
  const activeUrls   = entries.filter(e => e.active).map(e => e.url)
  // Find the most-recently-used task among active entries
  const latestTask   = entries.filter(e => e.active).sort((a, b) => b.ts - a.ts)[0]?.task ?? 'summarize'

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🔗 URL research list
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px',
            borderRadius: 8, background: '#EEEDFE', color: '#3C3489',
          }}>
            {activeCount}/{entries.length} active
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={() => onSelectAll(true)}  style={btnSm}>All on</button>
          <button onClick={() => onSelectAll(false)} style={btnSm}>All off</button>
          {activeCount > 0 && (
            <button
              onClick={() => onReanalyze(activeUrls, latestTask)}
              style={{ ...btnSm, background: '#3C3489', color: '#fff', borderColor: '#3C3489' }}
            >
              ↻ Re-analyze ({activeCount})
            </button>
          )}
          <button onClick={onClearAll} style={{ ...btnSm, color: 'var(--danger)' }}>Clear all</button>
        </div>
      </div>

      {/* URL list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
        {entries.map(entry => (
          <div key={entry.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', borderRadius: 'var(--r-sm)',
            background: entry.active ? 'var(--surface-2)' : 'transparent',
            border: `1px solid ${entry.active ? 'var(--border)' : 'var(--border-light)'}`,
            opacity: entry.active ? 1 : 0.55,
            transition: 'all 0.15s',
          }}>
            {/* Active toggle */}
            <button
              onClick={() => onToggle(entry.id)}
              title={entry.active ? 'Pause this URL' : 'Activate this URL'}
              style={{
                width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                border: `2px solid ${entry.active ? '#3C3489' : 'var(--border)'}`,
                background: entry.active ? '#3C3489' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {entry.active && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <polyline points="2 6 5 9 10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>

            {/* Task badge */}
            <span style={{
              fontSize: 11, flexShrink: 0, color: 'var(--text-3)',
            }} title={entry.task}>
              {TASK_ICONS[entry.task] ?? '🔍'}
            </span>

            {/* URL label */}
            <span style={{
              flex: 1, fontSize: 12, color: 'var(--text-1)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={entry.url}>
              {entry.label}
            </span>

            {/* Card count */}
            {entry.cardCount > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
                {entry.cardCount} cards
              </span>
            )}

            {/* Remove */}
            <button onClick={() => onRemove(entry.id)} style={btnX} title="Remove">✕</button>
          </div>
        ))}
      </div>

      {entries.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
          Toggle URLs on/off to choose which are under active research. Only active URLs feed into All Results.
        </p>
      )}
    </div>
  )
}

const btnSm: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-2)', cursor: 'pointer',
}

const btnX: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-3)', background: 'none',
  border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1, flexShrink: 0,
}
