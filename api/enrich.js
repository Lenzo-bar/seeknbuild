// api/enrich.js — SeekNBuild Card Enrichment Endpoint
// Called on-demand when user expands a card.
// Returns: enriched paragraphs, image suggestions, chart spec (if applicable), citations.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { cardTitle, cardSnippet, cardUrl, cardType, query } = req.body

  if (!cardTitle && !cardSnippet) {
    return res.status(400).json({ error: 'Card title or snippet required' })
  }

  const systemPrompt = `You are SeekNBuild's enrichment engine. Your job is to deeply enrich a search result card into a rich, publishable section of content.

When given a card (title, snippet, URL, type), you must:
1. Write 2–4 well-structured paragraphs expanding on the topic. Be informative, neutral, and insightful. Draw on your knowledge beyond just the snippet.
2. Suggest 2–3 relevant image search queries (descriptive noun phrases, not URLs) that would visually illustrate this content. These can be from any source.
3. If the content is data-rich (statistics, comparisons, trends, rankings), produce a chart specification.
4. Extract or infer 2–4 citations/sources relevant to this content.
5. Write a short "relevance note" (1 sentence) explaining why this card matters in the context of the user's original query.
6. Assign a recommendation score from 1–10 for how much this card should be included in a final document, with a brief reason.

Respond ONLY with valid JSON. No markdown, no code fences, no preamble.

JSON shape:
{
  "paragraphs": ["paragraph 1", "paragraph 2", "paragraph 3"],
  "imageQueries": ["query 1", "query 2", "query 3"],
  "chart": null,
  "citations": [
    { "label": "Source name", "url": "https://..." }
  ],
  "relevanceNote": "One sentence explaining relevance to query.",
  "recommendationScore": 8,
  "recommendationReason": "Short reason for the score."
}

For chart (only when data warrants it), use this shape instead of null:
{
  "type": "bar" | "line" | "pie" | "table",
  "title": "Chart title",
  "description": "What this chart shows",
  "data": [
    { "label": "Label A", "value": 42 },
    { "label": "Label B", "value": 87 }
  ]
}

Rules:
- paragraphs: minimum 2, maximum 4. Each at least 3 sentences. Rich, publishable prose.
- imageQueries: always exactly 3 descriptive queries. No URLs, just search terms.
- citations: if the original URL is valid, include it. Add others you know of.
- Never fabricate specific statistics unless you are confident they are accurate.
- If chart data would be fabricated, set chart to null.`

  const userMessage = `Original query: "${query || 'general research'}"

Card to enrich:
Title: ${cardTitle}
Type: ${cardType || 'article'}
Source URL: ${cardUrl || 'not provided'}
Snippet: ${cardSnippet}

Enrich this card into a full publishable section.`

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

    // Strip markdown fences if present
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let enriched
    try {
      enriched = JSON.parse(cleaned)
    } catch {
      return res.status(500).json({ error: 'Failed to parse enrichment JSON', raw: rawText.slice(0, 500) })
    }

    // Validate shape
    if (!Array.isArray(enriched.paragraphs) || enriched.paragraphs.length === 0) {
      return res.status(500).json({ error: 'Invalid enrichment: missing paragraphs' })
    }

    return res.status(200).json({
      paragraphs: enriched.paragraphs || [],
      imageQueries: enriched.imageQueries || [],
      chart: enriched.chart || null,
      citations: enriched.citations || [],
      relevanceNote: enriched.relevanceNote || '',
      recommendationScore: enriched.recommendationScore || null,
      recommendationReason: enriched.recommendationReason || '',
    })

  } catch (err) {
    return res.status(500).json({ error: `Enrichment failed: ${String(err)}` })
  }
}
