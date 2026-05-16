import type { FileHistoryEntry } from '../hooks/useFileHistory'

interface Props {
  entries:    FileHistoryEntry[]
  onReuse:    (entry: FileHistoryEntry) => void
  onRemove:   (id: string) => void
  onClearAll: () => void
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📕',
  'text/plain': '📝',
  'text/csv': '📊',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📗',
}

export function FileHistoryPanel({ entries, onReuse, onRemove, onClearAll }: Props) {
  if (entries.length === 0) return null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📁 Previously analyzed files
        </span>
        <button onClick={onClearAll} style={btnSm}>Clear all</button>
      </div>

      {/* File list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map(entry => (
          <div key={entry.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 'var(--r-sm)',
            background: 'var(--surface-2)', border: '1px solid var(--border-light)',
          }}>
            {/* Icon */}
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {FILE_ICONS[entry.type] ?? '📄'}
            </span>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-1)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {entry.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {fmtSize(entry.size)} · {fmtDate(entry.ts)}
                {entry.cardCount > 0 && ` · ${entry.cardCount} cards`}
                {entry.prompt && (
                  <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>
                    · "{entry.prompt.length > 40 ? entry.prompt.slice(0, 40) + '…' : entry.prompt}"
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <button
                onClick={() => onReuse(entry)}
                title="Re-analyze this file"
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 9px',
                  borderRadius: 6, border: '1px solid var(--border)',
                  background: '#0F6E56', color: '#fff', cursor: 'pointer',
                }}
              >
                Re-analyze
              </button>
              <button onClick={() => onRemove(entry.id)} style={btnSm} title="Remove from history">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const btnSm: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text-3)', cursor: 'pointer',
}
