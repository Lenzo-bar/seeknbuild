// api/analyze.js — SeekNBuild v5.3
// Document intelligence pipeline.
// Accepts base64 PDF (natively read by Claude) or DOCX text extract.
// Returns rich structured cards: question/solution pairs, summaries,
// chapter cards, formula cards, chart descriptions, etc.
// User prompt instructions override/refine AI defaults.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const {
    fileName     = '',
    fileType     = '',
    fileData     = '',   // base64 encoded file content
    userPrompt   = '',   // user's instructions from the PromptBox
    sessionId    = '',   // for multi-file sessions
  } = req.body || {}

  if (!fileData) return res.status(400).json({ error: 'Missing fileData (base64)' })

  const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  const isPdf = fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')

  // ── Build instructions from user prompt ───────────────────────────────────
  // The user prompt drives HOW Claude organizes the output.
  // If empty, Claude uses its best judgment.
  const userInstructions = userPrompt.trim()
    ? `User instructions (FOLLOW THESE — they override defaults):
"${userPrompt.trim()}"

Based on these instructions, decide the best card structure. For example:
- "organize by question and solution" → separate Question and Solution cards per problem, grouped by problem number
- "summarize by chapter" → one card per chapter with a summary
- "extract all formulas" → one card per formula with explanation and example
- "compare topics" → comparison cards with pros/cons or differences
The user's instruction is the primary guide for how to structure the output.`
    : `No specific instructions given. Analyze the document intelligently:
- If it contains Q&A or problems+solutions: create separate Question and Solution cards per problem
- If it contains chapters/sections: create one summary card per section
- If it contains data/tables: describe charts or comparisons
- If it contains formulas: create formula explanation cards
Use your best judgment based on the document's structure and content.`

  const systemPrompt = `You are an expert document analyst and academic tutor. You read documents carefully and create rich, structured educational content from them.

Your output is always a valid JSON object. You never output markdown, explanations, or any text outside the JSON.`

  const userContent = isPdf
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } },
        { type: 'text', text: buildPrompt(fileName, userInstructions) },
      ]
    : [
        { type: 'text', text: `Document: ${fileName}\n\n${userInstructions}\n\n${buildPrompt(fileName, userInstructions)}` },
      ]

  try {
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
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!r.ok) {
      const errText = await r.text()
      return res.status(500).json({ error: `Claude ${r.status}: ${errText.slice(0, 300)}` })
    }

    const d  = await r.json()
    const tb = d.content && d.content.find(b => b.type === 'text')
    if (!tb || !tb.text) {
      return res.status(500).json({ error: 'No text response from Claude' })
    }

    console.log('Analyze API raw preview:', tb.text.slice(0, 300))

    const parsed = extractJSON(tb.text)
    if (!parsed) {
      console.error('JSON parse failed. Raw:', tb.text.slice(0, 600))
      return res.status(500).json({
        error: 'Could not parse Claude response as JSON. Try a shorter file or simpler instructions.',
        preview: tb.text.slice(0, 200),
      })
    }

    // ── Normalize cards ───────────────────────────────────────────────────
    const rawCards   = Array.isArray(parsed.cards)      ? parsed.cards      : []
    const summary    = typeof parsed.summary === 'string' ? parsed.summary  : ''
    const cardGroups = Array.isArray(parsed.cardGroups) ? parsed.cardGroups : []

    const summaryTable = (
      parsed.summaryTable &&
      typeof parsed.summaryTable === 'object' &&
      Array.isArray(parsed.summaryTable.headers) &&
      Array.isArray(parsed.summaryTable.rows)
    ) ? parsed.summaryTable : null

    const cards = []

    // Summary card always first
    if (summary) {
      cards.push({
        id:          `file-synthesis-0`,
        rank:        0,
        type:        'file',
        zone:        'file',
        cardKind:    'summary',
        title:       `Analysis: ${fileName.slice(0, 50)}`,
        snippet:     summary,
        steps:       [],
        math:        '',
        solution:    '',
        chartSpec:   null,
        tags:        ['File analysis', 'Summary'],
        difficulty:  '',
        pairId:      null,
        pairType:    null,
        url:         '',
        source:      fileName,
        hasVideo:    false,
        visible:     true,
        docSelected: false,
        groupValues: {},
      })
    }

    rawCards.forEach((r, i) => {
      cards.push({
        id:          `file-${sessionId ? sessionId + '-' : ''}${i}`,
        rank:        i + 1,
        type:        'file',
        zone:        'file',
        // cardKind: question|solution|summary|formula|chapter|comparison|data|general
        cardKind:    String(r.cardKind   || 'general'),
        title:       String(r.title      || `Card ${i + 1}`),
        snippet:     String(r.snippet    || ''),
        steps:       Array.isArray(r.steps)   ? r.steps.map(String)   : [],
        math:        String(r.math || '').replace(/^`+|`+$/g, '').trim(),
        solution:    String(r.solution   || ''),
        // chartSpec: { type, labels, values, description } — for data cards
        chartSpec:   (r.chartSpec && typeof r.chartSpec === 'object') ? r.chartSpec : null,
        tags:        Array.isArray(r.tags)    ? r.tags.map(String)    : [],
        difficulty:  String(r.difficulty  || ''),
        // pairId links a Question card to its Solution card (same number)
        pairId:      r.pairId   != null ? String(r.pairId)   : null,
        pairType:    r.pairType != null ? String(r.pairType) : null,  // 'question' | 'solution'
        url:         '',
        source:      fileName,
        hasVideo:    false,
        visible:     true,
        docSelected: false,
        groupValues: (r.groupValues && typeof r.groupValues === 'object') ? r.groupValues : {},
      })
    })

    return res.status(200).json({
      cards,
      summaryTable,
      cardGroups,
      topic:    String(parsed.topic   || 'general'),
      fileInfo: { name: fileName, cardCount: cards.length },
    })

  } catch (err) {
    console.error('Analyze API error:', err)
    return res.status(500).json({ error: `Analysis failed: ${String(err)}` })
  }
}

// ── Prompt builder ─────────────────────────────────────────────────────────────
function buildPrompt(fileName, userInstructions) {
  return `Analyze the document "${fileName}" thoroughly.

${userInstructions}

Create a rich set of cards from the document content. Each card represents one meaningful unit:
- For Q&A/problem documents: separate Question cards and Solution cards, linked by pairId
- For textbooks/chapters: one card per chapter or major section
- For formula sheets: one card per formula with explanation and worked example
- For data documents: describe any tables or charts

Respond ONLY with this JSON (no markdown, no text outside the JSON):
{
  "summary": "3-5 sentence overview: what this document contains, how it is structured, what topics it covers, how many problems/sections found",
  "topic": "math|science|history|programming|language|business|general",
  "cards": [
    {
      "cardKind": "question",
      "title": "Problem 1: Solve x² + 5x + 6 = 0",
      "snippet": "The exact text of the question as it appears in the document",
      "steps": [],
      "math": "x^2 + 5x + 6 = 0",
      "solution": "",
      "chartSpec": null,
      "tags": ["quadratic", "factoring"],
      "difficulty": "intermediate",
      "pairId": "1",
      "pairType": "question",
      "groupValues": {
        "problem": "Problem 1",
        "topic": "Quadratic Equations",
        "type": "Question",
        "difficulty": "intermediate"
      }
    },
    {
      "cardKind": "solution",
      "title": "Solution 1: x² + 5x + 6 = 0",
      "snippet": "Brief description of the solution method used",
      "steps": [
        "Step 1: Factor the quadratic: (x + 2)(x + 3) = 0",
        "Step 2: Set each factor to zero: x + 2 = 0 or x + 3 = 0",
        "Step 3: Solve each equation: x = -2 or x = -3"
      ],
      "math": "(x + 2)(x + 3) = 0",
      "solution": "x = -2 or x = -3",
      "chartSpec": null,
      "tags": ["quadratic", "factoring"],
      "difficulty": "intermediate",
      "pairId": "1",
      "pairType": "solution",
      "groupValues": {
        "problem": "Problem 1",
        "topic": "Quadratic Equations",
        "type": "Solution",
        "difficulty": "intermediate"
      }
    }
  ],
  "summaryTable": {
    "headers": ["Problem", "Topic", "Method", "Difficulty"],
    "rows": [
      ["Problem 1", "Quadratic Equations", "Factoring", "Intermediate"]
    ]
  },
  "cardGroups": [
    {
      "id": "problem",
      "label": "By problem number",
      "description": "Group Question+Solution cards by problem number — creates Q&A piles",
      "subItems": ["Problem 1", "Problem 2", "Problem 3"],
      "cardKeyword": "problem"
    },
    {
      "id": "type",
      "label": "By type",
      "description": "Separate all questions from all solutions",
      "subItems": ["Question", "Solution"],
      "cardKeyword": "type"
    },
    {
      "id": "topic",
      "label": "By topic",
      "description": "Group by mathematical or subject topic",
      "subItems": ["Quadratic Equations", "Linear Equations"],
      "cardKeyword": "topic"
    },
    {
      "id": "difficulty",
      "label": "By difficulty",
      "description": "Group by difficulty level",
      "subItems": ["beginner", "intermediate", "advanced"],
      "cardKeyword": "difficulty"
    }
  ]
}

CRITICAL RULES:
1. pairId: use the same value (e.g. "1") on both the Question card and its Solution card so they link together
2. pairType: must be "question" or "solution" on paired cards, null on others
3. cardKind must be one of: question, solution, summary, formula, chapter, comparison, data, general
4. math field: LaTeX notation, escape backslashes (\\\\frac not \\frac)
5. steps: array of strings, each a complete sentence describing one step
6. chartSpec: only for data cards — { "type": "bar|line|pie", "labels": [...], "values": [...], "description": "..." }
7. groupValues: fill all relevant keys for EVERY card so pile grouping works
8. Extract and process EVERYTHING in the document — do not skip problems or sections
9. Output ONLY the JSON object. Absolutely nothing else.`
}

// ── JSON extractor with salvage ────────────────────────────────────────────────
function extractJSON(text) {
  const cleaned = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null

  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch (e) {
    // Attempt partial salvage — find last complete card
    console.warn('Full JSON parse failed, attempting salvage:', e.message)
    const partial = cleaned.slice(start, end + 1)
    const lastComma = partial.lastIndexOf('},')
    if (lastComma > 200) {
      try {
        const salvaged = partial.slice(0, lastComma + 1) + ']}'
        return JSON.parse(salvaged)
      } catch { /* give up */ }
    }
    return null
  }
}
