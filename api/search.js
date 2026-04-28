// api/search.js — SeekNBuild v4
// Standard Node.js serverless (NOT edge) — avoids Vercel edge boot errors

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query, searchMode = 'all', subMode = '' } = req.body || {}
  if (!query?.trim()) return res.status(400).json({ error: 'Missing query' })

  const KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel Environment Variables' })

  const defaultFilters = {
    'real-estate': [
      { id: 'price',   label: 'Price Range',    type: 'range',       unit: '$' },
      { id: 'beds',    label: 'Bedrooms',        type: 'radio',       options: ['Any','1','2','3','4','5+'] },
      { id: 'type',    label: 'Property Type',   type: 'checkboxes',  options: ['House','Condo','Townhouse','Land'] },
      { id: 'listing', label: 'Listing Type',    type: 'radio',       options: ['For Sale','For Rent'] },
    ],
    automotive: [
      { id: 'make',  label: 'Make',        type: 'checkboxes', options: ['Toyota','Honda','Ford','Chevrolet','BMW','Hyundai'] },
      { id: 'year',  label: 'Year Range',  type: 'range',      unit: '' },
      { id: 'price', label: 'Price',       type: 'range',      unit: '$' },
      { id: 'cond',  label: 'Condition',   type: 'radio',      options: ['New','Used','Certified Pre-Owned'] },
    ],
    shopping: [
      { id: 'price',  label: 'Price Range', type: 'range', unit: '$' },
      { id: 'rating', label: 'Min Rating',  type: 'radio', options: ['Any','3+ stars','4+ stars','4.5+ stars'] },
      { id: 'avail',  label: 'In Stock',    type: 'radio', options: ['Any','In Stock Only'] },
    ],
    sports: [
      { id: 'league', label: 'League', type: 'checkboxes', options: ['NBA','NFL','NHL','MLB','MLS','EPL'] },
      { id: 'date',   label: 'Date',   type: 'select',     options: ['Today','This week','This month'] },
    ],
    news: [
      { id: 'date',   label: 'Date',        type: 'select',     options: ['Past hour','Today','This week','This month'] },
      { id: 'source', label: 'Source Type', type: 'checkboxes', options: ['News','Blog','Official','Video'] },
    ],
    general: [
      { id: 'ctype', label: 'Content Type', type: 'checkboxes', options: ['Article','Video','Forum','Official','Blog'] },
      { id: 'date',  label: 'Date',         type: 'select',     options: ['Any time','Past week','Past month','Past year'] },
    ],
  }

  const modeHint = {
    all:           'Return a broad mix of web results.',
    news:          'Return recent news articles. Add publishedAt and outlet fields per card.',
    images:        'Return image results. Add imageUrl per card.',
    videos:        'Return video results. Add videoChannel and videoDuration per card.',
    forums:        'Return forum posts. Add forum, upvotes, replies per card.',
    shopping:      'Return product results. Add price and rating per card.',
    entertainment: 'Return entertainment results: movies, shows, music, games.',
    sports:        'Return sports scores, stats, player news.',
    hobby:         'Return hobby tutorials, guides, communities.',
  }[searchMode] || 'Return a broad mix of web results.'

  const prompt = `Search the web for: "${query}"
Mode: ${searchMode}${subMode ? ` > ${subMode}` : ''}. ${modeHint}

Respond with ONLY a valid JSON object. No markdown. No explanation. Start with { end with }.

{
  "synthesis": "2-3 sentence answer based on search results",
  "topic": "one of: general|real-estate|automotive|shopping|sports|news|entertainment|hobby|tech|health|travel|finance",
  "cards": [
    {"title":"...","url":"https://...","snippet":"...","tags":["tag1"]}
  ],
  "sidebarFilters": [
    {"id":"filter_id","label":"Filter Label","type":"checkboxes","options":["A","B","C"]}
  ]
}

Rules:
- Return 8-15 real cards relevant to "${query}"
- sidebarFilters: generate 3-5 filters specific to the topic (real-estate, automotive, shopping, etc.)
- For range type add "unit" field (e.g. "$")
- Output ONLY the JSON object. Nothing else.`

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
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const rawText = await apiRes.text()
    if (!apiRes.ok) {
      return res.status(500).json({ error: `Anthropic ${apiRes.status}: ${rawText.slice(0, 300)}` })
    }

    let apiData
    try { apiData = JSON.parse(rawText) }
    catch { return res.status(500).json({ error: 'Could not parse Anthropic response', raw: rawText.slice(0, 200) }) }

    // Find text block (Claude returns tool_use + text blocks)
    const textBlock = apiData.content?.find(b => b.type === 'text')
    if (!textBlock?.text) {
      return res.status(500).json({
        error: 'No text block in Anthropic response',
        blockTypes: apiData.content?.map(b => b.type),
        stopReason: apiData.stop_reason,
      })
    }

    // Extract JSON from text — handle any surrounding text or fences
    let txt = textBlock.text.trim()
    txt = txt.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const s = txt.indexOf('{')
    const e = txt.lastIndexOf('}')
    if (s === -1 || e === -1) {
      return res.status(500).json({ error: 'No JSON object in response', preview: txt.slice(0, 200) })
    }

    let parsed
    try { parsed = JSON.parse(txt.slice(s, e + 1)) }
    catch (err) { return res.status(500).json({ error: `JSON parse error: ${err.message}`, preview: txt.slice(s, s + 200) }) }

    const rawCards  = Array.isArray(parsed.cards) ? parsed.cards : []
    const synthesis = typeof parsed.synthesis === 'string' ? parsed.synthesis : ''
    const topic     = parsed.topic || 'general'

    // Use AI-generated sidebar filters, fall back to topic-based defaults
    const aiFilters = Array.isArray(parsed.sidebarFilters) && parsed.sidebarFilters.length > 0
      ? parsed.sidebarFilters
      : (defaultFilters[topic] || defaultFilters.general)

    const cards = []
    if (synthesis) {
      cards.push({
        id: 'synthesis-0', rank: 0, type: 'article',
        title: `Summary: ${query.slice(0, 55)}${query.length > 55 ? '…' : ''}`,
        url: '', snippet: synthesis, tags: ['AI summary'],
      })
    }

    const typeMap = { videos: 'video', images: 'image', news: 'news', forums: 'forum', shopping: 'shopping' }
    rawCards.slice(0, 20).forEach((r, i) => {
      cards.push({
        id: `web-${i}`, rank: i + 1, type: typeMap[searchMode] || 'article',
        title: r.title ?? 'Untitled', url: r.url ?? '', snippet: r.snippet ?? '',
        tags: Array.isArray(r.tags) ? r.tags : [],
        imageUrl: r.imageUrl, videoChannel: r.videoChannel, videoDuration: r.videoDuration,
        publishedAt: r.publishedAt, outlet: r.outlet,
        price: r.price, rating: typeof r.rating === 'number' ? r.rating : undefined,
        upvotes: r.upvotes, replies: r.replies, forum: r.forum,
      })
    })

    const links = rawCards.slice(20).map((r, i) => ({
      id: `link-${i}`, rank: 21 + i,
      title: r.title ?? 'Untitled', url: r.url ?? '', snippet: r.snippet ?? '',
    }))

    return res.status(200).json({ cards, links, sidebarFilters: aiFilters, topic })

  } catch (err) {
    return res.status(500).json({ error: `Unexpected error: ${String(err)}` })
  }
}
