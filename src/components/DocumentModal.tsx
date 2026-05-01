import { useRef, useEffect, useState } from 'react'
import type { SearchCard } from '../types'
import styles from './DocumentModal.module.css'

// ── KaTeX helpers ─────────────────────────────────────────────────

async function renderKatex(el: HTMLElement, latex: string, display: boolean) {
  try {
    const katex = await import('katex')
    katex.default.render(latex, el, { throwOnError: false, displayMode: display, output: 'html' })
  } catch { el.textContent = latex }
}

function MathBlock({ latex }: { latex: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => { if (ref.current) renderKatex(ref.current, latex, true) }, [latex])
  return <span ref={ref} />
}

// ── Zone labels ───────────────────────────────────────────────────

const ZONE_META: Record<string, { label: string; color: string }> = {
  web:  { label: 'Web + LLM',          color: '#1B3A6B' },
  file: { label: 'File analysis',       color: '#0D7A8A' },
  more: { label: 'Additional question', color: '#854F0B' },
}

// ── Per-card detail level ─────────────────────────────────────────

type DetailLevel = 'compact' | 'full'

// ── Export helpers ────────────────────────────────────────────────

function buildMarkdown(cards: SearchCard[], details: Record<string, DetailLevel>): string {
  const lines: string[] = [
    '# SeekNBuild Research Document',
    `*Generated: ${new Date().toLocaleString()}*`,
    '',
    '---',
    '',
  ]
  for (const card of cards) {
    const full = details[card.id] === 'full'
    const zm = ZONE_META[card.zone] ?? { label: card.zone }
    lines.push(`## ${card.title}`)
    lines.push(`**Source:** [${card.source}](${card.source.startsWith('http') ? card.source : 'https://' + card.source})`)
    lines.push(`*${zm.label}*`)
    lines.push('')
    lines.push(card.snippet)
    if (full && card.steps?.length) {
      lines.push('', '**Steps:**')
      card.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.replace(/\\\(|\\\)/g, '')}`))
    }
    if (card.tags?.length) lines.push('', card.tags.map(t => `\`${t}\``).join(' '))
    lines.push('', '---', '')
  }
  return lines.join('\n')
}

function buildHTML(cards: SearchCard[], details: Record<string, DetailLevel>): string {
  const sections = cards.map(card => {
    const full = details[card.id] === 'full'
    const zm = ZONE_META[card.zone] ?? { label: card.zone, color: '#666' }
    const url = card.source.startsWith('http') ? card.source : 'https://' + card.source
    const steps = full && card.steps?.length
      ? `<ol>${card.steps.map(s => `<li>${s.replace(/\\\(|\\\)/g, '')}</li>`).join('')}</ol>`
      : ''
    const tags = card.tags?.length
      ? `<div class="tags">${card.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
      : ''
    return `
    <div class="section">
      <div class="zone-label" style="color:${zm.color}">${zm.label}</div>
      <h2><a href="${url}" target="_blank" rel="noopener noreferrer">${card.title}</a></h2>
      <div class="source"><a href="${url}" target="_blank" rel="noopener noreferrer">${card.source}</a></div>
      <p>${card.snippet}</p>
      ${steps}
      ${tags}
    </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SeekNBuild Research Document</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #111; line-height: 1.6; }
    h1 { font-size: 26px; color: #1B3A6B; border-bottom: 2px solid #1B3A6B; padding-bottom: 8px; }
    .meta { font-size: 12px; color: #888; margin-bottom: 32px; }
    .section { margin-bottom: 36px; padding-bottom: 32px; border-bottom: 1px solid #e2e5eb; }
    .zone-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
    h2 { font-size: 18px; font-weight: 600; margin: 0 0 6px; }
    h2 a { color: #1B3A6B; text-decoration: none; }
    h2 a:hover { text-decoration: underline; }
    .source { font-size: 12px; margin-bottom: 10px; }
    .source a { color: #0D7A8A; }
    p { font-size: 14px; color: #4b5563; margin: 0 0 10px; }
    ol { padding-left: 20px; font-size: 13px; color: #4b5563; }
    ol li { margin-bottom: 4px; }
    .tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
    .tag { font-size: 11px; padding: 2px 8px; background: #f3f4f6; border: 1px solid #e2e5eb; border-radius: 9px; color: #6b7280; }
  </style>
</head>
<body>
  <h1>SeekNBuild Research Document</h1>
  <div class="meta">Generated ${new Date().toLocaleString()} · ${cards.length} section${cards.length !== 1 ? 's' : ''}</div>
  ${sections}
</body>
</html>`
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

async function downloadDocx(cards: SearchCard[], details: Record<string, DetailLevel>) {
  // Load docx from CDN
  const script = document.createElement('script')
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.umd.min.js'
  await new Promise(res => { script.onload = res; document.head.appendChild(script) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Document, Packer, Paragraph, TextRun, ExternalHyperlink, HeadingLevel, AlignmentType } = (window as any).docx

  const children: unknown[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'SeekNBuild Research Document', color: '1B3A6B' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, color: '888888', size: 20 })],
      spacing: { after: 400 },
    }),
  ]

  for (const card of cards) {
    const full = details[card.id] === 'full'
    const zm = ZONE_META[card.zone] ?? { label: card.zone }
    const url = card.source.startsWith('http') ? card.source : 'https://' + card.source

    children.push(
      new Paragraph({
        children: [new TextRun({ text: zm.label.toUpperCase(), size: 18, color: '888888', bold: true })],
        spacing: { before: 360, after: 60 },
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new ExternalHyperlink({
            link: url,
            children: [new TextRun({ text: card.title, color: '1B3A6B', style: 'Hyperlink' })],
          }),
        ],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Source: ', bold: true, size: 20 }),
          new ExternalHyperlink({
            link: url,
            children: [new TextRun({ text: card.source, color: '0D7A8A', size: 20, style: 'Hyperlink' })],
          }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: card.snippet, size: 22, color: '4B5563' })],
        spacing: { after: 120 },
      }),
    )

    if (full && card.steps?.length) {
      card.steps.forEach((step, i) => {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${i + 1}. ${step.replace(/\\\(|\\\)/g, '')}`, size: 20, color: '4B5563' })],
          indent: { left: 360 },
          spacing: { after: 60 },
        }))
      })
    }

    if (card.tags?.length) {
      children.push(new Paragraph({
        children: [new TextRun({ text: card.tags.join('  ·  '), size: 18, color: '9CA3AF' })],
        spacing: { after: 200 },
        alignment: AlignmentType.LEFT,
      }))
    }

    children.push(new Paragraph({
      border: { bottom: { style: 'single', size: 4, color: 'E2E5EB', space: 1 } },
      children: [],
      spacing: { after: 240 },
    }))
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children,
    }],
  })

  const buffer = await Packer.toBlob(doc)
  const url2 = URL.createObjectURL(buffer)
  const a = document.createElement('a'); a.href = url2; a.download = 'seeknbuild-document.docx'; a.click()
  URL.revokeObjectURL(url2)
}

async function downloadPDF(cards: SearchCard[], details: Record<string, DetailLevel>) {
  // Use HTML → print approach (most reliable cross-browser PDF)
  const html = buildHTML(cards, details)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.print() }, 500)
}

// ── Component ─────────────────────────────────────────────────────

interface Props {
  cards: SearchCard[]
  onClose: () => void
}

export function DocumentModal({ cards, onClose }: Props) {
  const [details, setDetails] = useState<Record<string, DetailLevel>>(() =>
    Object.fromEntries(cards.map(c => [c.id, 'compact']))
  )
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function toggleDetail(id: string) {
    setDetails(prev => ({ ...prev, [id]: prev[id] === 'compact' ? 'full' : 'compact' }))
  }

  async function handleExport(format: string) {
    setExporting(format)
    try {
      if (format === 'md')   downloadBlob(buildMarkdown(cards, details), 'seeknbuild-document.md', 'text/markdown')
      if (format === 'html') downloadBlob(buildHTML(cards, details), 'seeknbuild-document.html', 'text/html')
      if (format === 'docx') await downloadDocx(cards, details)
      if (format === 'pdf')  await downloadPDF(cards, details)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className={styles.backdrop} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <DocIcon />
            Document preview — {cards.length} section{cards.length !== 1 ? 's' : ''}
          </div>
          <button className={styles.closeBtn} onClick={onClose}><XIcon /></button>
        </div>

        {/* Body — live preview */}
        <div className={styles.body}>
          <div className={styles.docTitle}>SeekNBuild Research Document</div>
          <div className={styles.docMeta}>
            Generated {new Date().toLocaleString()} · {cards.length} section{cards.length !== 1 ? 's' : ''} selected
            <span className={styles.metaHint}> — click any card to toggle compact / full detail</span>
          </div>

          {cards.map(card => {
            const zm = ZONE_META[card.zone] ?? { label: card.zone, color: '#666' }
            const isFull = details[card.id] === 'full'
            const url = card.source.startsWith('http') ? card.source : 'https://' + card.source

            return (
              <div key={card.id} className={`${styles.section} ${isFull ? styles.sectionFull : ''}`}>
                <div className={styles.sectionTop}>
                  <div className={styles.sourceTag} style={{ color: zm.color }}>{zm.label}</div>
                  <button
                    className={styles.detailToggle}
                    onClick={() => toggleDetail(card.id)}
                    title={isFull ? 'Switch to compact view' : 'Switch to full view'}
                  >
                    {isFull ? '▲ Compact' : '▼ Full'}
                  </button>
                </div>

                <h3 className={styles.sectionTitle}>{card.title}</h3>

                {/* Clickable source URL */}
                <a href={url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                  <LinkIcon /> {card.source}
                </a>

                <p className={styles.sectionBody}>{card.snippet}</p>

                {card.math && (
                  <div className={styles.mathBlock}><MathBlock latex={card.math} /></div>
                )}

                {isFull && card.steps && card.steps.length > 0 && (
                  <ol className={styles.steps}>
                    {card.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                )}

                {card.tags?.length > 0 && (
                  <div className={styles.tagRow}>
                    {card.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer — export buttons */}
        <div className={styles.footer}>
          <span className={styles.exportLabel}>Export as:</span>

          {[
            { fmt: 'md',   icon: '📄', label: 'Markdown' },
            { fmt: 'html', icon: '🌐', label: 'HTML' },
            { fmt: 'pdf',  icon: '🖨', label: 'PDF' },
          ].map(({ fmt, icon, label }) => (
            <button
              key={fmt}
              className={`${styles.actionBtn} ${exporting === fmt ? styles.actionBtnLoading : ''}`}
              onClick={() => handleExport(fmt)}
              disabled={exporting !== null}
            >
              {exporting === fmt ? <span className={styles.spinner} /> : icon} {label}
            </button>
          ))}

          {/* Word export — disabled: PDF can be opened in Word/Google Docs locally */}
          <button
            className={styles.actionBtn}
            disabled
            title="Coming soon — PDF files can be opened directly in Word or Google Docs"
            style={{ opacity: 0.38, cursor: 'not-allowed', textDecoration: 'line-through' }}
          >
            📝 Word (.docx)
          </button>

          <button className={styles.printBtn} onClick={() => window.print()} disabled={exporting !== null}>
            🖨 Print
          </button>

          <button className={styles.closeFootBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function DocIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> }
function XIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> }
function LinkIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> }
