// api/search.js
// Vercel serverless function — uses Anthropic built-in web search tool only.
// No Brave API needed. One service, one key.

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { query } = await req.json()

  if (!query || typeof query !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing query' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const ANTHROPIC_KEY = process.env.VITE_ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3,
        }],
        messages: [{
          role: 'user',
          content:
`Search the web for: "${query}"

After searching, return ONLY a JSON object (no markdown, no extra text) in this exact format:
{
  "synthesis": "2-3 sentence direct answer to the query based on what you found.",
  "cards": [
    { "title": "Page title", "url": "https://...", "snippet": "1-2 sentence description.", "tags": ["tag1","tag2"] }
  ]
}

Rules:
- synthesis: answer directly and factually, 2-3 sentences
- cards: up to 20 results, most relevant first
- snippet: informative, not just meta description
- tags: 1-2 short topic labels
- Return ONLY the raw JSON, nothing else, no markdown fences`
        }]
      })
    })

    if (!response.ok) {
      const txt = await response.text()
      throw new Error(`Anthropic ${response.status}: ${txt.slice(0, 200)}`)
    }

    const data = await response.json()
    const textBlock = data.content?.find(b => b.type === 'text')
    if (!textBlock?.text) throw new Error('No text in Claude response')

    // Strip accidental markdown fences then parse
    const clean = textBlock.text
      .replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```\s*$/im, '').trim()

    let parsed
    try { parsed = JSON.parse(clean) }
    catch { throw new Error('Claude response was not valid JSON') }

    const rawCards  = Array.isArray(parsed.cards) ? parsed.cards : []
    const synthesis = typeof parsed.synthesis === 'string' ? parsed.synthesis : ''

    // Synthesis becomes card #0
    const cards = []
    if (synthesis) {
      cards.push({
        id: 'llm-synthesis', rank: 0, type: 'llm',
        title: `AI synthesis: ${query.slice(0, 55)}${query.length > 55 ? '…' : ''}`,
        url: '', snippet: synthesis, tags: ['AI synthesis'],
      })
    }

    rawCards.slice(0, 20).forEach((r, i) => {
      cards.push({
        id: `web-${i}`, rank: i + 1, type: 'article',
        title:   r.title   ?? 'Untitled',
        url:     r.url     ?? '',
        snippet: r.snippet ?? '',
        tags:    Array.isArray(r.tags) ? r.tags : ['web'],
      })
    })

    // Anything beyond 20 raw cards becomes link results
    const links = rawCards.slice(20).map((r, i) => ({
      id: `link-${i}`, rank: 21 + i,
      title:   r.title   ?? 'Untitled',
      url:     r.url     ?? '',
      snippet: r.snippet ?? '',
    }))

    return new Response(JSON.stringify({ cards, links }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
