// ─────────────────────────────────────────────────────────────────────────────
// PATCH C — Fix the dialog trigger condition (Feature A)
//
// FIND this line inside handleSearch():
//   const isDrift = hasAny && sessionTopic && activeChips.length > 0
//
// REPLACE WITH:
//   const isDrift = hasAny && sessionTopic && sidebarFilters.length > 0
//
// Reason: dialog must fire whenever sidebar filters EXIST (populated after first search),
// not only when chips have been applied. Users deserve the YES/NO choice even if they
// haven't checked any boxes yet — the sidebar is already populated and represents context.
// ─────────────────────────────────────────────────────────────────────────────

// OLD:
const isDrift = hasAny && sessionTopic && activeChips.length > 0

// NEW:
const isDrift = hasAny && sessionTopic && sidebarFilters.length > 0


// ─────────────────────────────────────────────────────────────────────────────
// PATCH D — Fix dlgNo() so it actually wipes the sidebar in useCards (Feature A)
//
// FIND the dlgNo function:
//   function dlgNo() {
//     setShowTopicDlg(false); setSameCtxOk(false)
//     setActiveChips([]); setFilterResetKey(k=>k+1)
//     setFilterCat('general'); setLockedTopic(''); clientRefine([])
//     if (pendingSearchAfterTopic) {
//       const { q, m, s } = pendingSearchAfterTopic
//       setPendingSearchAfterTopic(null)
//       if (pendingAppMode === 'llm')         fireLlm(enrichQuery(q))
//       else if (pendingAppMode === 'webonly') fireWebOnly(enrichQuery(q))
//       else freshSearch(q, m, s)
//     }
//   }
//
// REPLACE WITH the version below that passes keepFilters=false explicitly:
// ─────────────────────────────────────────────────────────────────────────────

  function dlgNo() {
    setShowTopicDlg(false); setSameCtxOk(false)
    setActiveChips([]); setFilterResetKey(k=>k+1)
    setFilterCat('general'); setLockedTopic(''); clientRefine([])

    if (pendingSearchAfterTopic) {
      const { q, m, s } = pendingSearchAfterTopic
      setPendingSearchAfterTopic(null)
      if (pendingAppMode === 'llm') {
        fireLlm(enrichQuery(q))
        // Tell useCards to wipe sidebar on next llmSearch — pass keepFilters=false
        // fireLlm() already does keepFilters = hasLlmSearched && sessionHasSearched,
        // so we need to force it. We do this by temporarily resetting hasLlmSearched
        // via a one-shot flag. Simplest fix: add a resetSidebarOnNextLlm ref.
        // ← See PATCH E for the cleaner approach.
      } else if (pendingAppMode === 'webonly') {
        fireWebOnly(enrichQuery(q))
      } else {
        // For Web+LLM: freshSearch with keepFilters explicitly false
        freshSearchForced(q, m, s)
      }
    }
  }

  // ── freshSearchForced: like freshSearch but always passes keepFilters=false ──
  // Add this alongside freshSearch():
  function freshSearchForced(query: string, mode: SearchMode, sub: string) {
    promptHistory.addEntry(query, currentAppMode)
    if (!sessionTopic) setSessionTopic(query)
    setActiveChips([]); setFilterResetKey(k=>k+1)
    setSessionHasSearched(true)
    setLockedTopic(query); setSameCtxOk(false); setDlgShownThisEdit(false); setIsFirstSearch(true)
    setLastWebQuery(query)
    // Force keepFilters=false regardless of isVeryFirst — this is a "No, reset" action
    search(query, mode, sub, false, false, '')
    setActiveTab('web'); setExpandedId(null); setShowDoc(false); setShowMoreQ(false)
  }


// ─────────────────────────────────────────────────────────────────────────────
// PATCH E — Fix fireLlm() and fireWebOnly() to also pass keepFilters=false on dlgNo
//
// The simplest approach: add a useRef flag `forceResetSidebar` that dlgNo sets to true,
// and fireLlm/fireWebOnly reads it once then clears it.
//
// ADD near the other useRef/useState declarations in App.tsx:
// ─────────────────────────────────────────────────────────────────────────────

  const forceResetSidebarRef = useRef(false)   // ← ADD THIS near other refs


// ─────────────────────────────────────────────────────────────────────────────
// PATCH F — Update fireLlm to respect forceResetSidebarRef
//
// FIND:
//   function fireLlm(query: string) {
//     ...
//     const keepFilters = hasLlmSearched && sessionHasSearched
//     ...
//     llmSearch(query, ..., keepFilters)
//   }
//
// REPLACE WITH:
// ─────────────────────────────────────────────────────────────────────────────

  function fireLlm(query: string) {
    promptHistory.addEntry(query, 'llm')
    if (!sessionTopic) setSessionTopic(query)
    setSessionHasSearched(true)
    // Respect a force-reset from dlgNo (user said "No, new topic")
    const keepFilters = forceResetSidebarRef.current
      ? false
      : hasLlmSearched && sessionHasSearched
    forceResetSidebarRef.current = false  // consume the flag
    setActiveTab('llm')
    llmSearch(query, hasLlmSearched ? (llmCards.find(c=>c.rank===0)?.snippet??'') : '', keepFilters)
    setExpandedId(null)
  }

  function fireWebOnly(query: string) {
    promptHistory.addEntry(query, 'webonly')
    if (!sessionTopic) setSessionTopic(query)
    setSessionHasSearched(true)
    const keepFilters = forceResetSidebarRef.current
      ? false
      : hasWebOnlySearched && sessionHasSearched
    forceResetSidebarRef.current = false  // consume the flag
    webonlySearch(query, keepFilters)
    setExpandedId(null)
  }


// ─────────────────────────────────────────────────────────────────────────────
// PATCH G — Update dlgNo to set forceResetSidebarRef before firing
//
// FIND the dlgNo function (which you already updated in PATCH D),
// update the pendingAppMode === 'llm' and 'webonly' branches:
// ─────────────────────────────────────────────────────────────────────────────

  function dlgNo() {
    setShowTopicDlg(false); setSameCtxOk(false)
    setActiveChips([]); setFilterResetKey(k=>k+1)
    setFilterCat('general'); setLockedTopic(''); clientRefine([])

    if (pendingSearchAfterTopic) {
      const { q, m, s } = pendingSearchAfterTopic
      setPendingSearchAfterTopic(null)
      forceResetSidebarRef.current = true   // ← tell fireLlm/fireWebOnly to wipe sidebar
      if (pendingAppMode === 'llm')          fireLlm(enrichQuery(q))
      else if (pendingAppMode === 'webonly') fireWebOnly(enrichQuery(q))
      else                                   freshSearchForced(q, m, s)
    }
  }


// ─────────────────────────────────────────────────────────────────────────────
// PATCH H — Feature B: CardGroupBar group selection also filters cards
//
// Currently mkGroupHandler just sets grpId/grpOn/grpName — it GROUPS visually
// but doesn't actually hide/show cards. The spec wants group selection to
// "equally impact refinement results" as sidebar filter chips.
//
// The fix: when a group is activated, derive a filter chip from the group label
// and call clientRefine so cards not matching that group keyword get hidden.
//
// FIND the mkGroupHandler function:
//   function mkGroupHandler(setId:any,setOn:any,setName:any){
//     return(id:string|null)=>{...}
//   }
//
// REPLACE WITH:
// ─────────────────────────────────────────────────────────────────────────────

  function mkGroupHandler(
    setId: any, setOn: any, setName: any,
    zone: 'all'|'web'|'llm'|'file'|'webonly'|'urls' = 'all',
    groups: CardGroupOption[] = [],
  ) {
    return (id: string|null) => {
      if (!id) {
        setId(null); setOn(false); setName(undefined)
        // Clear any group-derived chips — restore all cards for this zone
        setActiveChips(prev => {
          const next = prev.filter(c => !c.id.startsWith('grp-'))
          clientRefine(next, zone)
          return next
        })
        return
      }
      if (id.startsWith('custom:')) {
        const name = id.slice(7)
        setName(name); setId(id); setOn(true)
        // Filter by the custom keyword typed by the user
        const chip: ActiveFilterChip = { id:'grp-custom', sectionId:'group', label:`Group: ${name}`, value: name }
        setActiveChips(prev => {
          const next = [...prev.filter(c => !c.id.startsWith('grp-')), chip]
          clientRefine(next, zone)
          return next
        })
      } else {
        setName(undefined); setId(id); setOn(true)
        // Derive filter keyword from the matching group definition
        const group = groups.find(g => g.id === id)
        const keyword = group?.cardKeyword || id
        const chip: ActiveFilterChip = { id:'grp-'+id, sectionId:'group', label:`Group: ${group?.label||id}`, value: keyword }
        setActiveChips(prev => {
          const next = [...prev.filter(c => !c.id.startsWith('grp-')), chip]
          clientRefine(next, zone)
          return next
        })
      }
    }
  }

  // Now update the handler instantiations to pass zone + groups:
  const handleWebGroup  = useCallback(mkGroupHandler(setWebGrpId,  setWebGrpOn,  setWebGrpName,  'web',     webGroups),  [webGroups])
  const handleLlmGroup  = useCallback(mkGroupHandler(setLlmGrpId,  setLlmGrpOn,  setLlmGrpName,  'llm',     llmGroups),  [llmGroups])
  const handleFileGroup = useCallback(mkGroupHandler(setFileGrpId, setFileGrpOn, setFileGrpName, 'file',    fileGroups), [fileGroups])
  const handleWoGroup   = useCallback(mkGroupHandler(setWoGrpId,   setWoGrpOn,   setWoGrpName,   'webonly', woGroups),   [woGroups])
  const handleUrlGroup  = useCallback(mkGroupHandler(setUrlGrpId,  setUrlGrpOn,  setUrlGrpName,  'urls',    urlGroups),  [urlGroups])
  const handleAllGroup  = useCallback(mkGroupHandler(setAllGrpId,  setAllGrpOn,  setAllGrpName,  'all',     allGroups),  [allGroups])

  // ⚠ Note: webGroups/llmGroups/etc. are defined via useMemo below the handler declarations,
  // so you'll need to move the handler declarations AFTER the group useMemo lines.
  // The existing code already puts handlers after groups in a few places — just ensure order is:
  //   1. useMemo for webGroups, llmGroups, fileGroups, woGroups, urlGroups, allGroups
  //   2. useCallback for handleWebGroup, handleLlmGroup, etc. (now passing groups)
