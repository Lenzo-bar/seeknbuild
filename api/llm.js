// api/llm.js — SeekNBuild v6
// LLM Only mode: no Brave Search, Claude answers directly.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const { query, previousSummary = '', sidebarMode = false } = req.body || {}
  if (!query?.trim()) return res.status(400).json({ error: 'Missing query' })

  const USE_CLAUDE   = process.env.USE_CLAUDE !== 'false'
  const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
  const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434'
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3'

  if (USE_CLAUDE && !CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  // ── Sidebar filter generation mode ───────────────────────────────────────
  if (sidebarMode) {
    if (!CLAUDE_KEY) return res.status(200).json({ sidebarFilters: [] })
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',   // ← FIXED model string
          max_tokens: 600,
          messages: [{ role: 'user', content: query }],
        }),
      })
      if (!r.ok) return res.status(200).json({ sidebarFilters: [] })
      const d = await r.json()
      const text = (d.content?.[0]?.text ?? '').replace(/```json|```/gi, '').trim()
      let filters = []
      try { filters = JSON.parse(text) } catch { filters = [] }
      if (!Array.isArray(filters)) filters = []
      return res.status(200).json({ sidebarFilters: filters })
    } catch {
      return res.status(200).json({ sidebarFilters: [] })
    }
  }

  // ── Normal LLM Only flow ──────────────────────────────────────────────────
  let clientGone = false
  req.on('close', () => { clientGone = true })

const hasPrior = previousSummary.trim().length > 0

const isFollowUp = hasPrior && query.includes('Follow-up:')

const topicAnchor = isFollowUp
  ? `CRITICAL TOPIC CONSTRAINT: You MUST answer ONLY within the context of this research topic:
"${previousSummary.trim()}"
Every card you generate must directly relate to this topic. Do NOT drift to adjacent subjects.
Do NOT discuss AI companies, models, or unrelated subjects unless they directly relate to the topic above.

`
  : ''

const summaryRule = hasPrior && !isFollowUp
  ? '"summary": "Updated 3-5 sentence overview incorporating previous findings and new topics."'
  : '"summary": "3-5 sentence professional overview of all topics covered in this response."'

const prompt = `You are an expert academic tutor and professional educator.
${topicAnchor}
Query: "${query}"
${hasPrior && !isFollowUp ? `\nPrevious summary context: "${previousSummary.trim()}"\n` : ''}
Provide detailed, professionally formatted responses tailored to the topic.
Only include LaTeX math expressions when the topic genuinely requires mathematical notation (e.g. equations, formulas, proofs, statistics).
For non-math topics like policy, history, environment, business, or social issues — leave the math field empty and omit the solution field entirely.

Respond ONLY with this exact JSON structure (no markdown, no explanation):
{
  ${summaryRule},
  "topic": "math|science|history|language|programming|general|finance|medicine|law|philosophy",
  "cards": [
    {
      "title": "Problem or topic title",
      "snippet": "1-2 sentence description of what this card covers",
      "steps": [
        "Step 1: Clear explanation of first step",
        "Step 2: Next step with reasoning",
        "Step 3: Continue as needed"
      ],
      "math": "LaTeX formula if applicable, e.g. x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}",
      "solution": "Final answer or conclusion, clearly stated",
      "tags": ["tag1", "tag2"],
      "difficulty": "beginner|intermediate|advanced"
    }
  ],
  "summaryTable": null,
  "sidebarFilters": [
    {
      "id": "unique_snake_case_id",
      "label": "Short Label",
      "type": "checkboxes",
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}

summaryTable rules:
- null if no structured comparison is useful.
- If multiple problems share comparable properties return:
  {"headers": ["Problem", "Formula", "Key insight"], "rows": [["Quadratic", "ax²+bx+c=0", "Discriminant determines roots"]]}

sidebarFilters rules — generate these carefully:
- Generate 3-5 filter sections that let the user refine THESE specific results.
- Base filters on the actual topics, subtopics, and properties in your cards — not generic placeholders.
- Each filter must have a unique snake_case id, a short label (1-3 words), a type, and options.
- Filter types: "checkboxes" (multi-select), "radio" (single choice), "select" (dropdown).
- Each filter needs 3-6 specific options drawn from the content of your cards.
- Example for AI topics: {"id":"ai_area","label":"AI Area","type":"checkboxes","options":["Machine Learning","Neural Networks","NLP","Computer Vision","Ethics"]}
- Example for env topics: {"id":"impact_type","label":"Impact Type","type":"checkboxes","options":["Energy","Water","Carbon","E-Waste","Land Use"]}
- Always include a difficulty or level filter when content varies in complexity.
- Do NOT use generic filters like "Content Type: Article/Video/Blog".

Cards rules:
- One card per distinct problem, topic, or example. Aim for 5-10 cards.
- Each card must be self-contained and fully solved — show all working.
// REPLACE WITH:
- math field: ONLY populate if the card genuinely contains a formula or equation. Leave as empty string "" for all non-math topics.
- solution field: ONLY populate for math/science problems with a concrete numerical or algebraic answer. Leave as "" otherwise.
- steps: for non-math topics, use steps to present key findings, evidence, or policy actions — not equations.
- steps: minimum 3 steps, maximum 8. Each step is a complete sentence.
- difficulty: assess honestly.
- Output ONLY the JSON. No markdown fences. No preamble.`

  let parsed
  try {
    if (clientGone) return

    if (USE_CLAUDE && CLAUDE_KEY) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (clientGone) return
      if (!r.ok) return res.status(500).json({ error: `Claude ${r.status}: ${(await r.text()).slice(0, 300)}` })
      const d = await r.json()
      if (clientGone) return

      const tb = d.content?.find(b => b.type === 'text')
      if (!tb?.text) return res.status(500).json({ error: 'No text block from Claude' })
      parsed = extractJSON(tb.text)

      // If primary parse failed, try to salvage individual fields
      if (!parsed) parsed = salvageFields(tb.text)

    } else {
      const r = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          options: { temperature: 0.1, num_ctx: 4096 },
          messages: [
            { role: 'system', content: 'You are a precise JSON-generating academic tutor. Always respond with only valid JSON.' },
            { role: 'user', content: prompt },
          ],
        }),
      })

      if (clientGone) return
      if (!r.ok) return res.status(500).json({ error: `Ollama ${r.status}: ${(await r.text()).slice(0, 300)}` })
      const d = await r.json()
      if (clientGone) return

      const text = d.message?.content || d.response || ''
      if (!text) return res.status(500).json({ error: 'Empty Ollama response' })
      parsed = extractJSON(text) || salvageFields(text)
    }
  } catch (err) {
    if (clientGone) return
    return res.status(500).json({ error: `LLM call failed: ${String(err)}` })
  }

  if (clientGone) return
  if (!parsed) return res.status(500).json({ error: 'Could not extract JSON from LLM response.' })

  const rawCards = Array.isArray(parsed.cards) ? parsed.cards : []
  const summary  = typeof parsed.summary === 'string' ? parsed.summary : ''

  const sidebarFilters = Array.isArray(parsed.sidebarFilters)
    ? parsed.sidebarFilters
        .filter(s => s && s.id && s.label && s.type)
        .map(s => ({
          id:      String(s.id),
          label:   String(s.label),
          type:    s.type,
          options: Array.isArray(s.options) ? s.options.map(String) : [],
          ...(s.unit ? { unit: String(s.unit) } : {}),
        }))
    : []

  const summaryTable = (
    parsed.summaryTable &&
    typeof parsed.summaryTable === 'object' &&
    Array.isArray(parsed.summaryTable.headers) &&
    Array.isArray(parsed.summaryTable.rows)
  ) ? parsed.summaryTable : null

  const cards = []

  if (summary) {
    cards.push({
      id: 'llm-synthesis-0', rank: 0, type: 'llm',
      title: `LLM Summary: ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}`,
      url: '', snippet: summary, tags: ['LLM summary'],
      steps: [], math: '', solution: '', difficulty: '',
    })
  }

  rawCards.forEach((r, i) => {
    cards.push({
      id:          `llm-${i}`,
      rank:        i + 1,
      type:        'llm',
      zone:        'llm',
      title:       String(r.title    ?? `Topic ${i + 1}`),
      snippet:     String(r.snippet  ?? ''),
      steps:       Array.isArray(r.steps) ? r.steps.map(s => String(s).replace(/—/g, '-').replace(/–/g, '-')) : [],
      math:        String(r.math ?? '').replace(/^`+|`+$/g, '').replace(/—/g, '-').replace(/–/g, '-').trim(),
      solution:    String(r.solution ?? ''),
      tags:        Array.isArray(r.tags) ? r.tags.map(String) : [],
      difficulty:  String(r.difficulty ?? 'intermediate'),
      url:         '',
      hasVideo:    false,
      visible:     true,
      docSelected: false,
      source:      'Claude AI',
    })
  })

  if (clientGone) return

  return res.status(200).json({
    cards,
    summaryTable,
    sidebarFilters,
    topic:  String(parsed.topic ?? 'general'),
    engine: USE_CLAUDE && CLAUDE_KEY ? 'claude' : `ollama:${OLLAMA_MODEL}`,
  })
}

// ── JSON extractors ───────────────────────────────────────────────────────────

// Primary: strip markdown fences and parse the outermost {} block.
function extractJSON(text) {
  const cleaned = text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  const s = cleaned.indexOf('{')
  const e = cleaned.lastIndexOf('}')
  if (s === -1 || e === -1) return null

  // Pass 1: direct parse
  try { return JSON.parse(cleaned.slice(s, e + 1)) } catch {}

  // Pass 2: strip control characters that break JSON inside long LLM responses
  const sanitized = cleaned.slice(s, e + 1)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  try { return JSON.parse(sanitized) } catch {}

  return null
}

// Fallback: if the full JSON can't be parsed (e.g. truncated response),
// salvage the individual arrays field-by-field so cards still render
// and sidebarFilters are recovered even if the outer object is malformed.
function salvageFields(text) {
  const result = {}

  // Extract top-level string fields
  const summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  if (summaryMatch) result.summary = summaryMatch[1]
  const topicMatch = text.match(/"topic"\s*:\s*"([^"]*)"/)
  if (topicMatch) result.topic = topicMatch[1]

  // Extract arrays by walking brace depth
  for (const key of ['cards', 'sidebarFilters', 'summaryTable']) {
    const keyIdx = text.indexOf(`"${key}"`)
    if (keyIdx === -1) continue
    const arrStart = text.indexOf('[', keyIdx)
    if (arrStart === -1) continue
    const items = []
    let depth = 0, objStart = -1
    for (let i = arrStart; i < text.length; i++) {
      const ch = text[i]
      if (ch === '{') { if (depth === 0) objStart = i; depth++ }
      else if (ch === '}') {
        depth--
        if (depth === 0 && objStart !== -1) {
          try { items.push(JSON.parse(text.slice(objStart, i + 1))) } catch {}
          objStart = -1
        }
      } else if (ch === ']' && depth === 0) break
    }
    if (items.length > 0) result[key] = items
  }

  return Object.keys(result).length > 0 ? result : null
}