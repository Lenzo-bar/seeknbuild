// api/search.js — SeekNBuild v4
export const config = { runtime: 'edge' }

function buildPrompt(query, searchMode, subMode) {
  const modeHints = {
    all:           'Return a broad mix of web results.',
    news:          'Focus on recent news articles. Add "publishedAt" and "outlet" fields.',
    images:        'Focus on image results. Add "imageUrl" field per card.',
    videos:        'Focus on video results. Add "videoChannel" and "videoDuration" fields.',
    forums:        'Focus on forum/community posts. Add "forum", "upvotes", "replies" fields.',
    shopping:      'Focus on products/shopping. Add "price" and "rating" fields.',
    entertainment: 'Focus on movies, shows, music, games.',
    sports:        'Focus on sports scores, stats, news.',
    hobby:         'Focus on tutorials, guides, communities.',
  }
  const hint = modeHints[searchMode] || modeHints.all
  const sub = subMode ? ` Sub-category: ${subMode}.` : ''

  const sidebarExamples = {
    'real-estate': '[{"id":"price","label":"Price Range","type":"range","unit":"$"},{"id":"beds","label":"Bedrooms","type":"radio","options":["Any","1","2","3","4","5+"]},{"id":"type","label":"Property Type","type":"checkboxes","options":["House","Condo","Townhouse","Land"]},{"id":"listing","label":"Listing Type","type":"radio","options":["For Sale","For Rent"]}]',
    'automotive':  '[{"id":"make","label":"Make","type":"checkboxes","options":["Toyota","Honda","Ford","Chevrolet","BMW"]},{"id":"year","label":"Year Range","type":"range","unit":""},{"id":"price","label":"Price","type":"range","unit":"$"},{"id":"condition","label":"Condition","type":"radio","options":["New","Used","Certified Pre-Owned"]}]',
    'shopping':    '[{"id":"price","label":"Price Range","type":"range","unit":"$"},{"id":"rating","label":"Min Rating","type":"radio","options":["Any","3+ stars","4+ stars","4.5+ stars"]},{"id":"avail","label":"Availability","type":"radio","options":["Any","In Stock"]}]',
    'sports':      '[{"id":"league","label":"League","type":"checkboxes","options":["NBA","NFL","NHL","MLB","MLS"]},{"id":"date","label":"Date","type":"select","options":["Today","This week","This month"]}]',
    'news':        '[{"id":"date","label":"Date","type":"select","options":["Past hour","Today","This week","This month"]},{"id":"source","label":"Source Type","type":"checkboxes","options":["News","Blog","Official","Video"]}]',
    'general':     '[{"id":"type","label":"Content Type","type":"checkboxes","options":["Article","Video","Forum","Official","Blog"]},{"id":"date","label":"Date","type":"select","options":["Any time","Past week","Past month","Past year"]}]',
  }

  return `You are a web search assistant. Search for: "${query}"
Mode: ${searchMode}.${sub} ${hint}

IMPORTANT: Respond with ONLY a valid JSON object. No explanation, no markdown, no code fences. Start your response with { and end with }.

{
  "synthesis": "2-3 sentence answer to the query",
  "topic": "choose one: general|real-estate|automotive|shopping|sports|news|entertainment|hobby|tech|health|travel|finance",
  "cards": [
    {
      "title": "Page or result title",
      "url": "https://example.com",
      "snippet": "Brief description of this result",
      "tags": ["tag1","tag2"]
    }
  ],
  "sidebarFilters": ${sidebarExamples[searchMode] || sidebarExamples.general}
}

Rules:
- cards: 8-15 real results relevant to "${query}". Match the search mode type.
- sidebarFilters: generate filters relevant to the query topic. Use the topic field to guide this.
  For real-estate queries, use real-estate filters. For car queries, use automotive filters. Etc.
- Every string must use double quotes. No trailing commas.
- Output ONLY the JSON. Nothing before the opening brace. Nothing after the closing brace.`
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body
  try { body = await req.json() }
  catch { return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } }) }

  const { query, searchMode = 'all', subMode = '' } = body
  if (!query?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing query' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Vercel Environment Variables' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: buildPrompt(query, searchMode, subMode) }]
      })
    })

    const raw = await anthropicRes.text()

    if (!anthropicRes.ok) {
      return new Response(JSON.stringify({ error: `Anthropic ${anthropicRes.status}: ${raw.slice(0, 300)}` }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    let anthropicData
    try { anthropicData = JSON.parse(raw) }
    catch { return new Response(JSON.stringify({ error: 'Could not parse Anthropic response', raw: raw.slice(0, 200) }), { status: 500, headers: { 'Content-Type': 'application/json' } }) }

    // Find the text block — Claude may return tool_use + text blocks
    const textBlock = anthropicData.content?.find(b => b.type === 'text')
    if (!textBlock?.text) {
      const types = anthropicData.content?.map(b => b.type).join(', ')
      return new Response(JSON.stringify({ error: `No text block found. Block types: ${types}`, stop_reason: anthropicData.stop_reason }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    // Clean and parse the JSON
    let jsonText = textBlock.text.trim()
    // Strip markdown fences if present
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    // Find the JSON object boundaries
    const start = jsonText.indexOf('{')
    const end   = jsonText.lastIndexOf('}')
    if (start === -1 || end === -1) {
      return new Response(JSON.stringify({ error: 'No JSON object found in response', preview: jsonText.slice(0, 200) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
    jsonText = jsonText.slice(start, end + 1)

    let parsed
    try { parsed = JSON.parse(jsonText) }
    catch (e) {
      return new Response(JSON.stringify({ error: `JSON parse failed: ${e.message}`, preview: jsonText.slice(0, 300) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    const rawCards       = Array.isArray(parsed.cards)          ? parsed.cards          : []
    const synthesis      = typeof parsed.synthesis === 'string' ? parsed.synthesis      : ''
    const sidebarFilters = Array.isArray(parsed.sidebarFilters) ? parsed.sidebarFilters : []

    const cards = []
    if (synthesis) {
      cards.push({
        id: 'synthesis-0', rank: 0, type: 'article',
        title: `Summary: ${query.slice(0, 55)}${query.length > 55 ? '…' : ''}`,
        url: '', snippet: synthesis, tags: ['AI summary'],
      })
    }

    rawCards.slice(0, 20).forEach((r, i) => {
      const typeMap = { videos: 'video', images: 'image', news: 'news', forums: 'forum', shopping: 'shopping' }
      cards.push({
        id: `web-${i}`, rank: i + 1,
        type: typeMap[searchMode] || 'article',
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
        rating:        typeof r.rating === 'number' ? r.rating : undefined,
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
    return new Response(JSON.stringify({ error: `Handler error: ${String(err)}` }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
