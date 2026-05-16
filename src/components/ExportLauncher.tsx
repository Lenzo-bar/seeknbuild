import { useState } from 'react'

export interface ExportTarget {
  id:    string
  label: string
  icon:  string
  desc:  string
  color: string
}

export const EXPORT_TARGETS: ExportTarget[] = [
  { id: 'document',    label: 'Document',      icon: '📝', desc: 'Word / PDF report',             color: '#185FA5' },
  { id: 'website',     label: 'Website',        icon: '🌐', desc: 'HTML page or landing',          color: '#0F6E56' },
  { id: 'powerpoint',  label: 'Presentation',   icon: '📊', desc: 'PowerPoint slide deck',         color: '#D85A30' },
  { id: 'spreadsheet', label: 'Spreadsheet',    icon: '📈', desc: 'Excel / CSV with charts',       color: '#3B6D11' },
  { id: 'book',        label: 'Book / Album',   icon: '📚', desc: 'Multi-chapter document',        color: '#854F0B' },
  { id: 'curriculum',  label: 'Curriculum',     icon: '🎓', desc: 'Course or school plan',         color: '#3C3489' },
  { id: 'itinerary',   label: 'Itinerary',      icon: '✈️', desc: 'Trip plan with schedule',       color: '#185FA5' },
  { id: 'social',      label: 'Social post',    icon: '📣', desc: 'Facebook / Twitter update',     color: '#10A37F' },
  { id: 'forum',       label: 'Forum / News',   icon: '📰', desc: 'Forum thread or article',       color: '#A32D2D' },
  { id: 'ad',          label: 'Advertisement',  icon: '📢', desc: 'Creative ad copy',              color: '#D85A30' },
  { id: 'blueprint',   label: 'Blueprint',      icon: '📐', desc: 'Invention or home design plan', color: '#534AB7' },
  { id: 'movie',       label: 'Script / Movie', icon: '🎬', desc: 'Screenplay or story outline',   color: '#993C1D' },
]

interface Props {
  cardCount:    number
  selectedCount: number
  onExport:     (targetId: string) => void
  onSelectAll:  () => void
}

export function ExportLauncher({ cardCount, selectedCount, onExport, onSelectAll }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (cardCount === 0) return null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '14px 16px', marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? 14 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>◈</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
              All Results — assembly &amp; export
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {cardCount} cards assembled
              {selectedCount > 0 ? ` · ${selectedCount} selected for export` : ' · select cards to export'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {selectedCount === 0 && cardCount > 0 && (
            <button onClick={onSelectAll} style={btnOutline}>Select all</button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              fontSize: 12, fontWeight: 600, padding: '6px 12px',
              borderRadius: 'var(--r-md)', border: 'none',
              background: expanded ? 'var(--surface-2)' : '#3C3489',
              color: expanded ? 'var(--text-2)' : '#fff', cursor: 'pointer',
            }}
          >
            {expanded ? 'Close export' : '↗ Export / Convert'}
          </button>
        </div>
      </div>

      {/* Export targets grid */}
      {expanded && (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
            Choose a format. SeekNBuild will use your assembled cards to generate the output.
            {selectedCount > 0 ? ` Using ${selectedCount} selected cards.` : ' Select specific cards above, or use all.'}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
            gap: 8,
          }}>
            {EXPORT_TARGETS.map(t => (
              <button
                key={t.id}
                onClick={() => onExport(t.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 4, padding: '10px 12px', borderRadius: 'var(--r-md)',
                  border: `1px solid ${t.color}30`,
                  background: t.color + '0D',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = t.color + '1E'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = t.color + '60'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = t.color + '0D'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = t.color + '30'
                }}
              >
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{t.desc}</span>
              </button>
            ))}
          </div>

          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: 'var(--surface-2)', borderRadius: 'var(--r-sm)',
            fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6,
          }}>
            💡 <strong style={{ color: 'var(--text-2)' }}>Coming soon:</strong> drag cards to reorder,
            merge cards into sections, add annotations, and save your assembly for later.
            Outputs can be deployed online, emailed, or stored locally.
          </div>
        </>
      )}
    </div>
  )
}

const btnOutline: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '6px 12px',
  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
  background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer',
}
