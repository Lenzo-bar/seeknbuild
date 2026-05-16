// api/webonly.js — SeekNBuild v5.3
// Web Only mode: pure Brave Search results, no LLM processing.
// URL Analyzer: fetch pages + Claude summarize/compare/analyze/combine/rewrite.
// Supports extraInstruction for follow-up questions on already-fetched URLs.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const {
    mode             = 'search',    // 'search' | 'urls'
    query            = '',
    urls             = [],
    task             = 'summarize', // 'summarize' | 'compare' | 'analyze' | 'combine' | 'rewrite'
    extraInstruction = '',          // follow-up question for URL re-analysis
  } = req.body || {}

  const BRAVE_KEY  = process.env.BRAVE_API_KEY
  const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY

  // ── MODE: URL Analysis ────────────────────────────────────────────────────
  if (mode === 'urls') {
    if (!urls || urls.length === 0) return res.status(400).json({ error: 'No URLs provided' })
    if (!CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

    // Fetch each URL's content
    const fetched = []
    for (const url of urls.slice(0, 8)) {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeekNBuild/5.3)' },
          signal: AbortSignal.timeout(8000),
        })
        if (!r.ok) { fetched.push({ url, content: '', error: `HTTP ${r.status}` }); continue }
        const html = await r.text()
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 6000)
        fetched.push({ url, content: text })
      } catch (err) {
        fetched.push({ url, content: '', error: String(err) })
      }
    }

    const taskInstructions = {
      summarize: `Summarize each URL independently with key points, then write a combined overview.
                  For each card include: title (page/site name), snippet (2-3 sentence summary), keyPoints (3-5 bullet points), tags.`,
      compare:   `Compare all URLs side-by-side. What do they agree on? What differs? What is unique to each?
                  For each card include: title, snippet (what this source uniquely contributes), keyPoints (key claims or data points), tags.
                  Include a summaryTable comparing them across key dimensions.`,
      analyze:   `Analyze each URL for quality, credibility, depth, bias, and key insights.
                  For each card include: title, snippet (overall assessment), keyPoints (specific strengths/weaknesses/insights), tags.`,
      combine:   `Synthesize all content into a single coherent narrative. Merge overlapping ideas, resolve conflicts, fill gaps.
                  Create one card per major theme or section of the combined synthesis.
                  For each card: title (theme name), snippet (synthesis of that theme), keyPoints (supporting evidence from sources), tags.`,
      rewrite:   `Rewrite and restructure the content from all URLs into clear, well-organized cards.
                  Each card should be a polished, standalone piece of content — rewritten in your own words, better organized than the original.
                  For each card: title (clear heading), snippet (rewritten intro paragraph), keyPoints (rewritten key points as clear statements), tags.
                  The goal is a clean, publishable version of the source material.`,
    }[task] || 'Summarize each URL.'

    // Extra instruction from follow-up "More question"
    const extraNote = extraInstruction.trim()
      ? `\n\nAdditional user instruction — PRIORITIZE THIS above the base task:\n"${extraInstruction.trim()}"\n\nEvery card must directly address this instruction using evidence from the source content.`
      : ''

    const synthesisSuffix = extraInstruction.trim()
      ? `, specifically addressing: "${extraInstruction.trim()}"`
      : ''

    const urlContext = fetched.map((f, i) =>
      `[URL ${i + 1}] ${f.url}\n${f.error ? `Error fetching: ${f.error}` : f.content}`
    ).join('\n\n---\n\n')

    const prompt = `You are analyzing ${fetched.length} URL${fetched.length > 1 ? 's' : ''} for a user.

Task: ${taskInstructions}${extraNote}

Source content:
${urlContext}

Return ONLY this JSON (no markdown, no explanation):
{
  "synthesis": "2-4 sentence overall result — the main takeaway from this ${task} task${synthesisSuffix}",
  "cards": [
    {
      "title": "Card title",
      "url": "source URL this card is based on (empty string if combined/rewritten)",
      "snippet": "2-3 sentence content for this card",
      "tags": ["tag1", "tag2"],
      "keyPoints": ["point 1", "point 2", "point 3"]
    }
  ],
  "summaryTable": null
}

For 'compare' task with multiple URLs, replace summaryTable null with:
{ "headers": ["Aspect", "URL 1 title", "URL 2 title"], "rows": [["Key aspect", "URL1 position", "URL2 position"]] }

Rules:
- Create one card per URL for summarize/analyze/compare tasks
- Create one card per theme for combine/rewrite tasks (may be more than the number of URLs)
- keyPoints must be an array of strings, each a complete sentence
- If an extra instruction was given, make sure every card directly addresses it with specific evidence from the source
- Output ONLY the JSON object`

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 6000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!r.ok) return res.status(500).json({ error: `Claude ${r.status}: ${(await r.text()).slice(0, 300)}` })
      const d  = await r.json()
      const tb = d.content?.find(b => b.type === 'text')
      if (!tb?.text) return res.status(500).json({ error: 'No text from Claude' })
      const parsed = extractJSON(tb.text)
      if (!parsed) return res.status(500).json({ error: 'Could not parse Claude response' })

      const cards = []
      const synthesis = typeof parsed.synthesis === 'string' ? parsed.synthesis : ''
      if (synthesis) {
        const taskLabel = extraInstruction.trim()
          ? `Follow-up: ${extraInstruction.trim().slice(0, 50)}${extraInstruction.length > 50 ? '…' : ''}`
          : `${task.charAt(0).toUpperCase() + task.slice(1)}: ${urls.length} URL${urls.length > 1 ? 's' : ''}`
        cards.push({
          id: `url-0-${Date.now()}`, rank: 0, type: 'article', zone: 'urls',
          title: taskLabel,
          url: '', snippet: synthesis,
          tags: ['URL analysis', task, ...(extraInstruction.trim() ? ['follow-up'] : [])],
          steps: [],
          visible: true, docSelected: false,
        })
      }
      ;(parsed.cards || []).forEach((c, i) => {
        let hostname = 'URL Analysis'
        if (c.url) { try { hostname = new URL(c.url).hostname } catch {} }
        cards.push({
          id:          `url-${i + 1}-${Date.now()}`,
          rank:        i + 1,
          type:        'article',
          zone:        'urls',
          title:       String(c.title || `Result ${i + 1}`),
          url:         String(c.url || ''),
          source:      hostname,
          snippet:     String(c.snippet || ''),
          tags:        Array.isArray(c.tags) ? c.tags : [],
          steps:       Array.isArray(c.keyPoints) ? c.keyPoints : [],
          hasVideo:    false,
          visible:     true,
          docSelected: false,
          groupValues: {
            task,
            domain: hostname,
            followUp: extraInstruction.trim() ? 'yes' : 'no',
          },
        })
      })

      const summaryTable = (parsed.summaryTable?.headers && parsed.summaryTable?.rows)
        ? parsed.summaryTable : null
      return res.status(200).json({ cards, summaryTable, topic: 'url-analysis', engine: 'claude+fetch' })
    } catch (err) {
      return res.status(500).json({ error: `URL analysis failed: ${String(err)}` })
    }
  }

  // ── MODE: Web Only Search (Brave, no LLM) ────────────────────────────────
  if (!query?.trim()) return res.status(400).json({ error: 'Missing query' })
  if (!BRAVE_KEY) return res.status(500).json({ error: 'BRAVE_API_KEY not set' })

  try {
    const params = new URLSearchParams({
      q: query, count: '20', search_lang: 'en', country: 'US', safesearch: 'moderate',
    })
    const braveRes = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': BRAVE_KEY },
    })
    if (!braveRes.ok) {
      const errText = await braveRes.text().catch(() => '')
      return res.status(500).json({ error: `Brave API ${braveRes.status}: ${errText.slice(0, 200)}` })
    }

    const d = await braveRes.json()

    const rawWeb = d.web?.results || []

    const webResults = rawWeb.slice(0, 15).map((r, i) => ({
      id: `webonly-web-${i}`, rank: i + 1, type: 'article', zone: 'webonly',
      title: r.title || 'Untitled', url: r.url || '', source: (() => {
        try { return new URL(r.url).hostname } catch { return r.url }
      })(),
      snippet: r.description || '', tags: [], hasVideo: false,
      outlet: r.profile?.name, publishedAt: r.age || '',
      visible: true, docSelected: false,
      groupValues: { type: 'article', source: r.profile?.name || '' },
    }))

    const newsResults = (d.news?.results || []).slice(0, 5).map((r, i) => ({
      id: `webonly-news-${i}`, rank: i + 1, type: 'news', zone: 'webonly',
      title: r.title || 'Untitled', url: r.url || '',
      source: r.source || '', snippet: r.description || '',
      tags: ['news'], hasVideo: false, outlet: r.source,
      publishedAt: r.age || '', visible: true, docSelected: false,
      groupValues: { type: 'news', source: r.source || '' },
    }))

    const videoResults = (d.videos?.results || []).slice(0, 5).map((r, i) => ({
      id: `webonly-video-${i}`, rank: i + 1, type: 'video', zone: 'webonly',
      title: r.title || 'Untitled', url: r.url || '',
      source: r.publisher || '', snippet: r.description || '',
      tags: ['video'], hasVideo: true,
      videoChannel: r.publisher, videoDuration: r.duration || '',
      visible: true, docSelected: false,
      groupValues: { type: 'video', source: r.publisher || '' },
    }))

    // Brave image search requires a separate API call — use web results with image type hint
    const imageResults = (d.web?.results || [])
      .filter(r => r.extra_snippets?.some(s => /image|photo|picture/i.test(s)) || 
                  /\.(jpg|jpeg|png|gif|webp)/i.test(r.url))
      .slice(0, 4).map((r, i) => ({
        id: `webonly-img-${i}`, rank: i + 1, type: 'article', zone: 'webonly',
        title: r.title || 'Untitled', url: r.url || '',
        source: (() => { try { return new URL(r.url).hostname } catch { return r.url }})(),
        snippet: r.description || '', tags: ['image'],
        hasVideo: false, visible: true, docSelected: false,
        groupValues: { type: 'image', source: '' },
      }))

    const forumResults = (d.web?.results || [])
      .filter(r => /reddit|quora|stackexchange|stackoverflow|forum|community|discuss/i.test(r.url + r.title))
      .slice(0, 4).map((r, i) => ({
        id: `webonly-forum-${i}`, rank: i + 1, type: 'forum', zone: 'webonly',
        title: r.title || 'Untitled', url: r.url || '',
        source: (() => { try { return new URL(r.url).hostname } catch { return r.url }})(),
        snippet: r.description || '', tags: ['forum'],
        hasVideo: false, visible: true, docSelected: false,
        groupValues: { type: 'forum', source: '' },
      }))

    const cards = webResults

    const typedResults = {
      news:   newsResults.map(r => ({ id: r.id, rank: r.rank, title: r.title, url: r.url, snippet: r.snippet, type: 'news' })),
      videos: videoResults.map(r => ({ id: r.id, rank: r.rank, title: r.title, url: r.url, snippet: r.snippet, type: 'video' })),
      images: imageResults.map(r => ({ id: r.id, rank: r.rank, title: r.title, url: r.url, snippet: r.snippet, type: 'image' })),
      forums: forumResults.map(r => ({ id: r.id, rank: r.rank, title: r.title, url: r.url, snippet: r.snippet, type: 'forum' })),
    }

    // overflow links — cards ranked 16+
    const overflowLinks = rawWeb.slice(15).map((r, i) => ({
      id:      `webonly-overflow-${i}`,
      rank:    16 + i,
      title:   r.title || 'Untitled',
      url:     r.url || '',
      snippet: r.description || '',
    }))

    return res.status(200).json({
      cards,
      overflowLinks,
      typedResults,
      links: [], summaryTable: null, cardGroups: [],
      topic: 'general', engine: 'brave-only',
    })

  } catch (err) {
    return res.status(500).json({ error: `Web search failed: ${String(err)}` })
  }
}

function extractJSON(text) {
  const cleaned = text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
  if (s === -1 || e === -1) return null
  try { return JSON.parse(cleaned.slice(s, e + 1)) } catch { return null }
}
