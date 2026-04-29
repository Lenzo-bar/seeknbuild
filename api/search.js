// api/search.js — SeekNBuild v4

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query, searchMode = 'all', subMode = '' } = req.body || {}
  if (!query?.trim()) return res.status(400).json({ error: 'Missing query' })

  const KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel Environment Variables' })

  // ── Detect topic for instant sidebar fallback ──────────────────
  function detectTopic(q) {
    q = q.toLowerCase()
    if (/house|home|condo|apartment|rent|mortgage|real.?estate|bedroom|property|mls|zillow|listing/.test(q)) return 'real-estate'
    if (/car|truck|suv|toyota|honda|ford|chevrolet|bmw|auto|vehicle|dealership/.test(q)) return 'automotive'
    if (/buy|shop|price|deal|discount|amazon|product/.test(q)) return 'shopping'
    if (/nba|nfl|nhl|mlb|soccer|football|basketball|baseball|hockey|sport|score/.test(q)) return 'sports'
    if (/news|breaking|latest|headline/.test(q)) return 'news'
    return 'general'
  }

  const FALLBACK_FILTERS = {
    'real-estate': [
      { id: 'price',   label: 'Price Range',   type: 'range',      unit: '$' },
      { id: 'beds',    label: 'Bedrooms',      type: 'radio',      options: ['Any','1','2','3','4','5+'] },
      { id: 'type',    label: 'Property Type', type: 'checkboxes', options: ['House','Condo','Townhouse','Land'] },
      { id: 'listing', label: 'Listing Type',  type: 'radio',      options: ['For Sale','For Rent'] },
    ],
    automotive: [
      { id: 'make',  label: 'Make',       type: 'checkboxes', options: ['Toyota','Honda','Ford','Chevrolet','BMW','Hyundai'] },
      { id: 'year',  label: 'Year Range', type: 'range',      unit: '' },
      { id: 'price', label: 'Price',      type: 'range',      unit: '$' },
      { id: 'cond',  label: 'Condition',  type: 'radio',      options: ['New','Used','Certified Pre-Owned'] },
    ],
    shopping: [
      { id: 'price',  label: 'Price Range', type: 'range', unit: '$' },
      { id: 'rating', label: 'Min Rating',  type: 'radio', options: ['Any','3+ stars','4+ stars'] },
    ],
    sports: [
      { id: 'league', label: 'League', type: 'checkboxes', options: ['NBA','NFL','NHL','MLB','MLS'] },
      { id: 'date',   label: 'Date',   type: 'select',     options: ['Today','This week','This month'] },
    ],
    news: [
      { id: 'date',   label: 'Date',   type: 'select',     options: ['Today','This week','This month'] },
      { id: 'source', label: 'Source', type: 'checkboxes', options: ['News','Blog','Official'] },
    ],
    general: [
      { id: 'ctype', label: 'Content Type', type: 'checkboxes', options: ['Article','Video','Forum','Blog'] },
      { id: 'date',  label: 'Date',         type: 'select',     options: ['Any time','Past week','Past month'] },
    ],
  }

  const topic = detectTopic(query)
  const fallbackFilters = FALLBACK_FILTERS[topic] || FALLBACK_FILTERS.general

  // ── Build prompt — ask for 20 cards + extra links ──────────────
  const modeHint = {
    all: 'broad mix', news: 'recent news articles', images: 'image results',
    videos: 'video results', forums: 'forum posts', shopping: 'product listings',
    entertainment: 'entertainment content', sports: 'sports news/scores', hobby: 'hobby guides',
  }[searchMode] || 'broad mix'

  const prompt = `Search the web for: "${query}"
Mode: ${searchMode}${subMode ? ` > ${subMode}` : ''}. Return ${modeHint}.

Respond with ONLY a valid JSON object. No markdown. Start with { end with }.

{
  "synthesis": "2-3 sentence direct answer",
  "topic": "general|real-estate|automotive|shopping|sports|news|entertainment|hobby|tech|health|travel|finance",
  "cards": [
    {"title":"...","url":"https://...","snippet":"1-2 sentences","tags":["tag1","tag2"]}
  ],
  "links": [
    {"title":"...","url":"https://...","snippet":"brief description"}
  ],
  "sidebarFilters": [
    {"id":"...","label":"...","type":"checkboxes","options":["A","B","C"]}
  ]
}

Rules:
- cards: exactly the TOP 20 most relevant results as full card objects
- links: the next 10-20 additional results as lighter link objects (title + url + snippet only)
- sidebarFilters: 3-5 filters matching the search domain. Types: checkboxes|radio|select|range (range needs "unit" field)
- Output ONLY the JSON`

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 5000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const rawText = await apiRes.text()
    if (!apiRes.ok) return res.status(500).json({ error: `Anthropic ${apiRes.status}: ${rawText.slice(0, 300)}` })

    let apiData
    try { apiData = JSON.parse(rawText) }
    catch { return res.status(500).json({ error: 'Could not parse Anthropic response', raw: rawText.slice(0, 200) }) }

    const textBlock = apiData.content?.find(b => b.type === 'text')
    if (!textBlock?.text) {
      return res.status(500).json({
        error: 'No text block found',
        blockTypes: apiData.content?.map(b => b.type),
        stopReason: apiData.stop_reason,
      })
    }

    let txt = textBlock.text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const s = txt.indexOf('{')
    const e = txt.lastIndexOf('}')
    if (s === -1 || e === -1) return res.status(500).json({ error: 'No JSON in response', preview: txt.slice(0, 200) })

    let parsed
    try { parsed = JSON.parse(txt.slice(s, e + 1)) }
    catch (err) { return res.status(500).json({ error: `JSON parse: ${err.message}`, preview: txt.slice(s, s + 200) }) }

    const rawCards   = Array.isArray(parsed.cards)  ? parsed.cards  : []
    const rawLinks   = Array.isArray(parsed.links)  ? parsed.links  : []
    const synthesis  = typeof parsed.synthesis === 'string' ? parsed.synthesis : ''

    // Use AI filters if valid, otherwise instant fallback (no extra wait)
    const sidebarFilters = (Array.isArray(parsed.sidebarFilters) && parsed.sidebarFilters.length > 0)
      ? parsed.sidebarFilters
      : fallbackFilters

    const typeMap = { videos:'video', images:'image', news:'news', forums:'forum', shopping:'shopping' }

    const cards = []
    if (synthesis) {
      cards.push({
        id: 'synthesis-0', rank: 0, type: 'article',
        title: `Summary: ${query.slice(0, 55)}${query.length > 55 ? '…' : ''}`,
        url: '', snippet: synthesis, tags: ['AI summary'],
      })
    }
    rawCards.slice(0, 20).forEach((r, i) => {
      cards.push({
        id: `web-${i}`, rank: i + 1, type: typeMap[searchMode] || 'article',
        title: r.title ?? 'Untitled', url: r.url ?? '', snippet: r.snippet ?? '',
        tags: Array.isArray(r.tags) ? r.tags : [],
        price: r.price, rating: typeof r.rating === 'number' ? r.rating : undefined,
        outlet: r.outlet, publishedAt: r.publishedAt,
        forum: r.forum, upvotes: r.upvotes, replies: r.replies,
        videoChannel: r.videoChannel, videoDuration: r.videoDuration,
        imageUrl: r.imageUrl,
      })
    })

    // Extra results as hyperlinks below cards
    const links = rawLinks.slice(0, 20).map((r, i) => ({
      id: `link-${i}`, rank: cards.length + i + 1,
      title: r.title ?? 'Untitled', url: r.url ?? '', snippet: r.snippet ?? '',
    }))

    return res.status(200).json({ cards, links, sidebarFilters, topic: parsed.topic || topic })

  } catch (err) {
    return res.status(500).json({ error: `Error: ${String(err)}` })
  }
}
