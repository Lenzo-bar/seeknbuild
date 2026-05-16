// api/search.js — SeekNBuild v5.2
// Adds: summaryTable (AI-generated, topic-adaptive) + cardGroups (AI-suggested groupings)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const { query, searchMode = 'all', subMode = '', previousSummary = '' } = req.body || {}
  if (!query?.trim()) return res.status(400).json({ error: 'Missing query' })

  const BRAVE_KEY    = process.env.BRAVE_API_KEY
  const OLLAMA_URL   = process.env.OLLAMA_URL    || 'http://localhost:11434'
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL  || 'gemma3'
  const USE_CLAUDE   = process.env.USE_CLAUDE    === 'true'
  const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY

  if (!BRAVE_KEY) return res.status(500).json({ error: 'BRAVE_API_KEY not set in environment' })
  if (!USE_CLAUDE && !OLLAMA_URL) return res.status(500).json({ error: 'OLLAMA_URL not set' })
  if (USE_CLAUDE && !CLAUDE_KEY) return res.status(500).json({ error: 'USE_CLAUDE=true but ANTHROPIC_API_KEY not set' })

  // Guard: stop processing if client disconnects mid-request.
  // Prevents UV_HANDLE_CLOSING assertion crash on Windows when the user
  // switches modes while a long-running Brave+Claude request is in flight.
  let clientGone = false
  req.on('close', () => { clientGone = true })

  function detectTopic(q) {
    q = q.toLowerCase()
    if (/house|home|condo|apartment|rent|mortgage|real.?estate|bedroom|property/.test(q)) return 'real-estate'
    if (/car|truck|suv|toyota|honda|ford|chevrolet|bmw|auto|vehicle|dealership/.test(q)) return 'automotive'
    if (/buy|shop|price|deal|discount|amazon|product/.test(q)) return 'shopping'
    if (/nba|nfl|nhl|mlb|soccer|football|basketball|baseball|hockey|sport|score/.test(q)) return 'sports'
    if (/news|breaking|latest|headline/.test(q)) return 'news'
    if (/weather|forecast|temperature|rain|snow|sunny|cloudy|humidity|wind/.test(q)) return 'weather'
    return 'general'
  }

  const FALLBACK_FILTERS = {
    'real-estate': [
      { id: 'price', label: 'Price Range', type: 'range', unit: '$' },
      { id: 'beds',  label: 'Bedrooms',    type: 'radio', options: ['Any','1','2','3','4','5+'] },
      { id: 'type',  label: 'Property Type', type: 'checkboxes', options: ['House','Condo','Townhouse','Land'] },
    ],
    automotive: [
      { id: 'make',  label: 'Make',       type: 'checkboxes', options: ['Toyota','Honda','Ford','Chevrolet','BMW'] },
      { id: 'year',  label: 'Year Range', type: 'range',      unit: '' },
      { id: 'price', label: 'Price',      type: 'range',      unit: '$' },
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
    weather: [
      { id: 'location', label: 'Location', type: 'checkboxes', options: [] },
      { id: 'condition',label: 'Condition',type: 'checkboxes', options: ['Sunny','Cloudy','Rain','Snow'] },
    ],
    general: [
      { id: 'ctype', label: 'Content Type', type: 'checkboxes', options: ['Article','Video','Forum','Blog'] },
      { id: 'date',  label: 'Date',         type: 'select',     options: ['Any time','Past week','Past month'] },
    ],
  }

  const topic           = detectTopic(query)
  const fallbackFilters = FALLBACK_FILTERS[topic] || FALLBACK_FILTERS.general

  // ── STEP 1: Brave Search ──────────────────────────────────────────────────
  let braveResults = []
  try {
    const params = new URLSearchParams({ q: query, count: '20', search_lang: 'en', country: 'US', safesearch: 'moderate' })
    const resultFilter = { news:'news', videos:'videos', images:'images', forums:'discussions', shopping:'products' }[searchMode]
    if (resultFilter) params.set('result_filter', resultFilter)

    const braveRes = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { 'Accept':'application/json', 'Accept-Encoding':'gzip', 'X-Subscription-Token': BRAVE_KEY },
    })
    if (!braveRes.ok) {
      console.error(`Brave API error ${braveRes.status}:`, await braveRes.text().catch(() => ''))
    } else {
      const d = await braveRes.json()
      braveResults = [
        ...(d.web?.results    || []).map(r => ({ title:r.title, url:r.url, snippet:r.description||'', type:'article', source:r.profile?.name||'', publishedAt:r.age||'' })),
        ...(d.news?.results   || []).map(r => ({ title:r.title, url:r.url, snippet:r.description||'', type:'news',    source:r.source||'', publishedAt:r.age||'', outlet:r.source })),
        ...(d.videos?.results || []).map(r => ({ title:r.title, url:r.url, snippet:r.description||'', type:'video',  source:r.publisher||'', videoChannel:r.publisher, videoDuration:r.duration||'' })),
      ].slice(0, 20)
    }
  } catch (err) { console.error('Brave Search failed:', err) }

  // Client left while Brave was fetching
  if (clientGone) return

  // ── STEP 2: Build prompt ──────────────────────────────────────────────────
  const modeHint = { all:'broad mix', news:'recent news', images:'images', videos:'videos', forums:'forum posts', shopping:'products', entertainment:'entertainment', sports:'sports', hobby:'hobby guides' }[searchMode] || 'broad mix'
  const searchContext = braveResults.length > 0
    ? `\n\nSearch results:\n${braveResults.map((r,i) => `[${i+1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n')}`
    : '\n\n(No live results — use training knowledge.)'

  const hasPrior = previousSummary.trim().length > 0
  const summaryContext = hasPrior ? `\n\nPrevious summary (incorporate):\n"${previousSummary.trim()}"` : ''
  const synthesisRule  = hasPrior
    ? '"synthesis":"3-5 sentence updated cumulative summary combining all searches."'
    : '"synthesis":"2-3 sentence direct answer from results."'

  const prompt = `Search: "${query}" Mode: ${modeHint}.${summaryContext}${searchContext}

Return ONLY this JSON (no markdown):
{
  ${synthesisRule},
  "topic":"general|real-estate|automotive|shopping|sports|news|entertainment|weather|tech|health|travel|finance",
  "cards":[{"title":"","url":"","snippet":"","tags":[],"groupValues":{}}],
  "links":[{"title":"","url":"","snippet":""}],
  "sidebarFilters":[{"id":"","label":"","type":"checkboxes","options":[]}],
  "summaryTable":null,
  "cardGroups":[]
}

summaryTable rules:
- null if no structured comparison is useful.
- If topic has comparable data (weather/prices/specs/stats), use:
  {"headers":["col1","col2"],"rows":[["val","val"]],"icons":{"condition":"icon-name"}}
- Weather icons map: Sunny->sun, Partly cloudy->cloud-sun, Rain->cloud-rain, Snow->snowflake, Cloudy->cloud, Storm->cloud-bolt
- Condition chips: Cool/Cold->blue, Mild->green, Warm/Hot->amber
- For shopping: headers=[Product,Price,Rating,Brand]. For sports: headers=[Team,W,L,Pts]. For real-estate: headers=[Address,Price,Beds,Sqft].

cardGroups rules:
- 2-4 groups based on this search. Each: {"id":"","label":"By ...","description":"","subItems":["",""],"cardKeyword":""}
- Weather example: By location (cities), By condition (sunny/rain/snow), By temperature range
- Shopping example: By price range, By brand, By rating
- Each card's groupValues should map groupId->subItem value so cards can be bucketed into piles.

Cards rules:
- 20 cards with groupValues filled: e.g. {"location":"Paris","condition":"Sunny","tempRange":"Mild"}
- links: 10 lighter results
- sidebarFilters: 3-5 relevant filters
- Output ONLY the JSON. Nothing else.`

  // ── STEP 3: LLM ──────────────────────────────────────────────────────────
  let parsed
  try {
    // Client may have left during prompt building
    if (clientGone) return

    if (USE_CLAUDE) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':CLAUDE_KEY,'anthropic-version':'2023-06-01'},
        body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:8000, messages:[{role:'user',content:prompt}] }),
      })

      if (clientGone) return

      if (!r.ok) return res.status(500).json({ error:`Claude ${r.status}: ${(await r.text()).slice(0,300)}` })
      const d  = await r.json()

      if (clientGone) return

      const tb = d.content?.find(b => b.type==='text')
      if (!tb?.text) return res.status(500).json({ error:'No text block in Claude response' })
      parsed = extractJSON(tb.text)
    } else {
      const r = await fetch(`${OLLAMA_URL}/api/chat`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model: OLLAMA_MODEL, stream:false,
          options:{ temperature:0.1, num_ctx:2048 },
          messages:[
            {role:'system',content:'Reply only with valid JSON. No markdown.'},
            {role:'user',content:prompt},
          ],
        }),
      })

      if (clientGone) return

      if (!r.ok) return res.status(500).json({ error:`Ollama ${r.status}: ${(await r.text()).slice(0,300)}` })
      const d    = await r.json()

      if (clientGone) return

      const text = d.message?.content || d.response || ''
      if (!text)  return res.status(500).json({ error:'Empty Ollama response' })
      parsed = extractJSON(text)
    }
  } catch (err) {
    if (clientGone) return
    return res.status(500).json({ error:`LLM failed: ${String(err)}` })
  }

  if (clientGone) return
  if (!parsed) return res.status(500).json({ error:'Could not extract JSON from LLM response.' })

  // ── STEP 4: Normalize ─────────────────────────────────────────────────────
  const rawCards  = Array.isArray(parsed.cards)  ? parsed.cards  : []
  const rawLinks  = Array.isArray(parsed.links)  ? parsed.links  : []
  const synthesis = typeof parsed.synthesis === 'string' ? parsed.synthesis : ''

  const rawFilters = (Array.isArray(parsed.sidebarFilters) && parsed.sidebarFilters.length > 0)
    ? parsed.sidebarFilters : fallbackFilters

  const sidebarFilters = rawFilters.map(f => ({
    ...f,
    options: Array.isArray(f.options)
      ? f.options.map(o => typeof o==='string' ? o : typeof o==='object' && o ? (o.label||o.value||String(o)) : String(o))
      : [],
  }))

  const summaryTable = (
    parsed.summaryTable &&
    typeof parsed.summaryTable === 'object' &&
    Array.isArray(parsed.summaryTable.headers) &&
    Array.isArray(parsed.summaryTable.rows)
  ) ? parsed.summaryTable : null

  const cardGroups = Array.isArray(parsed.cardGroups) ? parsed.cardGroups : []

  const typeMap = { videos:'video', images:'image', news:'news', forums:'forum', shopping:'shopping' }
  const cards   = []

  if (synthesis) {
    cards.push({
      id:'synthesis-0', rank:0, type:'article',
      title:`Summary: ${query.slice(0,55)}${query.length>55?'…':''}`,
      url:'', snippet:synthesis, tags:['AI summary'], groupValues:{},
    })
  }

  rawCards.slice(0, 10).forEach((r, i) => {
    const brave = braveResults[i]
    cards.push({
      id:            `web-${i}`,
      rank:          i + 1,
      type:          typeMap[searchMode] || brave?.type || 'article',
      title:         r.title         ?? brave?.title   ?? 'Untitled',
      url:           brave?.url      ?? r.url          ?? '',
      snippet:       r.snippet       ?? brave?.snippet ?? '',
      tags:          Array.isArray(r.tags) ? r.tags : [],
      groupValues:   (r.groupValues && typeof r.groupValues === 'object') ? r.groupValues : {},
      price:         r.price,
      rating:        typeof r.rating === 'number' ? r.rating : undefined,
      outlet:        r.outlet        ?? brave?.outlet,
      publishedAt:   r.publishedAt   ?? brave?.publishedAt,
      forum:         r.forum,
      upvotes:       r.upvotes,
      replies:       r.replies,
      videoChannel:  r.videoChannel  ?? brave?.videoChannel,
      videoDuration: r.videoDuration ?? brave?.videoDuration,
      imageUrl:      r.imageUrl,
    })
  })

  const links = rawLinks.slice(0, 20).map((r, i) => ({
    id:`link-${i}`, rank:cards.length+i+1,
    title:r.title??'Untitled', url:r.url??'', snippet:r.snippet??'',
  }))

  if (clientGone) return

  return res.status(200).json({
    cards, links, sidebarFilters,
    topic:  parsed.topic || topic,
    engine: USE_CLAUDE ? 'claude' : `ollama:${OLLAMA_MODEL}`,
    summaryTable,
    cardGroups,
  })
}

function extractJSON(text) {
  const cleaned = text.trim()
    .replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim()
  const s = cleaned.indexOf('{')
  const e = cleaned.lastIndexOf('}')
  if (s===-1||e===-1) return null
  try { return JSON.parse(cleaned.slice(s,e+1)) } catch { return null }
}
