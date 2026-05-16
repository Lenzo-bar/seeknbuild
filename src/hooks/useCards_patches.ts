// ─────────────────────────────────────────────────────────────────────────────
// PATCH A — Replace the entire clientRefine function in useCards.ts
// Find:   const clientRefine = useCallback((chips: ActiveFilterChip[], zone: ...
// Replace with this block (ends at the closing },[]) line):
// ─────────────────────────────────────────────────────────────────────────────

  const clientRefine = useCallback((chips: ActiveFilterChip[], zone: 'all'|'web'|'llm'|'file'|'webonly'|'urls' = 'all') => {
    const t0=Date.now(); setIsFiltering(true)
    const RANGE_IDS=new Set(['price','year','sqft','km','age','beds','baths'])

    // Tag/type aliases — maps sidebar option labels to what might appear in card content
    const CONTENT_TYPE_ALIASES: Record<string,string[]> = {
      'article':   ['article','blog','guide','how-to','tutorial','overview','explained'],
      'video':     ['video','watch','youtube','stream','clip','lecture'],
      'forum':     ['forum','reddit','discussion','thread','community','quora','stackexchange'],
      'blog':      ['blog','post','medium','substack','opinion','personal'],
      'academic':  ['academic','research','paper','study','journal','doi','arxiv','scholar','university','published'],
      'tutorial':  ['tutorial','step-by-step','course','learn','lesson','howto','guide'],
      'news':      ['news','breaking','report','headline','press','wire','cbc','bbc','cnn','reuters'],
      'code':      ['code','github','snippet','repository','npm','pip','package','library','api'],
      'math':      ['math','formula','equation','theorem','proof','calculus','algebra'],
      'summary':   ['summary','overview','tldr','brief','key points'],
      'comparison':['comparison','compare','vs','versus','pros and cons','difference'],
      'explanation':['explanation','what is','how does','why','define','definition','meaning'],
      // difficulty
      'beginner':      ['beginner','intro','introduction','basic','101','getting started','newcomer','beginner-friendly'],
      'intermediate':  ['intermediate','mid-level','moderate','some experience','practical'],
      'advanced':      ['advanced','expert','deep dive','in-depth','comprehensive','sophisticated','complex'],
      // date — map to actual rough signals; date ranges can't be text-matched perfectly
      'today':         ['today','hours ago','just now','breaking','live'],
      'past 24 hours': ['hours ago','today','breaking','live'],
      'past week':     ['days ago','this week','week','recently'],
      'past month':    ['this month','month','recently','last month'],
      'past year':     ['this year','months ago','year','annually'],
      // source
      'news':     ['news'],
      'official': ['official','gov','org','government','ministry','department'],
      // sports
      'nba': ['nba','basketball'], 'nfl': ['nfl','football'],
      'nhl': ['nhl','hockey'],     'mlb': ['mlb','baseball'],
      'mls': ['mls','soccer'],
      // llm
      'claude':     ['claude','anthropic'],
      'chatgpt':    ['chatgpt','openai','gpt'],
      'gemini':     ['gemini','google bard','google ai'],
      'perplexity': ['perplexity'],
      'deepseek':   ['deepseek'],
    }

    function expandValue(raw: string): string[] {
      const key = raw.toLowerCase().trim()
      return CONTENT_TYPE_ALIASES[key] ?? [key]
    }

    function cardMatchesChips<T extends {
      title:string; snippet:string; source?:string; tags?:string[];
      visible:boolean; type?:string; difficulty?:string; outlet?:string;
      videoChannel?:string; forum?:string; cardKind?:string; price?:string;
    }>(card: T, chipList: ActiveFilterChip[]): boolean {
      if (chipList.length === 0) return true

      // Build a rich text bag from all card fields
      const bag = [
        card.title,
        card.snippet,
        card.source ?? '',
        card.type ?? '',
        card.difficulty ?? '',
        card.outlet ?? '',
        card.videoChannel ?? '',
        card.forum ?? '',
        card.cardKind ?? '',
        card.price ?? '',
        ...(card.tags ?? []),
      ].join(' ').toLowerCase()

      for (const chip of chipList) {
        if (RANGE_IDS.has(chip.id)) continue // range chips handled separately

        const candidates = expandValue(chip.value)
        const matched = candidates.some(term => bag.includes(term))
        if (!matched) return false
      }
      return true
    }

    function applyChips<T extends {
      title:string; snippet:string; source?:string; tags?:string[]; visible:boolean;
    }>(cards: T[], chipList: ActiveFilterChip[]): T[] {
      return cards.map(card => ({
        ...card,
        visible: cardMatchesChips(card as any, chipList),
      }))
    }

    setAllWebCards(master => {
      const filtered = applyChips(master, zone==='all'||zone==='web' ? chips : [])
      setWebCards(filtered)
      return master
    })
    if (zone==='all'||zone==='llm')     setLlmCards(prev => applyChips(prev, chips) as any)
    if (zone==='all'||zone==='file')    setFileCards(prev => applyChips(prev, chips) as any)
    if (zone==='all'||zone==='webonly') setWebOnlyCards(prev => applyChips(prev, chips))
    if (zone==='all'||zone==='urls')    setUrlCards(prev => applyChips(prev, chips))
    setFilterTime(Date.now()-t0)
    setTimeout(()=>setIsFiltering(false), 300)
  },[])


// ─────────────────────────────────────────────────────────────────────────────
// PATCH B — Replace the entire addMoreQuestion function in useCards.ts
// Find:   const addMoreQuestion = useCallback(async (question: string) => {
// Replace with this block (ends at }, [questSummary]) line):
// ─────────────────────────────────────────────────────────────────────────────

  const addMoreQuestion = useCallback(async (question: string) => {
    setIsMoreLoading(true); setApiError(null)
    try {
      // ── Step 1: Keyword-filter existing cards immediately (no API wait) ──────
      // Extract meaningful keywords from the sub-question to use as instant filter chips
      const STOP = new Set(['what','that','this','with','from','they','them','their','there',
        'have','will','would','could','should','about','which','when','where','does','more',
        'some','into','than','then','also','been','were','your','most','over','such','just',
        'like','very','even','much','many','both','each','only','after','before','because',
        'show','list','give','tell','find','which','are','the','and','for','that','can',
        'how','why','who','any','all','its','it','is','to','of','in','on','at','by','do'])

      const subKeywords = question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !STOP.has(w))

      // Apply keyword filter to existing web + more cards so the user sees instant narrowing
      if (subKeywords.length > 0) {
        const tempChips: ActiveFilterChip[] = subKeywords.slice(0, 4).map((w, i) => ({
          id: `more-kw-${i}`,
          sectionId: 'more-question',
          label: w,
          value: w,
        }))

        // Filter webCards in-place (same logic as clientRefine but targeting web zone)
        setAllWebCards(master => {
          const filtered = master.map(card => {
            const bag = [card.title, card.snippet, ...(card.tags ?? [])].join(' ').toLowerCase()
            const matches = tempChips.every(chip => bag.includes(chip.value))
            return { ...card, visible: matches }
          })
          setWebCards(filtered)
          return master
        })

        // Also filter linkResults so the links zone narrows too
        setLinkResults(prev => prev.map(l => {
          const bag = (l.title + ' ' + l.snippet).toLowerCase()
          const matches = tempChips.every(chip => bag.includes(chip.value))
          return { ...l, _hidden: !matches } as any
        }))
      }

      // ── Step 2: Fetch complementary results for the sub-question ──────────
      // Use the quest context so Claude understands the parent topic
      const contextualQuery = questSummary.trim()
        ? `Quest context: ${questSummary.trim()}\n\nFollow-up question: ${question}`
        : question

      const result = await callSearchAPI(contextualQuery, 'all', '', questSummary)
      const stamp  = Date.now()

      // Replace moreCards with this sub-question's results (not append)
      // Tag them so they're visually distinct from the main results
      const newMoreCards = result.cards
        .filter(c => c.rank !== 0)
        .map((c, i) => ({
          ...c,
          id:   `more-${stamp}-${i}`,
          zone: 'more' as CardZone,
          tags: [`↳ ${question.slice(0, 35)}`, ...(c.tags ?? [])],
        }))

      setMoreCards(newMoreCards)

      // Record to history
      setMoreHistory(prev => [...prev, {
        question,
        timestamp: stamp,
        cardCount: newMoreCards.length,
      }])

      // ── Step 3: Merge new sidebar filter sections (complementary, not replace) ──
      if (result.sidebarFilters?.length > 0) {
        setSidebarFilters(prev => {
          const existingIds = new Set(prev.map(f => f.id))
          const newOnly = result.sidebarFilters.filter(f => !existingIds.has(f.id))
          return newOnly.length > 0 ? [...prev, ...newOnly] : prev
        })
      }

      // Update quest summary with the new synthesis if available
      const synthCard = result.cards.find(c => c.rank === 0)
      if (synthCard?.snippet) setQuestSummary(synthCard.snippet)

    } catch(err) {
      setApiError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsMoreLoading(false)
    }
  }, [questSummary])
