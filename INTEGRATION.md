# SeekNBuild — Card Enrichment Integration Guide
# Files delivered today + where each one goes

## 1. FILES TO PLACE

### API routes (Vercel serverless functions)
Place these in your existing `api/` folder alongside `search.js`:

  api/enrich.js          ← on-demand card enrichment
  api/curate.js          ← AI editorial curation for all cards

### React components
Place these in `src/components/`:

  src/components/EnrichedCard.jsx
  src/components/EnrichedCard.module.css
  src/components/CurationPanel.jsx
  src/components/CurationPanel.module.css


## 2. WIRING EnrichedCard INTO YOUR CARD GRID

In your existing card component (SearchCard, CardPileGrid, etc.),
add an "Expand" button and manage expanded state in App.jsx or useCards.

### In App.jsx (or wherever your main state lives):

  import { EnrichedCard } from './components/EnrichedCard'
  import { CurationPanel } from './components/CurationPanel'

  // State
  const [expandedCard, setExpandedCard] = useState(null)
  const [showCuration, setShowCuration] = useState(false)
  const [selectedForPublish, setSelectedForPublish] = useState(new Set())

  function toggleSelect(cardId) {
    setSelectedForPublish(prev => {
      const next = new Set(prev)
      next.has(cardId) ? next.delete(cardId) : next.add(cardId)
      return next
    })
  }

  // In JSX, after your card grid:
  {expandedCard && (
    <EnrichedCard
      card={expandedCard}
      query={currentQuery}
      isSelected={selectedForPublish.has(expandedCard.id)}
      onToggleSelect={toggleSelect}
      onClose={() => setExpandedCard(null)}
    />
  )}

  {showCuration && (
    <CurationPanel
      cards={[...webCards, ...fileCards, ...moreCards]}
      query={currentQuery}
      onApplyCuration={({ selectedIds, orderedSections, suggestedTitle }) => {
        // Apply Claude's selections to your state
        setSelectedForPublish(new Set(selectedIds))
        // Store orderedSections for the document builder (Layer 2)
        // Store suggestedTitle for the document builder
      }}
      onClose={() => setShowCuration(false)}
    />
  )}


### In each SearchCard / CardPileGrid card:
Add an expand button that calls setExpandedCard(card):

  <button onClick={() => setExpandedCard(card)}>
    ✦ Expand
  </button>


## 3. TRIGGERING CURATION

Add a "Curate with AI" button in your toolbar or All Results mode header:

  <button onClick={() => setShowCuration(true)}>
    ✦ AI Curation
  </button>

This is the button where Claude acts as project manager — reviewing all cards,
recommending what to include, and structuring the document.


## 4. VERCEL — add enrich.js to vercel.json

In your vercel.json, add the new function alongside search.js:

  {
    "buildCommand": "npm install --legacy-peer-deps && npm run build",
    "outputDirectory": "dist",
    "framework": "vite",
    "functions": {
      "api/search.js":  { "runtime": "nodejs20.x" },
      "api/enrich.js":  { "runtime": "nodejs20.x" },
      "api/curate.js":  { "runtime": "nodejs20.x" }
    }
  }

No new environment variables needed — both use ANTHROPIC_API_KEY which is already set.


## 5. HOW THE ENRICHED VERSION GOES INTO PUBLISHING

When the user clicks "+ Add to Document" in the EnrichedCard panel:
  → Card ID is added to selectedForPublish set
  → The enrichment data (paragraphs, images, chart, citations) is available in memory

For the document builder (Layer 2, next phase), you'll want to cache enrichment
results so they don't have to be re-fetched. Recommended approach:

  // In useCards hook or App.jsx
  const [enrichmentCache, setEnrichmentCache] = useState({})  // { cardId: enrichmentData }

  // When enrichment completes in EnrichedCard, bubble it up:
  onEnriched?.({ cardId: card.id, enrichment: data })

  // Store it:
  setEnrichmentCache(prev => ({ ...prev, [cardId]: enrichment }))

This cache feeds directly into Layer 2 (Document Assembly) — each selected card
becomes a document section, using its enriched paragraphs, images, and citations.


## 6. WHAT'S NEXT (Layer 2 — Document Assembly)

Once enrichment is working:
  - DocumentBuilder component: assembles selected cards into ordered sections
  - CurationPanel already returns `orderedSections` — feed those directly in
  - Export buttons: PDF, Word, PowerPoint, Webpage
  - File save to Vercel KV or Vercel Postgres (user must be logged in)
