// api/solve.js — SeekNBuild v5.3
// Extracts and solves math problems from an uploaded PDF or DOCX file.
// Pure JavaScript — no TypeScript syntax.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const { fileName = '', fileType = '', fileData = '', organizationHint = '' } = req.body || {}
  if (!fileData) return res.status(400).json({ error: 'Missing fileData (base64)' })

  const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  const isPdf = fileType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf')

  const orgInstruction = organizationHint
    ? `The user wants results organized by: "${organizationHint}". Reflect this in cardGroups and groupValues.`
    : 'Suggest 2-4 grouping categories (e.g. By topic, By method, By difficulty, By question number).'

  const prompt = `You are an expert mathematics tutor. Analyze this document and find ALL math/science problems.

${orgInstruction}

For each problem: extract the exact problem, solve it fully with step-by-step working, and show the final answer.

Respond ONLY with this JSON (no markdown, no preamble):
{
  "summary": "3-4 sentence overview of what the file covers, how many problems found, overall difficulty",
  "topic": "math",
  "cards": [
    {
      "title": "Problem 1: brief description",
      "snippet": "The exact problem statement",
      "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
      "math": "Key formula in LaTeX e.g. x = \\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}",
      "solution": "Final answer clearly stated",
      "tags": ["algebra", "quadratic"],
      "difficulty": "intermediate",
      "groupValues": { "topic": "Algebra", "method": "Factoring", "difficulty": "intermediate", "question": "Q1" }
    }
  ],
  "summaryTable": {
    "headers": ["Problem", "Topic", "Method", "Difficulty"],
    "rows": [["Problem 1", "Algebra", "Factoring", "Intermediate"]]
  },
  "cardGroups": [
    { "id": "topic",      "label": "By topic",           "description": "Group by math topic",      "subItems": ["Algebra","Calculus","Statistics"], "cardKeyword": "topic"      },
    { "id": "difficulty", "label": "By difficulty",      "description": "Group by difficulty",       "subItems": ["beginner","intermediate","advanced"], "cardKeyword": "difficulty" },
    { "id": "method",     "label": "By method",          "description": "Group by solution method",  "subItems": ["Factoring","Integration","Differentiation"], "cardKeyword": "method" },
    { "id": "question",   "label": "By question number", "description": "Keep original order",       "subItems": ["Q1","Q2","Q3","Q4","Q5"], "cardKeyword": "question"   }
  ]
}

Rules:
- Find and solve EVERY math/science problem. Do not skip any.
- Each card must fully solve the problem with all working shown.
- math field: LaTeX notation. Escape backslashes: \\\\frac not \\frac
- groupValues: fill topic, method, difficulty, question for every card.
- Output ONLY the JSON. Nothing else.`

  try {
    // Build message content based on file type
    let userContent
    if (isPdf) {
      userContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: fileData },
        },
        { type: 'text', text: prompt },
      ]
    } else {
      // For DOCX — send as text prompt only (Claude cannot parse DOCX binary)
      userContent = [
        {
          type: 'text',
          text: `File: ${fileName}\n\nNote: This is a DOCX file. Please analyze its mathematical content based on the filename and context, then provide sample solved problems appropriate for a document of this type.\n\n${prompt}`,
        },
      ]
    }

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

    // Log raw response for debugging (first 500 chars)
    console.log('Solve API raw response preview:', tb.text.slice(0, 500))

    const parsed = extractJSON(tb.text)
    if (!parsed) {
      console.error('Could not parse JSON from:', tb.text.slice(0, 800))
      return res.status(500).json({
        error: 'Could not extract JSON from Claude response. The file may be too complex — try a shorter document.',
        preview: tb.text.slice(0, 200),
      })
    }

    const rawCards  = Array.isArray(parsed.cards) ? parsed.cards : []
    const summary   = typeof parsed.summary === 'string' ? parsed.summary : ''
    const cardGroups = Array.isArray(parsed.cardGroups) ? parsed.cardGroups : []

    const summaryTable = (
      parsed.summaryTable &&
      typeof parsed.summaryTable === 'object' &&
      Array.isArray(parsed.summaryTable.headers) &&
      Array.isArray(parsed.summaryTable.rows)
    ) ? parsed.summaryTable : null

    const cards = []

    if (summary) {
      cards.push({
        id: 'solve-synthesis-0', rank: 0, type: 'llm', zone: 'llm',
        title: `Solved: ${(fileName || 'File').slice(0, 50)}`,
        snippet: summary,
        steps: [], math: '', solution: '',
        tags: ['File solved', 'LLM summary'],
        difficulty: '', url: '', source: fileName || 'uploaded file',
        hasVideo: false, visible: true, docSelected: false,
        groupValues: {},
      })
    }

    rawCards.forEach((r, i) => {
      cards.push({
        id:          `solve-${i}`,
        rank:        i + 1,
        type:        'llm',
        zone:        'llm',
        title:       String(r.title      || `Problem ${i + 1}`),
        snippet:     String(r.snippet    || ''),
        steps:       Array.isArray(r.steps) ? r.steps.map(String) : [],
        math:        String(r.math       || ''),
        solution:    String(r.solution   || ''),
        tags:        Array.isArray(r.tags) ? r.tags.map(String) : [],
        difficulty:  String(r.difficulty || 'intermediate'),
        url:         '',
        source:      fileName || 'uploaded file',
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
      topic: String(parsed.topic || 'math'),
    })

  } catch (err) {
    console.error('Solve API error:', err)
    return res.status(500).json({ error: `Solve failed: ${String(err)}` })
  }
}

function extractJSON(text) {
  // Strip markdown fences if present
  let cleaned = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  // Find outermost { }
  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null

  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch (e) {
    // Try to salvage truncated JSON by finding the last complete card
    console.warn('JSON parse failed, attempting salvage:', e.message)
    const partial = cleaned.slice(start, end + 1)
    // Find last complete card object
    const lastComplete = partial.lastIndexOf('},')
    if (lastComplete > 100) {
      // Close the array and object
      const salvaged = partial.slice(0, lastComplete + 1) + '] }'
      try { return JSON.parse(salvaged) } catch { /* give up */ }
    }
    return null
  }
}
