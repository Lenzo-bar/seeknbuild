// api/search.js — SeekNBuild v4
export const config = { runtime: 'edge' }

const MODE_INSTRUCTIONS = {
  all:           'Return a broad mix of web results: articles, resources, and reference pages.',
  news:          'Return recent news articles only. Include publishedAt (ISO date or relative like "2h ago") and outlet (news source name) for each card.',
  images:        'Return image-focused results. For each card include imageUrl (a direct image URL if available), source (page URL), snippet (caption or description).',
  videos:        'Return video results only. For each card include videoChannel (creator/channel name), videoDuration (e.g. "12:34"), and a good snippet description.',
  forums:        'Return forum and community discussion results (Reddit, Stack Overflow, Quora, HN etc). Include forum (site name), upvotes (number), replies (number) per card.',
  shopping:      'Return product and shopping results. Include price (string like "$49.99") and rating (number 1.0–5.0) per card.',
  entertainment: 'Return entertainment results: movies, shows, music, books, games, events.',
  sports:        'Return sports results: scores, stats, player news, team info, schedules.',
  hobby:         'Return hobby-focused results: tutorials, communities, product guides, expert tips.',
}

function modeExtraFields(searchMode) {
  return {
    news:     '"publishedAt": "2h ago", "outlet": "Source Name",',
    images:   '"imageUrl": "https://example.com/image.jpg",',
    videos:   '"videoChannel": "Channel Name", "videoDuration": "12:34",',
    forums:   '"forum": "Reddit", "upvotes": 42, "replies": 17,',
    shopping: '"price": "$49.99", "rating": 4.5,',
  }[searchMode] || ''
}

function buildPrompt(query, searchMode, subMode) {
  const hint = subMode
    ? `${MODE_INSTRUCTIONS[searchMode] || ''} Focus specifically on: ${subMode}.`
    : (MODE_INSTRUCTIONS[searchMode] || MODE_INSTRUCTIONS.all)

  const extra = modeExtraFields(searchMode)

  return `Search the web for: "${query}"
Search mode: ${searchMode}${subMode ? ` > ${subMode}` : ''}
Instruction: ${hint}

Return ONLY a raw JSON object — no markdown fences, no extra text — in exactly this format:
{
  "synthesis": "2-3 sentence direct answer based on what you found.",
  "topic": "one of: general|math|science|tech|real-estate|automotive|health|finance|travel|cooking|sports|news|shopping|entertainment|hobby",
  "cards": [
    {
      "title": "Result title",
      "url": "https://actual-url.com",
      "snippet": "1-2 sentence description of this result.",
      ${extra}
      "tags": ["tag1", "tag2"]
    }
  ],
  "sidebarFilters": [
    {
      "id": "filter_id",
      "label": "Filter Label",
      "type": "checkboxes",
      "options": ["Option A", "Option B", "Option C", "Option D"]
    }
  ]
}

RULES:
- synthesis: 2-3 factual sentences directly answering the query
- topic: single best matching category from the list
- cards: up to 20 results, most relevant first, matching the search mode type
- sidebarFilters: generate 3-6 DYNAMIC filters specific to this search domain:
    * Real estate search → Price Range (range, unit: "$"), Bedrooms (radio: 1,2,3,4,5+), Property Type (checkboxes: House,Condo,Townhouse,Land), For Sale/Rent (radio)
    * Car search → Make/Brand (checkboxes), Year Range (range), Price (range, unit: "$"), Condition (radio: New,Used), Transmission (radio)
    * Math/education → Difficulty (radio: Beginner,Intermediate,Advanced), Topic Area (checkboxes), Format (checkboxes: Video,Article,Interactive)
    * News → Date Range (select: Today,This week,This month), Source Type (checkboxes), Region (select)
    * Shopping → Price Range (range, unit: "$"), Rating (radio: 4+,3+,Any), Brand (checkboxes), Availability (radio)
    * Sports → League (checkboxes), Team (select), Date (select)
    * General → format filters based on the domain of the query
- sidebarFilters type must be one of: "checkboxes" | "radio" | "select" | "range"
- For "range" type, include "unit" field (e.g. "$", "km", "sqft")
- Return ONLY the raw JSON with no markdown, no preamble, no explanation`
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

  if (!query || typeof query !== 'string' || !query.trim()) {
    return new Response(JSON.stringify({ error: 'Missing query' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const ANTHROPIC_KEY = process.env.VITE_ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
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
        max_tokens: 5000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: buildPrompt(query, searchMode, subMode) }]
      })
    })

    const responseText = await response.text()

    if (!response.ok) {
      // Surface the real Anthropic error so we can debug
      return new Response(JSON.stringify({ error: `Anthropic API error ${response.status}: ${responseText.slice(0, 400)}` }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    let data
    try { data = JSON.parse(responseText) } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse Anthropic response' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    const textBlock = data.content?.find((b) => b.type === 'text')
    if (!textBlock?.text) {
      return new Response(JSON.stringify({ error: 'No text block in Claude response', raw: data }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    const clean = textBlock.text
      .replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```\s*$/im, '').trim()

    let parsed
    try { parsed = JSON.parse(clean) } catch (e) {
      return new Response(JSON.stringify({ error: 'Claude response was not valid JSON', raw: clean.slice(0, 300) }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    const rawCards       = Array.isArray(parsed.cards)          ? parsed.cards          : []
    const synthesis      = typeof parsed.synthesis === 'string' ? parsed.synthesis      : ''
    const sidebarFilters = Array.isArray(parsed.sidebarFilters) ? parsed.sidebarFilters : []
    const topic          = parsed.topic || 'general'

    const cards = []
    if (synthesis) {
      cards.push({
        id: 'llm-synthesis', rank: 0, type: 'llm',
        title: `AI synthesis: ${query.slice(0, 55)}${query.length > 55 ? '…' : ''}`,
        url: '', snippet: synthesis, tags: ['AI synthesis'],
      })
    }

    rawCards.slice(0, 20).forEach((r, i) => {
      const type = searchMode === 'videos'   ? 'video'
                 : searchMode === 'images'   ? 'image'
                 : searchMode === 'news'     ? 'news'
                 : searchMode === 'forums'   ? 'forum'
                 : searchMode === 'shopping' ? 'shopping'
                 : 'article'
      cards.push({
        id: `web-${i}`, rank: i + 1, type,
        title:         r.title         ?? 'Untitled',
        url:           r.url           ?? '',
        snippet:       r.snippet       ?? '',
        tags:          Array.isArray(r.tags) ? r.tags : ['web'],
        imageUrl:      r.imageUrl      ?? undefined,
        videoChannel:  r.videoChannel  ?? undefined,
        videoDuration: r.videoDuration ?? undefined,
        publishedAt:   r.publishedAt   ?? undefined,
        outlet:        r.outlet        ?? undefined,
        price:         r.price         ?? undefined,
        rating:        r.rating        ?? undefined,
        upvotes:       r.upvotes       ?? undefined,
        replies:       r.replies       ?? undefined,
        forum:         r.forum         ?? undefined,
      })
    })

    const links = rawCards.slice(20).map((r, i) => ({
      id: `link-${i}`, rank: 21 + i,
      title: r.title ?? 'Untitled', url: r.url ?? '', snippet: r.snippet ?? '',
    }))

    return new Response(JSON.stringify({ cards, links, sidebarFilters, topic }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
