import type { SearchCard } from '../types'

/**
 * Parse an uploaded file into SearchCard objects.
 * Supports: .txt, .md, .csv, .pdf (text layer), .docx
 */
export async function parseFileToCards(file: File): Promise<SearchCard[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  let sections: { title: string; body: string }[] = []

  try {
    if (ext === 'pdf') {
      sections = await parsePdf(file)
    } else if (ext === 'docx') {
      sections = await parseDocx(file)
    } else if (ext === 'csv') {
      sections = await parseCsv(file)
    } else {
      sections = await parsePlainText(file)
    }
  } catch {
    sections = [{ title: file.name, body: 'Could not read this file. Try a .txt, .md, .csv, or .docx file.' }]
  }

  if (sections.length === 0) {
    sections = [{ title: file.name, body: 'No readable text content found in this file.' }]
  }

  return sections.map((sec, i) => ({
    id: `file-${Date.now()}-${i}`,
    zone: 'file' as const,
    type: 'file' as const,
    rank: i + 1,
    title: sec.title,
    source: file.name,
    snippet: sec.body.slice(0, 320) + (sec.body.length > 320 ? '…' : ''),
    tags: ['file', ext || 'text'],
    hasVideo: false,
    visible: true,
    docSelected: false,
  }))
}

// ── Plain text / Markdown ─────────────────────────────────────────────

async function parsePlainText(file: File): Promise<{ title: string; body: string }[]> {
  const text = await file.text()
  return splitIntoSections(text, file.name)
}

function splitIntoSections(text: string, filename: string): { title: string; body: string }[] {
  const lines = text.split('\n')
  const headingPattern = /^#{1,4}\s+(.+)|^([A-Z][A-Z\s\d:,\-–—]{4,})$/

  const sections: { title: string; body: string }[] = []
  let currentTitle = filename
  let currentBody: string[] = []

  for (const line of lines) {
    const m = line.match(headingPattern)
    if (m) {
      if (currentBody.join('').trim().length > 20) {
        sections.push({ title: currentTitle, body: currentBody.join('\n').trim() })
      }
      currentTitle = (m[1] || m[2]).trim()
      currentBody = []
    } else {
      currentBody.push(line)
    }
  }
  if (currentBody.join('').trim().length > 20) {
    sections.push({ title: currentTitle, body: currentBody.join('\n').trim() })
  }

  // No headings found — split by blank-line paragraphs
  if (sections.length <= 1) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 30)
    if (paragraphs.length > 1) {
      return paragraphs.slice(0, 20).map((p, i) => ({
        title: `${filename} — paragraph ${i + 1}`,
        body: p.trim(),
      }))
    }
    // Single blob — chunk by ~400 chars
    if (text.trim().length > 50) {
      const chunks: { title: string; body: string }[] = []
      const words = text.trim().split(/\s+/)
      let chunk: string[] = []
      let part = 1
      for (const word of words) {
        chunk.push(word)
        if (chunk.join(' ').length >= 400) {
          chunks.push({ title: `${filename} — part ${part++}`, body: chunk.join(' ') })
          chunk = []
        }
      }
      if (chunk.length) chunks.push({ title: `${filename} — part ${part}`, body: chunk.join(' ') })
      return chunks.slice(0, 20)
    }
  }

  return sections.slice(0, 20)
}

// ── CSV ───────────────────────────────────────────────────────────────

async function parseCsv(file: File): Promise<{ title: string; body: string }[]> {
  const text = await file.text()
  const rows = text.split('\n')
    .map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()))
    .filter(r => r.some(c => c.length > 0))

  if (rows.length < 2) return [{ title: file.name, body: text.slice(0, 500) }]

  const headers = rows[0]
  const dataRows = rows.slice(1)
  const chunkSize = 5
  const sections: { title: string; body: string }[] = []

  for (let i = 0; i < Math.min(dataRows.length, 100); i += chunkSize) {
    const chunk = dataRows.slice(i, i + chunkSize)
    const body = chunk.map(row =>
      headers.map((h, j) => `${h}: ${row[j] ?? ''}`).join(' | ')
    ).join('\n')
    sections.push({
      title: `${file.name} — rows ${i + 1}–${Math.min(i + chunkSize, dataRows.length)}`,
      body,
    })
  }
  return sections
}

// ── DOCX (ZIP → word/document.xml) ───────────────────────────────────

async function parseDocx(file: File): Promise<{ title: string; body: string }[]> {
  try {
    const buffer = await file.arrayBuffer()
    const xmlText = await extractFromZip(new Uint8Array(buffer), 'word/document.xml')
    if (!xmlText) return parsePlainText(file)

    const plain = xmlText
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<w:p[ >][^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#x[0-9A-Fa-f]+;/g, '')
      .replace(/[ \t]{2,}/g, ' ')

    return splitIntoSections(plain, file.name)
  } catch {
    return parsePlainText(file)
  }
}

async function extractFromZip(data: Uint8Array, targetFile: string): Promise<string | null> {
  let offset = 0
  while (offset < data.length - 30) {
    if (data[offset]===0x50 && data[offset+1]===0x4B &&
        data[offset+2]===0x03 && data[offset+3]===0x04) {
      const method      = data[offset+8]  | (data[offset+9]  << 8)
      const compSize    = data[offset+18] | (data[offset+19] << 8) |
                         (data[offset+20] << 16) | (data[offset+21] << 24)
      const fnLen       = data[offset+26] | (data[offset+27] << 8)
      const extraLen    = data[offset+28] | (data[offset+29] << 8)
      const fname       = new TextDecoder().decode(data.slice(offset+30, offset+30+fnLen))
      const dataStart   = offset + 30 + fnLen + extraLen
      const chunk       = data.slice(dataStart, dataStart + compSize)

      if (fname === targetFile) {
        if (method === 0) return new TextDecoder().decode(chunk)
        if (method === 8 && typeof DecompressionStream !== 'undefined') {
          const ds = new DecompressionStream('deflate-raw')
          const w = ds.writable.getWriter(); w.write(chunk); w.close()
          const r = ds.readable.getReader()
          const parts: Uint8Array[] = []
          for (;;) { const {done,value} = await r.read(); if (done) break; parts.push(value) }
          const total = parts.reduce((s,c)=>s+c.length,0)
          const out = new Uint8Array(total); let p=0
          for (const c of parts) { out.set(c,p); p+=c.length }
          return new TextDecoder().decode(out)
        }
        return null
      }
      offset = dataStart + compSize
    } else { offset++ }
  }
  return null
}

// ── PDF (text-layer extraction) ───────────────────────────────────────

async function parsePdf(file: File): Promise<{ title: string; body: string }[]> {
  try {
    // Try PDF.js if loaded via CDN in index.html
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjsLib = (window as any).pdfjsLib
    if (pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      const ab = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise
      const secs: { title: string; body: string }[] = []
      for (let p = 1; p <= Math.min(pdf.numPages, 40); p++) {
        const page = await pdf.getPage(p)
        const ct = await page.getTextContent()
        const text = ct.items.map((it: {str:string}) => it.str).join(' ').trim()
        if (text.length > 30) secs.push({ title: `${file.name} — page ${p}`, body: text })
      }
      if (secs.length > 0) return secs
    }
  } catch { /* fall through */ }

  // Fallback: raw binary text extraction for text-layer PDFs
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let raw = ''
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]
    if ((c >= 32 && c <= 126) || c === 10 || c === 13) raw += String.fromCharCode(c)
  }
  // PDF text objects sit between parentheses like (Hello world)
  const strings = raw.match(/\(([^)]{4,300})\)/g) ?? []
  const text = strings
    .map(s => s.slice(1, -1).replace(/\\n/g, '\n').trim())
    .filter(s => /[a-zA-Z]{3,}/.test(s))
    .join(' ')

  if (text.length > 80) return splitIntoSections(text, file.name)

  return [{
    title: file.name,
    body: 'This appears to be a scanned or image-based PDF. Text could not be extracted directly. ' +
          'Try converting it to a text-based PDF or use a .txt / .docx version instead.',
  }]
}
