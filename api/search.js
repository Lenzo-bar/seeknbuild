// api/search.js — SeekNBuild v4
// Supports searchMode: all | news | images | videos | forums | shopping | entertainment | sports | hobby
// Also returns dynamic sidebar filter config based on query topic

export const config = { runtime: 'edge' }

const MODE_INSTRUCTIONS = {
  all:           'Return a broad mix of web results: articles, resources, and reference pages.',
  news:          'Return recent news articles only. Include publishedAt (ISO date string) and outlet (news source name) for each card.',
  images:        'Return image results. For each card include: title, imageUrl (a real or plausible image URL), source (page URL), snippet (alt/caption text), tags.',
  videos:        'Return video results only. For each card include: title, source (video URL), videoChannel (channel/creator name), videoDuration (e.g. "12:34"), snippet (description), tags.',
  forums:        'Return forum/community discussion results (Reddit, Stack Overflow, Quora, HN, etc). Include forum (site name), upvotes (number), replies (number) for each card.',
  shopping:      'Return product/shopping results. Include price (string like "$49.99"), rating (number 1-5), source (product URL) for each card.',
  entertainment: 'Return entertainment content: movies, shows, music, books, games, events.',
  sports:        'Return sports-related results: scores, stats, player news, team info, schedules.',
  hobby:         'Return hobby-focused results: tutorials, communities, product guides, tips.',
}

function buildPrompt(query, searchMode, subMode) {
  const modeHint = subMode
    ? `${MODE_INSTRUCTIONS[searchMode] || ''} Focus specifically on the sub-category: ${subMode}.`
    : MODE_INSTRUCTIONS[searchMode] || MODE_INSTRUCTIONS.all

  const extraFields = {
    news:     '"publishedAt": "ISO date or relative like 2h ago", "outlet": "Source Name",',
    images:   '"imageUrl": "https://...",',
    videos:   '"videoChannel": "Channel Name", "videoDuration": "MM:SS",',
    forums:   '"forum": "Site Name", "upvotes": 42, "replies": 17,',
    shopping: '"price": "$XX.XX", "rating": 4.5,',
  }[searchMode] || ''

  return `Search the web for: "${query}"

Mode: ${searchMode}${subMode ? ` / ${subMode}` : ''}
${modeHint}

After searching, return ONLY a JSON object (no markdown, no extra text) in this exact format:
{
  "synthesis": "2-3 sentence direct answer based on search results.",
  "topic": "one of: general|math|science|tech|real-estate|automotive|health|finance|travel|cooking|sports|news|shopping|entertainment|hobby",
  "cards": [
    {
      "title": "...",
      "url": "https://...",
      "snippet": "1-2 sentence description.",
      ${extraFields}
      "tags": ["tag1","tag2"]
    }
  ],
  "sidebarFilters": [
    {
      "id": "unique_id",
      "label": "Filter label",
      "type": "checkboxes",
      "options": ["Option A", "Option B", "Option C"]
    }
  ]
}

Rules:
- synthesis: 2-3 factual sentences answering the query
- topic: pick the single best matching category
- cards: up to 20 results, most relevant first, matching the search mode
- sidebarFilters: generate 3-5 DYNAMIC filters relevant to this specific search topic
  Examples: for real-estate searches include Price Range, Bedrooms, Property Type
  For car searches include Make, Year Range, Price, Transmission
  For math searches include Difficulty Level, Topic Area, Solution Type
  For news include Date Range, Source Type, Region
  The filters must make sense for this specific query's domain
- Return ONLY the raw JSON, nothing else`
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { query, searchMode = 'all', subMode = '' } = await req.json()

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
        max_tokens: 5000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: buildPrompt(query, searchMode, subMode) }]
      })
    })

    if (!response.ok) {
      const txt = await response.text()
      throw new Error(`Anthropic ${response.status}: ${txt.slice(0, 200)}`)
    }

    const data = await response.json()
    const textBlock = data.content?.find(b => b.type === 'text')
    if (!textBlock?.text) throw new Error('No text in Claude response')

    const clean = textBlock.text
      .replace(/^```json\s*/im, '').replace(/^```\s*/im, '').replace(/```\s*$/im, '').trim()

    let parsed
    try { parsed = JSON.parse(clean) }
    catch { throw new Error('Claude response was not valid JSON') }

    const rawCards      = Array.isArray(parsed.cards) ? parsed.cards : []
    const synthesis     = typeof parsed.synthesis === 'string' ? parsed.synthesis : ''
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
      cards.push({
        id: `web-${i}`, rank: i + 1,
        type: searchMode === 'videos' ? 'video'
            : searchMode === 'images' ? 'image'
            : searchMode === 'news'   ? 'news'
            : searchMode === 'forums' ? 'forum'
            : searchMode === 'shopping' ? 'shopping'
            : 'article',
        title:        r.title        ?? 'Untitled',
        url:          r.url          ?? '',
        snippet:      r.snippet      ?? '',
        tags:         Array.isArray(r.tags) ? r.tags : ['web'],
        imageUrl:     r.imageUrl     ?? undefined,
        videoChannel: r.videoChannel ?? undefined,
        videoDuration:r.videoDuration?? undefined,
        publishedAt:  r.publishedAt  ?? undefined,
        outlet:       r.outlet       ?? undefined,
        price:        r.price        ?? undefined,
        rating:       r.rating       ?? undefined,
        upvotes:      r.upvotes      ?? undefined,
        replies:      r.replies      ?? undefined,
        forum:        r.forum        ?? undefined,
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
