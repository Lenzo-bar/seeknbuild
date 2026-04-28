// api/search.js — SeekNBuild v4
export const config = { runtime: 'edge' }

const MODE_INSTRUCTIONS = {
  all:           'Return a broad mix of web results: articles, resources, and reference pages.',
  news:          'Return recent news articles. Include publishedAt and outlet per card.',
  images:        'Return image-focused results. Include imageUrl per card if available.',
  videos:        'Return video results. Include videoChannel and videoDuration per card.',
  forums:        'Return forum/community results (Reddit, StackOverflow etc). Include forum, upvotes, replies per card.',
  shopping:      'Return product/shopping results. Include price and rating per card.',
  entertainment: 'Return entertainment results: movies, shows, music, games, events.',
  sports:        'Return sports results: scores, stats, player news, schedules.',
  hobby:         'Return hobby tutorials, communities, guides, tips.',
}

function buildPrompt(query, searchMode, subMode) {
  const hint = subMode
    ? `${MODE_INSTRUCTIONS[searchMode] || ''} Focus on sub-category: ${subMode}.`
    : (MODE_INSTRUCTIONS[searchMode] || MODE_INSTRUCTIONS.all)

  const extra = {
    news:     '"publishedAt": "2h ago", "outlet": "CBC News",',
    images:   '"imageUrl": "https://example.com/img.jpg",',
    videos:   '"videoChannel": "Channel Name", "videoDuration": "10:22",',
    forums:   '"forum": "Reddit", "upvotes": 142, "replies": 38,',
    shopping: '"price": "$349,000", "rating": 4.2,',
  }[searchMode] || ''

  return `Search the web for: "${query}"
Mode: ${searchMode}${subMode ? ` > ${subMode}` : ''}
${hint}

Return ONLY a raw JSON object (absolutely no markdown, no backticks, no extra text):
{
  "synthesis": "2-3 sentence direct answer based on what you found.",
  "topic": "pick one: general|math|science|tech|real-estate|automotive|health|finance|travel|cooking|sports|news|shopping|entertainment|hobby",
  "cards": [
    {
      "title": "Result title here",
      "url": "https://real-url.com/page",
      "snippet": "1-2 sentence description of this specific result.",
      ${extra}
      "tags": ["tag1", "tag2"]
    }
  ],
  "sidebarFilters": [
    {
      "id": "unique_snake_case_id",
      "label": "Human Readable Label",
      "type": "checkboxes",
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}

CRITICAL RULES:
- cards: up to 20 real results matching the query and mode. DO NOT return math/calculus content unless the query is about math.
- sidebarFilters: 3-6 filters dynamically tailored to THIS query's domain:
    real-estate → Price Range (range,unit:"$"), Bedrooms (radio,options:["1","2","3","4","5+"]), Property Type (checkboxes,options:["House","Condo","Townhouse","Land"]), Listing Type (radio,options:["For Sale","For Rent"])
    automotive → Make (checkboxes), Year (range), Price (range,unit:"$"), Condition (radio,options:["New","Used","Certified"]), Transmission (radio,options:["Automatic","Manual"])
    shopping → Price Range (range,unit:"$"), Rating (radio,options:["4+ stars","3+ stars","Any"]), Availability (radio,options:["In Stock","Any"])
    sports → League (checkboxes), Date (select,options:["Today","This week","This month"])
    news → Date (select,options:["Past hour","Today","This week"]), Source (checkboxes)
    For "range" type include "unit" field. For "select" type include "options" array.
- Return ONLY the raw JSON. No markdown. No explanation.`
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const { query, searchMode = 'all', subMode = '' } = body

  if (!query?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing query' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Try both env var names — ANTHROPIC_API_KEY (preferred) and VITE_ANTHROPIC_API_KEY (legacy)
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({
      error: 'API key missing. Set ANTHROPIC_API_KEY in Vercel Environment Variables.'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
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
        model: 'claude-sonnet-4-6',
        max_tokens: 5000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: buildPrompt(query, searchMode, subMode) }]
      })
    })

    const responseText = await response.text()

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: `Anthropic ${response.status}: ${responseText.slice(0, 500)}`
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    let data
    try { data = JSON.parse(responseText) } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse Anthropic response' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    const textBlock = data.content?.find(b => b.type === 'text')
    if (!textBlock?.text) {
      return new Response(JSON.stringify({
        error: 'No text in response', contentTypes: data.content?.map(b => b.type)
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    const clean = textBlock.text
      .replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```\s*$/im, '').trim()

    let parsed
    try { parsed = JSON.parse(clean) } catch {
      return new Response(JSON.stringify({
        error: 'Response was not valid JSON', preview: clean.slice(0, 300)
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    const rawCards       = Array.isArray(parsed.cards)          ? parsed.cards          : []
    const synthesis      = typeof parsed.synthesis === 'string' ? parsed.synthesis      : ''
    const sidebarFilters = Array.isArray(parsed.sidebarFilters) ? parsed.sidebarFilters : []

    const cards = []
    if (synthesis) {
      cards.push({
        id: 'llm-synthesis', rank: 0, type: 'article',
        title: `Summary: ${query.slice(0, 60)}${query.length > 60 ? '…' : ''}`,
        url: '', snippet: synthesis, tags: ['AI summary'],
      })
    }

    rawCards.slice(0, 20).forEach((r, i) => {
      const type = { videos:'video', images:'image', news:'news', forums:'forum', shopping:'shopping' }[searchMode] || 'article'
      cards.push({
        id: `web-${i}`, rank: i + 1, type,
        title:         r.title         ?? 'Untitled',
        url:           r.url           ?? '',
        snippet:       r.snippet       ?? '',
        tags:          Array.isArray(r.tags) ? r.tags : [],
        imageUrl:      r.imageUrl,
        videoChannel:  r.videoChannel,
        videoDuration: r.videoDuration,
        publishedAt:   r.publishedAt,
        outlet:        r.outlet,
        price:         r.price,
        rating:        r.rating,
        upvotes:       r.upvotes,
        replies:       r.replies,
        forum:         r.forum,
      })
    })

    const links = rawCards.slice(20).map((r, i) => ({
      id: `link-${i}`, rank: 21 + i,
      title: r.title ?? 'Untitled', url: r.url ?? '', snippet: r.snippet ?? '',
    }))

    return new Response(JSON.stringify({ cards, links, sidebarFilters, topic: parsed.topic || 'general' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
