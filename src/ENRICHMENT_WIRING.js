// ─────────────────────────────────────────────────────────────────────────────
// App.tsx — ONE LINE TO CHANGE
// Find this (around line where expandedCard is rendered):
//
//   {expandedCard&&<CardExpandOverlay card={expandedCard} onClose={()=>setExpandedId(null)}
//     onToggleDoc={()=>{ ... }}/>}
//
// Add the `query` prop:
//
//   {expandedCard&&<CardExpandOverlay
//     card={expandedCard}
//     query={currentQueryRef}          // ← ADD THIS LINE
//     onClose={()=>setExpandedId(null)}
//     onToggleDoc={()=>{ const ms=llmMulti.activeSlots.find(s=>s.cards.some(c=>c.id===expandedCard.id)); if(ms) llmMulti.toggleDocSelect(ms.providerId,expandedCard.id); else if(expandedZone) toggleDocSelect(expandedCard.id,expandedZone) }}/>}
//
// That's it. currentQueryRef is already in App.tsx state — it tracks the
// current query string from PromptBox.
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// vercel.json — add the two new API functions
// Your current vercel.json has api/search.js and possibly api/llm.js etc.
// Add enrich and curate to the functions block:
// ─────────────────────────────────────────────────────────────────────────────

/*
{
  "buildCommand": "npm install --legacy-peer-deps && npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "functions": {
    "api/search.js":   { "runtime": "nodejs20.x" },
    "api/llm.js":      { "runtime": "nodejs20.x" },
    "api/analyze.js":  { "runtime": "nodejs20.x" },
    "api/webonly.js":  { "runtime": "nodejs20.x" },
    "api/enrich.js":   { "runtime": "nodejs20.x" },
    "api/curate.js":   { "runtime": "nodejs20.x" }
  }
}
*/


// ─────────────────────────────────────────────────────────────────────────────
// FILE PLACEMENT SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
//
// Copy these to your v6 project:
//
//   Downloads\api\enrich.js          → C:\aiProjects\claude\v6\seeknbuild\api\enrich.js
//   Downloads\api\curate.js          → C:\aiProjects\claude\v6\seeknbuild\api\curate.js
//   Downloads\CardExpandOverlay.tsx  → C:\aiProjects\claude\v6\seeknbuild\src\components\CardExpandOverlay.tsx
//   Downloads\CardExpandOverlay.module.css → C:\aiProjects\claude\v6\seeknbuild\src\components\CardExpandOverlay.module.css
//
// Then in App.tsx add query={currentQueryRef} to the CardExpandOverlay JSX.
// Then update vercel.json to include enrich.js and curate.js.
//
// The api/enrich.js and api/curate.js files were built in the previous session —
// download them from today's earlier file delivery if you don't have them yet.
// ─────────────────────────────────────────────────────────────────────────────
