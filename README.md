# SeekNBuild — Browser Card UI

A local development preview of the SeekNBuild card-based search results interface.

---

## What's inside

| File / Folder | Purpose |
|---|---|
| `index.html` | App entry point |
| `package.json` | Dependencies list |
| `vite.config.ts` | Local dev server config |
| `tsconfig.json` | TypeScript config |
| `src/main.tsx` | React root |
| `src/App.tsx` | Top-level layout |
| `src/styles/global.css` | Design system (colours, fonts, spacing) |
| `src/types/` | TypeScript type definitions |
| `src/data/` | All 12 card data objects (10 integral types + 2 supplementary) |
| `src/hooks/useCards.ts` | All card state: search, filter, dismiss, doc-select, reorder |
| `src/components/` | All UI components (PromptBox, FilterBar, CardGrid, SearchCard, etc.) |

---

## Requirements

- **Node.js 18 or newer** — check by running `node --version` in your terminal
- **npm** — comes with Node.js automatically

---

## Setup — do this once

Open a terminal (on Windows: use **Command Prompt** or **PowerShell**).

**Step 1 — Go into the project folder**
```
cd seeknbuild
```

**Step 2 — Install dependencies**
```
npm install
```
This downloads React, Vite, KaTeX (math rendering), and the drag-and-drop library.
It takes about 30–60 seconds and only needs to be done once.

**Step 3 — Start the development server**
```
npm run dev
```

**Step 4 — Open in your browser**

Your browser will open automatically at:
```
http://localhost:5173
```

If it doesn't open automatically, copy that address and paste it into Chrome, Edge, or Firefox.

---

## How to use the UI

1. Click **Search** — the pre-filled calculus query populates 12 result cards
2. **Drag cards** to rearrange them (click and hold, then drag)
3. Click **↗ expand** (bottom-right of any card) to open the full card view with all solution steps and KaTeX math
4. Press **Escape** or click outside to close the expanded view
5. Check the **doc** checkbox on any non-video card to mark it for document export
6. When cards are selected, a gold bar appears — click **Build document →** to preview the assembled document
7. Use the **filter checkboxes** and **dropdowns** above the cards, then click **Refine results**
8. Click **✕** on any card to dismiss it — dismissed cards stay gone through refinements
9. Use the **2 / 3 / 4** column buttons to adjust the grid width

---

## Stopping the server

Press `Ctrl + C` in the terminal window.

---

## Next steps (future sessions)

- Connect a real search API (Brave Search, Bing, or SearXNG for privacy)
- Connect the Anthropic API to power the LLM prompt box
- Add real DOCX/PDF export using the document editor subsystem
- Package as an Electron desktop app

---

Built with: React 18 · TypeScript · Vite · @dnd-kit · KaTeX
