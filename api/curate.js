// api/curate.js — SeekNBuild Card Curation Endpoint
// Called when user opens "All Results" / publishing mode.
// Claude reviews all cards and recommends which to include, in what order, and why.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { cards, query, documentGoal } = req.body

  if (!Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'Cards array required' })
  }

  const systemPrompt = `You are SeekNBuild's editorial AI — a senior project manager and content strategist.

The user has performed a search and collected a set of result cards. Your job is to:
1. Review all cards and recommend which ones should be included in the final published document.
2. Suggest an optimal ordering (narrative flow, logical progression, or importance ranking).
3. Identify any thematic gaps — topics not covered by current cards that would strengthen the document.
4. Group cards into suggested document sections with headings.
5. Write a short editorial brief (2-3 sentences) describing what kind of document this compilation would produce.

Respond ONLY with valid JSON. No markdown fences, no preamble.

JSON shape:
{
  "editorialBrief": "2-3 sentence description of the resulting document.",
  "selectedIds": ["card-id-1", "card-id-2"],
  "orderedSections": [
    {
      "sectionTitle": "Introduction / Background",
      "cardIds": ["card-id-1"],
      "rationale": "Why these cards open the document."
    },
    {
      "sectionTitle": "Core Findings",
      "cardIds": ["card-id-2", "card-id-3"],
      "rationale": "Central evidence and data."
    }
  ],
  "rejectedIds": [
    { "id": "card-id-4", "reason": "Duplicate coverage of topic already addressed." }
  ],
  "gaps": [
    "A section on economic impact is missing.",
    "No data source covers the 2024 figures."
  ],
  "suggestedTitle": "Proposed document title"
}

Rules:
- Be decisive. Don't recommend everything — curate ruthlessly for quality.
- Prefer cards with unique angles, data, or authoritative sources.
- Reject duplicates, low-value cards, and off-topic results.
- orderedSections should reflect a natural document narrative (intro → evidence → analysis → conclusion).
- gaps should be actionable — specific enough that the user knows what to search for next.`

  const cardSummaries = cards.map((c, i) =>
    `[${i + 1}] ID: ${c.id}
  Title: ${c.title}
  Type: ${c.type || 'article'}
  Snippet: ${(c.snippet || '').slice(0, 200)}
  URL: ${c.url || 'N/A'}
  Tags: ${(c.tags || []).join(', ') || 'none'}`
  ).join('\n\n')

  const userMessage = `User's original query: "${query || 'general research'}"
Document goal: "${documentGoal || 'a well-structured informational document'}"

Here are all the search result cards to review:

${cardSummaries}

Please curate these into the best possible document compilation. Be editorially decisive.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.status(500).json({ error: `Anthropic API error: ${errText}` })
    }

    const data = await response.json()
    const rawText = data.content?.map(b => b.text || '').join('') || ''
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let curation
    try {
      curation = JSON.parse(cleaned)
    } catch {
      return res.status(500).json({ error: 'Failed to parse curation JSON', raw: rawText.slice(0, 500) })
    }

    return res.status(200).json({
      editorialBrief: curation.editorialBrief || '',
      selectedIds: curation.selectedIds || [],
      orderedSections: curation.orderedSections || [],
      rejectedIds: curation.rejectedIds || [],
      gaps: curation.gaps || [],
      suggestedTitle: curation.suggestedTitle || '',
    })

  } catch (err) {
    return res.status(500).json({ error: `Curation failed: ${String(err)}` })
  }
}
