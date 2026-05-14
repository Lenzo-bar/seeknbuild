// api/llm.js — SeekNBuild v6
// LLM Only mode: no Brave Search, Claude answers directly.
// Returns: summary card + array of sub-cards (one per problem/topic).
// Each sub-card has: title, snippet, steps[], math (KaTeX), tags[].

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  // Destructure first — everything below depends on these
  const { query, previousSummary = '', sidebarMode = false } = req.body || {}
  if (!query?.trim()) return res.status(400).json({ error: 'Missing query' })

  const USE_CLAUDE   = process.env.USE_CLAUDE !== 'false'
  const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY
  const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434'
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3'

  if (USE_CLAUDE && !CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  // ── Sidebar filter generation mode ───────────────────────────────────────
  // Lightweight Claude Haiku call — generates topic-specific sidebar filters
  // from the actual query + card samples. Non-blocking, returns quickly.
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
          model: 'claude-haiku-4-5-20251001',
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

  // Guard: stop processing if client disconnects mid-request.
  let clientGone = false
  req.on('close', () => { clientGone = true })

  const hasPrior = previousSummary.trim().length > 0
  const summaryRule = hasPrior
    ? '"summary": "Updated 3-5 sentence overview incorporating previous findings and new topics."'
    : '"summary": "3-5 sentence professional overview of all topics covered in this response."'

  const prompt = `You are an expert academic tutor and professional educator.

Query: "${query}"
${hasPrior ? `\nPrevious summary context: "${previousSummary.trim()}"\n` : ''}
Provide detailed, professionally formatted solutions. For math/science, include step-by-step workings with LaTeX formulas.

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
  {"headers": ["Problem", "Formula", "Key insight"], "rows": [["Quadratic", "ax\u00b2+bx+c=0", "Discriminant determines roots"]]}

sidebarFilters rules — generate these carefully:
- Generate 3-5 filter sections that let the user refine THESE specific results.
- Base filters on the actual topics, subtopics, and properties in your cards — not generic placeholders.
- Each filter must have a unique snake_case id, a short label (1-3 words), a type, and options.
- Filter types: "checkboxes" (multi-select), "radio" (single choice), "select" (dropdown).
- Each filter needs 3-6 specific options drawn from the content of your cards.
- Example for calculus: {id:"topic", label:"Topic", type:"checkboxes", options:["Derivatives","Integrals","Limits","Series"]}
- Example for history: {id:"period", label:"Period", type:"radio", options:["Ancient","Medieval","Modern","Contemporary"]}
- Always include a difficulty or level filter when content varies in complexity.
- Do NOT use generic filters like "Content Type: Article/Video/Blog".

Cards rules:
- One card per distinct problem, topic, or example. Aim for 5-10 cards.
- Each card must be self-contained and fully solved — show all working.
- math field: use LaTeX notation. Escape backslashes (\\\\frac not \\frac).
- steps: minimum 3 steps, maximum 8. Each step is a complete sentence.
- difficulty: assess honestly.
- Output ONLY the JSON. No markdown fences. No preamble.`

  let parsed
  try {
    if (clientGone) return

    if (USE_CLAUDE && CLAUDE_KEY) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (clientGone) return

      if (!r.ok) return res.status(500).json({ error: `Claude ${r.status}: ${(await r.text()).slice(0, 300)}` })
      const d  = await r.json()

      if (clientGone) return

      const tb = d.content?.find(b => b.type === 'text')
      if (!tb?.text) return res.status(500).json({ error: 'No text block from Claude' })
      parsed = extractJSON(tb.text)
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
      parsed = extractJSON(text)
    }
  } catch (err) {
    if (clientGone) return
    return res.status(500).json({ error: `LLM call failed: ${String(err)}` })
  }

  if (clientGone) return
  if (!parsed) return res.status(500).json({ error: 'Could not extract JSON from LLM response.' })

  const rawCards = Array.isArray(parsed.cards) ? parsed.cards : []
  const summary  = typeof parsed.summary === 'string' ? parsed.summary : ''

  // Extract sidebar filters — Claude generates these inline with the cards
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
      id:         `llm-${i}`,
      rank:       i + 1,
      type:       'llm',
      title:      String(r.title    ?? `Topic ${i + 1}`),
      snippet:    String(r.snippet  ?? ''),
      steps:      Array.isArray(r.steps) ? r.steps.map(String) : [],
      math:       String(r.math ?? '').replace(/^`+|`+$/g, '').trim(),
      solution:   String(r.solution ?? ''),
      tags:       Array.isArray(r.tags) ? r.tags.map(String) : [],
      difficulty: String(r.difficulty ?? 'intermediate'),
      url: '',
      zone: 'llm',
      hasVideo: false,
      visible: true,
      docSelected: false,
      source: 'Claude AI',
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

function extractJSON(text) {
  const cleaned = text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  const s = cleaned.indexOf('{')
  const e = cleaned.lastIndexOf('}')
  if (s === -1 || e === -1) return null
  try { return JSON.parse(cleaned.slice(s, e + 1)) } catch { return null }
}
