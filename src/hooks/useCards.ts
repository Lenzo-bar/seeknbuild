import { useState, useCallback } from 'react'
import type { SearchCard, LinkResult, FilterState, CardZone, SidebarFilterSection, SearchMode, ActiveFilterChip } from '../types'
import { MORE_CARDS } from '../data/integralCards'
import type { CardGroupOption } from '../components/CardGroupBar'
import type { FileCardData } from '../components/FileCard'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SummaryTableData {
  headers: string[]
  rows:    string[][]
  icons?:  Record<string, string>
}

export interface LlmCard {
  id:          string
  rank:        number
  type:        'llm'
  zone:        'llm'
  title:       string
  snippet:     string
  steps:       string[]
  math:        string
  solution:    string
  tags:        string[]
  difficulty:  string
  url:         string
  source:      string
  hasVideo:    boolean
  visible:     boolean
  docSelected: boolean
  groupValues?: Record<string, string>
}

// ── Default filters ───────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Record<string, SidebarFilterSection[]> = {
  // ── Existing topic filters (Web+LLM) ────────────────────────────────────
  'real-estate': [
    { id:'price',  label:'Price Range',   type:'range',      unit:'$' },
    { id:'beds',   label:'Bedrooms',      type:'radio',      options:['Any','1','2','3','4','5+'] },
    { id:'type',   label:'Property Type', type:'checkboxes', options:['House','Condo','Townhouse','Land'] },
    { id:'listing',label:'Listing Type',  type:'radio',      options:['For Sale','For Rent'] },
  ],
  automotive: [
    { id:'make',  label:'Make',       type:'checkboxes', options:['Toyota','Honda','Ford','Chevrolet','BMW','Hyundai'] },
    { id:'year',  label:'Year Range', type:'range',      unit:'' },
    { id:'price', label:'Price',      type:'range',      unit:'$' },
    { id:'cond',  label:'Condition',  type:'radio',      options:['New','Used','Certified Pre-Owned'] },
  ],
  shopping:  [
    { id:'price',  label:'Price Range', type:'range',      unit:'$' },
    { id:'rating', label:'Min Rating',  type:'radio',      options:['Any','3+ stars','4+ stars'] },
  ],
  sports: [
    { id:'league', label:'League', type:'checkboxes', options:['NBA','NFL','NHL','MLB','MLS'] },
    { id:'date',   label:'Date',   type:'select',     options:['Today','This week','This month'] },
  ],
  news: [
    { id:'date',   label:'Date',   type:'select',     options:['Today','This week','This month'] },
    { id:'source', label:'Source', type:'checkboxes', options:['News','Blog','Official'] },
  ],
  weather: [
    { id:'cond', label:'Condition', type:'checkboxes', options:['Sunny','Cloudy','Rain','Snow'] },
    { id:'date', label:'Date',      type:'select',     options:['Today','This week','This month'] },
  ],
  // ── General (Web+LLM fallback + LLM Only) ────────────────────────────────
  general: [
    { id:'ctype', label:'Content Type', type:'checkboxes', options:['Article','Video','Forum','Blog','Academic','Tutorial'] },
    { id:'date',  label:'Date',         type:'select',     options:['Any time','Past week','Past month','Past year'] },
    { id:'diff',  label:'Difficulty',   type:'radio',      options:['Any','Beginner','Intermediate','Advanced'] },
  ],
  // ── LLM Only ─────────────────────────────────────────────────────────────
  llm: [
    { id:'diff',    label:'Difficulty',    type:'radio',      options:['Any','Beginner','Intermediate','Advanced','Expert'] },
    { id:'ctype',   label:'Response type', type:'checkboxes', options:['Explanation','Step-by-step','Summary','Code','Math','Comparison'] },
    { id:'depth',   label:'Depth',         type:'radio',      options:['Brief','Moderate','Detailed','Comprehensive'] },
    { id:'source',  label:'Source LLM',    type:'checkboxes', options:['Claude','ChatGPT','Gemini','Perplexity','DeepSeek','Copilot'] },
  ],
  // ── File Analysis ─────────────────────────────────────────────────────────
  file: [
    { id:'section', label:'Section / Chapter', type:'checkboxes', options:['Introduction','Methods','Results','Discussion','Conclusion','Appendix','Other'] },
    { id:'ctype',   label:'Card type',          type:'checkboxes', options:['Summary','Finding','Definition','Step','Formula','Chart','Table','Quote'] },
    { id:'diff',    label:'Difficulty',          type:'radio',      options:['Any','Beginner','Intermediate','Advanced'] },
    { id:'tag',     label:'Tag',                 type:'checkboxes', options:['Key finding','Action item','Question','Reference','Important'] },
  ],
  // ── Web Only ──────────────────────────────────────────────────────────────
  webonly: [
    { id:'ctype',  label:'Content type', type:'checkboxes', options:['Article','News','Video','Forum','Blog','Image','Shopping'] },
    { id:'date',   label:'Date',         type:'select',     options:['Any time','Past 24 hours','Past week','Past month'] },
    { id:'source', label:'Source',       type:'checkboxes', options:['News','Blog','Official','Community','Academic'] },
  ],
  // ── URL Analyzer ──────────────────────────────────────────────────────────
  urls: [
    { id:'domain', label:'Domain / Site',  type:'checkboxes', options:[] },   // populated dynamically
    { id:'task',   label:'Analysis task',  type:'radio',      options:['Summarize','Compare','Analyze','Combine','Rewrite'] },
    { id:'ctype',  label:'Card type',      type:'checkboxes', options:['Summary','Key point','Quote','Data','Action','Reference'] },
    { id:'date',   label:'Date',           type:'select',     options:['Any time','Past week','Past month','Past year'] },
  ],
  // ── All Results ───────────────────────────────────────────────────────────
  all: [
    { id:'zone',  label:'Source mode',  type:'checkboxes', options:['Web+LLM','LLM Only','File Analysis','Web Only','URL Analyzer'] },
    { id:'ctype', label:'Content type', type:'checkboxes', options:['Article','Video','Forum','Blog','Academic','Code','Math'] },
    { id:'diff',  label:'Difficulty',   type:'radio',      options:['Any','Beginner','Intermediate','Advanced'] },
    { id:'date',  label:'Date',         type:'select',     options:['Any time','Past week','Past month','Past year'] },
  ],
  // ── Academia ──────────────────────────────────────────────────────────────
  academia: [
    { id:'field',  label:'Field',         type:'checkboxes', options:['Math','Physics','Chemistry','Biology','History','CS','Engineering','Medicine','Law','Economics'] },
    { id:'diff',   label:'Level',         type:'radio',      options:['Any','Intro','Intermediate','Advanced','Graduate'] },
    { id:'ctype',  label:'Content type',  type:'checkboxes', options:['Paper','Textbook','Tutorial','Video','Forum','Blog'] },
    { id:'date',   label:'Date',          type:'select',     options:['Any time','Past year','Past 5 years','Classic'] },
  ],
}

function detectTopic(q: string): string {
  q = q.toLowerCase()
  if (/house|home|condo|apartment|rent|mortgage|real.?estate|bedroom|property/.test(q)) return 'real-estate'
  if (/car|truck|suv|toyota|honda|ford|chevrolet|bmw|auto|vehicle/.test(q))            return 'automotive'
  if (/buy|shop|price|deal|discount|amazon|product/.test(q))                           return 'shopping'
  if (/nba|nfl|nhl|mlb|soccer|football|basketball|baseball|hockey|sport|score/.test(q)) return 'sports'
  if (/news|breaking|latest|headline/.test(q))                                         return 'news'
  if (/weather|forecast|temperature|rain|snow|sunny|cloudy|humidity|wind/.test(q))    return 'weather'
  if (/math|calculus|algebra|science|physics|chemistry|biology|history|philosophy|economics|engineering|medicine|law|university|student|research|theorem|proof|equation/.test(q)) return 'academia'
  return 'general'
}

// Helper: build URL domain filters dynamically from the URL list
function buildUrlFilters(urls: string[]): SidebarFilterSection[] {
  const base = DEFAULT_FILTERS.urls.map(f => ({ ...f }))
  const domainSection = base.find(f => f.id === 'domain')
  if (domainSection && urls.length > 0) {
    domainSection.options = [...new Set(urls.map(u => {
      try { return new URL(u).hostname } catch { return u }
    }))]
  }
  return base
}

function salvage(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  ;['cards','links','sidebarFilters','cardGroups'].forEach(key => {
    const ks = text.indexOf(`"${key}"`)
    if (ks === -1) return
    const as = text.indexOf('[', ks)
    if (as === -1) return
    const items: unknown[] = []
    let depth = 0, objStart = -1
    for (let i = as; i < text.length; i++) {
      const ch = text[i]
      if (ch==='{'){if(depth===0)objStart=i;depth++}
      else if(ch==='}'){depth--;if(depth===0&&objStart!==-1){try{items.push(JSON.parse(text.slice(objStart,i+1)))}catch{}objStart=-1}}
      else if(ch===']'&&depth===0)break
    }
    if (items.length > 0) result[key] = items
  })
  const tm = text.match(/"topic"\s*:\s*"([^"]*)"/)
  if (tm) result.topic = tm[1]
  return result
}

// ── API calls ─────────────────────────────────────────────────────────────────

// ── Topic-aware sidebar filter generator ─────────────────────────────────────
// Called after Web+LLM, LLM Only, and Web Only searches complete.
// Sends the query + card titles/tags to Claude and gets back structured filter
// sections that are relevant to the actual topic — not generic defaults.

async function callSidebarFiltersAPI(
  query: string,
  mode: 'web' | 'llm' | 'webonly',
  cardSamples: { title: string; tags: string[]; difficulty?: string; source?: string }[],
): Promise<SidebarFilterSection[]> {
  // Build a compact context string from the top cards
  const sampleText = cardSamples.slice(0, 12).map((c, i) =>
    `${i + 1}. "${c.title}"${c.tags?.length ? ' [' + c.tags.slice(0, 3).join(', ') + ']' : ''}${c.source ? ' (' + c.source + ')' : ''}`
  ).join('\n')

  const modeLabel = mode === 'web' ? 'Web + LLM search' : mode === 'llm' ? 'LLM Only' : 'Web Only search'

  const prompt = `You are generating sidebar filter controls for a research app called SeekNBuild.

The user ran a ${modeLabel} for: "${query}"

The top results returned were:
${sampleText}

Generate 3-5 sidebar filter sections that would be most useful for refining THESE specific results.
Rules:
- Each section must directly relate to the query topic or the result types shown
- Use real values from the results (e.g. actual source names, actual difficulty levels seen, actual subtopics)
- Do NOT use generic filters like "Content Type: Article/Video/Blog" unless the results actually contain mixed types
- Filter types: "checkboxes" (multi-select), "radio" (single choice), "select" (dropdown), "range" (numeric)
- For "checkboxes" and "radio": provide 3-6 specific options derived from the actual results
- Keep labels short (1-3 words)

Respond with ONLY a JSON array, no markdown, no explanation:
[
  {
    "id": "unique_snake_case_id",
    "label": "Short Label",
    "type": "checkboxes" | "radio" | "select" | "range",
    "options": ["Option 1", "Option 2", "Option 3"],
    "unit": ""
  }
]`

  try {
    // Route through /api/llm with sidebarMode flag so the API key stays server-side
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: prompt, sidebarMode: true }),
    })
    if (!res.ok) return []
    const data = await res.json()
    if (data.error) return []
    // sidebarMode returns { sidebarFilters: [...] }
    const raw = Array.isArray(data.sidebarFilters) ? data.sidebarFilters : []
    if (!Array.isArray(raw) || raw.length === 0) return []
    return raw
      .filter((s: any) => s.id && s.label && s.type)
      .map((s: any) => ({
        id:      String(s.id),
        label:   String(s.label),
        type:    s.type as SidebarFilterSection['type'],
        options: Array.isArray(s.options) ? s.options.map(String) : [],
        unit:    s.unit ? String(s.unit) : undefined,
      }))
  } catch {
    return []   // fail silently — caller keeps existing filters
  }
}

async function callSearchAPI(query: string, searchMode: SearchMode, subMode: string, previousSummary = '') {
  const res  = await fetch('/api/search', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,searchMode,subMode,previousSummary})})
  const text = await res.text()
  let data: Record<string,unknown>
  try{data=JSON.parse(text)}catch{data=salvage(text)}
  if(!data)throw new Error('API returned malformed JSON.')
  if(data.error)throw new Error(String(data.error))

  const rawCards = Array.isArray(data.cards)?data.cards as Record<string,unknown>[]:[]
  const sidebarFilters = Array.isArray(data.sidebarFilters)&&(data.sidebarFilters as unknown[]).length>0
    ?data.sidebarFilters as SidebarFilterSection[]
    :(DEFAULT_FILTERS[detectTopic(query)]||DEFAULT_FILTERS.general)

  const cards: SearchCard[] = rawCards.map((r,i)=>({
    id:String(r.id??`web-${i}`),zone:'web' as CardZone,type:(r.type as SearchCard['type'])??'article',
    rank:Number(r.rank??i+1),title:String(r.title??'Untitled'),source:String(r.url??r.source??''),
    snippet:String(r.snippet??''),tags:Array.isArray(r.tags)?r.tags as string[]:[],
    hasVideo:r.type==='video',visible:true,docSelected:false,
    ...(r.groupValues&&typeof r.groupValues==='object'?{groupValues:r.groupValues}:{}),
    imageUrl:r.imageUrl as string|undefined,videoChannel:r.videoChannel as string|undefined,
    videoDuration:r.videoDuration as string|undefined,publishedAt:r.publishedAt as string|undefined,
    outlet:r.outlet as string|undefined,price:r.price as string|undefined,
    rating:typeof r.rating==='number'?r.rating:undefined,
    upvotes:r.upvotes as number|undefined,replies:r.replies as number|undefined,forum:r.forum as string|undefined,
  }))

  const links: LinkResult[] = Array.isArray(data.links)
    ?(data.links as Record<string,unknown>[]).map((r,i)=>({id:String(r.id??`link-${i}`),rank:Number(r.rank??i+1),title:String(r.title??'Untitled'),url:String(r.url??''),snippet:String(r.snippet??'')}))
    :[]

  const summaryTable = (data.summaryTable&&typeof data.summaryTable==='object'&&Array.isArray((data.summaryTable as any).headers)&&Array.isArray((data.summaryTable as any).rows))
    ?data.summaryTable as SummaryTableData:null

  const cardGroups: CardGroupOption[] = Array.isArray(data.cardGroups)
    ?(data.cardGroups as any[]).map(g=>({id:String(g.id??''),label:String(g.label??''),description:String(g.description??''),subItems:Array.isArray(g.subItems)?g.subItems.map(String):[],cardKeyword:String(g.cardKeyword??'')}))
    :[]

  return {cards,links,sidebarFilters,topic:String(data.topic??''),summaryTable,cardGroups}
}

async function callLlmAPI(query: string, previousSummary = '') {
  const res  = await fetch('/api/llm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,previousSummary})})
  const text = await res.text()
  let data: Record<string,unknown>
  try{data=JSON.parse(text)}catch{throw new Error('LLM API returned malformed JSON.')}
  if(data.error)throw new Error(String(data.error))

  const rawCards = Array.isArray(data.cards)?data.cards as Record<string,unknown>[]:[]
  const cards: LlmCard[] = rawCards.map((r,i)=>({
    id:String(r.id??`llm-${i}`),rank:Number(r.rank??i),type:'llm' as const,zone:'llm' as const,
    title:String(r.title??'Untitled'),snippet:String(r.snippet??''),
    steps:Array.isArray(r.steps)?r.steps.map(String):[],
    math:String(r.math??''),solution:String(r.solution??''),
    tags:Array.isArray(r.tags)?r.tags.map(String):[],
    difficulty:String(r.difficulty??'intermediate'),
    url:'',source:'Claude AI',hasVideo:false,visible:true,docSelected:false,
  }))

  const summaryTable = (data.summaryTable&&typeof data.summaryTable==='object'&&Array.isArray((data.summaryTable as any).headers)&&Array.isArray((data.summaryTable as any).rows))
    ?data.summaryTable as SummaryTableData:null

  // Extract sidebar filters generated inline by the LLM prompt
  const sidebarFilters: SidebarFilterSection[] = Array.isArray(data.sidebarFilters)
    ? (data.sidebarFilters as any[])
        .filter((s:any) => s.id && s.label && s.type)
        .map((s:any) => ({
          id:      String(s.id),
          label:   String(s.label),
          type:    s.type as SidebarFilterSection['type'],
          options: Array.isArray(s.options) ? s.options.map(String) : [],
          unit:    s.unit ? String(s.unit) : undefined,
        }))
    : []

  return{cards,summaryTable,sidebarFilters,topic:String(data.topic??'general')}
}

async function callAnalyzeAPI(file: File, userPrompt: string): Promise<{
  cards:        FileCardData[]
  summaryTable: SummaryTableData | null
  cardGroups:   CardGroupOption[]
  topic:        string
}> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsDataURL(file)
  })

  const res  = await fetch('/api/analyze', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ fileName:file.name, fileType:file.type, fileData:base64, userPrompt }),
  })
  const text = await res.text()
  let data: Record<string,unknown>
  try{data=JSON.parse(text)}catch{throw new Error('Analyze API returned malformed JSON.')}
  if(data.error)throw new Error(String(data.error))

  const rawCards = Array.isArray(data.cards)?data.cards as Record<string,unknown>[]:[]
  const cards: FileCardData[] = rawCards.map((r,i)=>({
    id:          String(r.id??`file-${i}`),
    rank:        Number(r.rank??i),
    type:        'file' as const,
    zone:        'file' as const,
    cardKind:    String(r.cardKind||'general'),
    title:       String(r.title??`Card ${i+1}`),
    snippet:     String(r.snippet??''),
    steps:       Array.isArray(r.steps)?r.steps.map(String):[],
    math:        String(r.math??''),
    solution:    String(r.solution??''),
    chartSpec:   (r.chartSpec&&typeof r.chartSpec==='object')?r.chartSpec as any:null,
    tags:        Array.isArray(r.tags)?r.tags.map(String):[],
    difficulty:  String(r.difficulty??''),
    pairId:      r.pairId!=null?String(r.pairId):null,
    pairType:    r.pairType!=null?String(r.pairType):null,
    url:         '',
    source:      file.name,
    hasVideo:    false,
    visible:     true,
    docSelected: false,
    groupValues: (r.groupValues&&typeof r.groupValues==='object')?r.groupValues as Record<string,string>:{},
  }))

  const summaryTable = (data.summaryTable&&typeof data.summaryTable==='object'&&Array.isArray((data.summaryTable as any).headers)&&Array.isArray((data.summaryTable as any).rows))
    ?data.summaryTable as SummaryTableData:null

  const cardGroups: CardGroupOption[] = Array.isArray(data.cardGroups)
    ?(data.cardGroups as any[]).map(g=>({id:String(g.id??''),label:String(g.label??''),description:String(g.description??''),subItems:Array.isArray(g.subItems)?g.subItems.map(String):[],cardKeyword:String(g.cardKeyword??'')}))
    :[]

  return{cards,summaryTable,cardGroups,topic:String(data.topic??'general')}
}

async function callWebOnlyAPI(query: string): Promise<{
  cards:        SearchCard[]
  overflowLinks: LinkResult[]
  typedResults: {
    news:   {id:string;rank:number;title:string;url:string;snippet:string;type:string}[]
    videos: {id:string;rank:number;title:string;url:string;snippet:string;type:string}[]
    images: {id:string;rank:number;title:string;url:string;snippet:string;type:string}[]
    forums: {id:string;rank:number;title:string;url:string;snippet:string;type:string}[]
  }
  topic: string
}> {
  const res  = await fetch('/api/webonly', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ mode:'search', query }),
  })
  const text = await res.text()
  let data: Record<string,unknown>
  try{data=JSON.parse(text)}catch{throw new Error('Web Only API returned malformed JSON.')}
  if(data.error)throw new Error(String(data.error))

  const rawCards = Array.isArray(data.cards)?data.cards as Record<string,unknown>[]:[]
  const cards: SearchCard[] = rawCards.map((r,i)=>({
    id:           String(r.id??`webonly-${i}`),
    zone:         'webonly' as CardZone,
    type:         (r.type as SearchCard['type'])??'article',
    rank:         Number(r.rank??i+1),
    title:        String(r.title??'Untitled'),
    source:       String(r.url??r.source??''),
    snippet:      String(r.snippet??''),
    tags:         [],
    hasVideo:     r.type==='video',
    visible:      true,
    docSelected:  false,
    outlet:       r.outlet as string|undefined,
    publishedAt:  r.publishedAt as string|undefined,
    videoChannel: r.videoChannel as string|undefined,
    videoDuration:r.videoDuration as string|undefined,
  }))

  const overflowLinks: LinkResult[] = Array.isArray(data.overflowLinks)
    ? (data.overflowLinks as Record<string,unknown>[]).map((r,i)=>({
        id:      String(r.id??`wo-link-${i}`),
        rank:    Number(r.rank??i+1),
        title:   String(r.title??'Untitled'),
        url:     String(r.url??''),
        snippet: String(r.snippet??''),
      }))
    : []

  const rawTyped = (data.typedResults && typeof data.typedResults==='object')
    ? data.typedResults as Record<string, unknown[]>
    : { news:[], videos:[], images:[], forums:[] }

  function mapTyped(arr: unknown[], prefix: string, type: string) {
    return (Array.isArray(arr)?arr:[]).map((r:any,i:number)=>({
      id:      String(r.id??`${prefix}-${i}`),
      rank:    Number(r.rank??i+1),
      title:   String(r.title??'Untitled'),
      url:     String(r.url??''),
      snippet: String(r.snippet??''),
      type,
    }))
  }

  const typedResults = {
    news:   mapTyped(rawTyped.news   as unknown[], 'wo-news',   'news'),
    videos: mapTyped(rawTyped.videos as unknown[], 'wo-video',  'video'),
    images: mapTyped(rawTyped.images as unknown[], 'wo-image',  'image'),
    forums: mapTyped(rawTyped.forums as unknown[], 'wo-forum',  'forum'),
  }

  return { cards, overflowLinks, typedResults, topic: String(data.topic??'general') }
}

async function callUrlAnalyzeAPI(urls: string[], task: string, followUp = ''): Promise<{
  cards:        SearchCard[]
  summaryTable: SummaryTableData | null
  topic:        string
}> {
  const res  = await fetch('/api/webonly', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ mode:'urls', urls, task, followUp }),
  })
  const text = await res.text()
  let data: Record<string,unknown>
  try{data=JSON.parse(text)}catch{throw new Error('URL Analyze API returned malformed JSON.')}
  if(data.error)throw new Error(String(data.error))

  const rawCards = Array.isArray(data.cards)?data.cards as Record<string,unknown>[]:[]
  const cards: SearchCard[] = rawCards.map((r,i)=>({
    id:          String(r.id??`url-${i}`),
    zone:        'urls' as CardZone,
    type:        'article' as const,
    rank:        Number(r.rank??i),
    title:       String(r.title??'Untitled'),
    source:      String(r.url??''),
    snippet:     String(r.snippet??''),
    tags:        Array.isArray(r.tags)?r.tags as string[]:[],
    steps:       Array.isArray(r.steps)?r.steps as string[]:[],
    hasVideo:    false,
    visible:     true,
    docSelected: false,
  }))

  const summaryTable = (data.summaryTable&&typeof data.summaryTable==='object'&&Array.isArray((data.summaryTable as any).headers)&&Array.isArray((data.summaryTable as any).rows))
    ?data.summaryTable as SummaryTableData:null

  return { cards, summaryTable, topic: String(data.topic??'url-analysis') }
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useCards() {
  // Web tab
  const [webCards,       setWebCards]       = useState<SearchCard[]>([])
  const [allWebCards,    setAllWebCards]    = useState<SearchCard[]>([])
  const [linkResults,    setLinkResults]    = useState<LinkResult[]>([])
  // ▼▼▼ FIX 1: initialize with general filters so sidebar is never blank ▼▼▼
  const [sidebarFilters, setSidebarFilters] = useState<SidebarFilterSection[]>(DEFAULT_FILTERS.general)
  const [webSummaryTable,setWebSummaryTable]= useState<SummaryTableData|null>(null)
  const [webCardGroups,  setWebCardGroups]  = useState<CardGroupOption[]>([])
  const [isSearching,    setIsSearching]    = useState(false)
  const [hasSearched,    setHasSearched]    = useState(false)
  const [searchTime,     setSearchTime]     = useState<number|null>(null)
  const [filterTime,     setFilterTime]     = useState<number|null>(null)
  const [isFiltering,    setIsFiltering]    = useState(false)
  const [totalCards,     setTotalCards]     = useState(0)
  const [webTopic,       setWebTopic]       = useState('')

  // LLM tab
  const [llmCards,       setLlmCards]       = useState<LlmCard[]>([])
  const [llmSummaryTable,setLlmSummaryTable]= useState<SummaryTableData|null>(null)
  const [llmCardGroups,  setLlmCardGroups]  = useState<CardGroupOption[]>([])
  const [isLlmSearching, setIsLlmSearching] = useState(false)
  const [hasLlmSearched, setHasLlmSearched] = useState(false)
  const [llmSearchTime,  setLlmSearchTime]  = useState<number|null>(null)

  // File tab
  const [fileCards,       setFileCards]       = useState<FileCardData[]>([])
  const [fileSummaryTable,setFileSummaryTable]= useState<SummaryTableData|null>(null)
  const [fileCardGroups,  setFileCardGroups]  = useState<CardGroupOption[]>([])
  const [isAnalyzing,     setIsAnalyzing]     = useState(false)
  const [hasAnalyzed,     setHasAnalyzed]     = useState(false)
  const [analyzeTime,     setAnalyzeTime]     = useState<number|null>(null)

  // Web Only tab
  const [webOnlyCards,    setWebOnlyCards]    = useState<SearchCard[]>([])
  const [modeFilter,      setModeFilter]      = useState<string>('all')
  const [webOnlyLinks,    setWebOnlyLinks]    = useState<LinkResult[]>([])
  const [webOnlyTyped,    setWebOnlyTyped]    = useState<{
    news:   {id:string;rank:number;title:string;url:string;snippet:string;type:string}[]
    videos: {id:string;rank:number;title:string;url:string;snippet:string;type:string}[]
    images: {id:string;rank:number;title:string;url:string;snippet:string;type:string}[]
    forums: {id:string;rank:number;title:string;url:string;snippet:string;type:string}[]
  }>({ news:[], videos:[], images:[], forums:[] })
  const [isWebOnlySearching, setIsWebOnlySearching] = useState(false)
  const [hasWebOnlySearched, setHasWebOnlySearched] = useState(false)
  const [webOnlySearchTime,  setWebOnlySearchTime]  = useState<number|null>(null)

  const clearWebOnly = useCallback(()=>{
    setWebOnlyCards([]);setWebOnlyLinks([])
    setHasWebOnlySearched(false);setWebOnlySearchTime(null)
  },[])

  // URL Analyzer tab
  const [urlCards,        setUrlCards]        = useState<SearchCard[]>([])
  const [urlSummaryTable, setUrlSummaryTable] = useState<SummaryTableData|null>(null)
  const [isUrlAnalyzing,  setIsUrlAnalyzing]  = useState(false)
  const [hasUrlAnalyzed,  setHasUrlAnalyzed]  = useState(false)
  const [urlAnalyzeTime,  setUrlAnalyzeTime]  = useState<number|null>(null)
  const [lastUrlTask,     setLastUrlTask]      = useState('summarize')

  // More
  const [moreCards,     setMoreCards]     = useState<SearchCard[]>([])
  const [isMoreLoading, setIsMoreLoading] = useState(false)
  const [apiError,      setApiError]      = useState<string|null>(null)
  const [currentTopic,  setCurrentTopic]  = useState('')

  const hasWeb     = webCards.length     > 0
  const hasLlm     = llmCards.length     > 0
  const hasFile    = fileCards.length    > 0
  const hasWebOnly = webOnlyCards.length > 0
  const hasUrls    = urlCards.length     > 0
  const hasMore    = moreCards.length    > 0
  const hasLinks   = linkResults.length  > 0
  const hasAny     = hasWeb || hasLlm || hasFile || hasWebOnly || hasUrls || hasMore

  const allCards = [
    ...webCards.filter(c=>c.visible),
    ...(llmCards.filter(c=>c.visible) as any[]),
    ...(fileCards.filter(c=>c.visible) as any[]),
    ...webOnlyCards.filter(c=>c.visible),
    ...urlCards.filter(c=>c.visible),
  ]

  // ── Web search ────────────────────────────────────────────────────────────
  const search = useCallback(async(query:string,searchMode:SearchMode='all',subMode='',keepFilters=false,appendCards=false,previousSummary='')=>{
    setIsSearching(true);setApiError(null)
    if(!appendCards){setWebCards([]);setLinkResults([])}
    // ▼▼▼ FIX 2: always set topic-appropriate filters immediately, before API returns ▼▼▼
    if(!keepFilters) setSidebarFilters(DEFAULT_FILTERS[detectTopic(query)]||DEFAULT_FILTERS.general)
    setHasSearched(true)
    const t0=Date.now()
    try{
      const result=await callSearchAPI(query,searchMode,subMode,previousSummary)
      if(appendCards){
        const stamp=Date.now()
        const newSynth=result.cards.find(c=>c.rank===0)
        const newData=result.cards.filter(c=>c.rank!==0)
        const stamped=newData.map((c,i)=>({...c,id:`${stamp}-${i}`,tags:[`📍 ${query.slice(0,35)}`,...c.tags]}))
        setWebCards(prev=>{const u=prev.map(c=>c.rank===0&&newSynth?{...c,snippet:newSynth.snippet,title:'Summary (updated)'}:c);return[...u,...stamped]})
        setAllWebCards(prev=>{const u=prev.map(c=>c.rank===0&&newSynth?{...c,snippet:newSynth.snippet,title:'Summary (updated)'}:c);return[...u,...stamped]})
        setTotalCards(prev=>prev+stamped.length)
        setLinkResults(prev=>[...prev,...result.links.map((l,i)=>({...l,id:`${stamp}-link-${i}`}))])
        setWebCardGroups(prev=>{const ids=new Set(prev.map(g=>g.id));return[...prev,...result.cardGroups.filter(g=>!ids.has(g.id))]})
        if(result.summaryTable)setWebSummaryTable(result.summaryTable)
      }else{
        setWebCards(result.cards);setAllWebCards(result.cards);setTotalCards(result.cards.length)
        setLinkResults(result.links);setWebSummaryTable(result.summaryTable);setWebCardGroups(result.cardGroups)
      }
      setSearchTime(Date.now()-t0);setFilterTime(null)
      // API may return richer filters — use them if available, otherwise keep the defaults already set
      if(!keepFilters){
        // Use API-returned filters if rich enough; otherwise generate topic-specific ones
        if (result.sidebarFilters && result.sidebarFilters.length >= 3) {
          setSidebarFilters(result.sidebarFilters)
        } else {
          // Generate topic-specific filters from actual card content (async, non-blocking)
          const samples = result.cards.filter(c => c.rank !== 0).map(c => ({
            title: c.title, tags: c.tags ?? [], source: c.source,
          }))
          callSidebarFiltersAPI(query, 'web', samples).then(filters => {
            if (filters.length > 0) setSidebarFilters(filters)
          })
        }
        setWebTopic(result.topic);setCurrentTopic(result.topic)
      }
    }catch(err){setApiError(err instanceof Error?err.message:String(err))}
    finally{setIsSearching(false)}
  },[])

  // ── LLM Only ─────────────────────────────────────────────────────────────
  const llmSearch = useCallback(async(query:string,previousSummary='',keepFilters=false)=>{
    setIsLlmSearching(true);setApiError(null);setHasLlmSearched(true)
    if(!keepFilters) setSidebarFilters(DEFAULT_FILTERS.llm)
    const t0=Date.now()
    try{
      const result=await callLlmAPI(query,previousSummary)
      setLlmCards(result.cards);setLlmSummaryTable(result.summaryTable)
      setLlmSearchTime(Date.now()-t0)
      if(result.topic) setCurrentTopic(result.topic)
      // Sidebar filters come directly from the LLM response — same call, no extra round-trip
      if (!keepFilters && result.sidebarFilters.length > 0) {
        setSidebarFilters(result.sidebarFilters)
      }
    }catch(err){setApiError(err instanceof Error?err.message:String(err))}
    finally{setIsLlmSearching(false)}
  },[])

  // ── File Analysis ─────────────────────────────────────────────────────────
  const analyzeFile = useCallback(async(file:File,userPrompt='',keepFilters=false)=>{
    setIsAnalyzing(true);setApiError(null);setHasAnalyzed(true)
    if(!keepFilters) setSidebarFilters(DEFAULT_FILTERS.file)
    const t0=Date.now()
    try{
      const result=await callAnalyzeAPI(file,userPrompt)
      const stamp=Date.now()
      setFileCards(prev=>[...prev,...result.cards.map((c,i)=>({...c,id:`${stamp}-${i}`}))])
      setFileSummaryTable(result.summaryTable)
      setFileCardGroups(prev=>{
        const ids=new Set(prev.map(g=>g.id))
        return[...prev,...result.cardGroups.filter(g=>!ids.has(g.id))]
      })
      setAnalyzeTime(Date.now()-t0)
      if(result.topic) setCurrentTopic(result.topic)
    }catch(err){setApiError(err instanceof Error?err.message:String(err))}
    finally{setIsAnalyzing(false)}
  },[])

  // ── Web Only search ──────────────────────────────────────────────────────
  const webonlySearch = useCallback(async(query:string,keepFilters=false)=>{
    setIsWebOnlySearching(true);setApiError(null);setHasWebOnlySearched(true)
    setWebOnlyCards([]);setWebOnlyLinks([])
    if(!keepFilters) setSidebarFilters(DEFAULT_FILTERS[detectTopic(query)] ?? DEFAULT_FILTERS.webonly)
    const t0=Date.now()
    try{
      const result=await callWebOnlyAPI(query)
      const cardResults = result.cards.filter(c => c.rank <= 15)
      setWebOnlyCards(cardResults)
      setWebOnlyLinks(result.overflowLinks)
      setWebOnlyTyped(result.typedResults)
      setWebOnlySearchTime(Date.now()-t0)
      setCurrentTopic(result.topic)
      // Generate topic-specific sidebar filters from card content (non-blocking)
      if (!keepFilters) {
        const samples = cardResults.filter(c => c.rank !== 0).map(c => ({
          title: c.title, tags: c.tags ?? [], source: c.source,
        }))
        callSidebarFiltersAPI(query, 'webonly', samples).then(filters => {
          if (filters.length > 0) setSidebarFilters(filters)
        })
      }
    }catch(err){setApiError(err instanceof Error?err.message:String(err))}
    finally{setIsWebOnlySearching(false)}
  },[])

  // ── URL Analyzer ─────────────────────────────────────────────────────────
  const analyzeUrls = useCallback(async(urls:string[],task:string,followUp='',keepFilters=false)=>{
    setIsUrlAnalyzing(true);setApiError(null);setHasUrlAnalyzed(true);setLastUrlTask(task)
    if(!keepFilters) setSidebarFilters(buildUrlFilters(urls))
    const t0=Date.now()
    try{
      const result=await callUrlAnalyzeAPI(urls,task,followUp)
      setUrlCards(result.cards)
      setUrlSummaryTable(result.summaryTable)
      setUrlAnalyzeTime(Date.now()-t0)
      if(result.topic) setCurrentTopic(result.topic)
    }catch(err){setApiError(err instanceof Error?err.message:String(err))}
    finally{setIsUrlAnalyzing(false)}
  },[])

  const addMoreQuestion = useCallback(async (question: string) => {
    setIsMoreLoading(true); setApiError(null)
    try {
      const result = await callSearchAPI(question, 'all', '', '')
      const stamp = Date.now()
      setMoreCards(prev => [...prev, ...result.cards.map((c, i) => ({
        ...c, id: `more-${stamp}-${i}`, zone: 'more' as CardZone,
      }))])
    } catch {
      const stamp = Date.now()
      setMoreCards(prev => [...prev, ...MORE_CARDS.map(c => ({
        ...c, id: `${c.id}_${stamp}`, visible: true, docSelected: false,
      }))])
    } finally {
      setIsMoreLoading(false)
    }
  }, [])

  const refine=useCallback((filters:FilterState)=>{
    setWebCards(prev=>prev.map(card=>{const{learnerLevel}=filters;let visible=true;if(learnerLevel&&learnerLevel!=='All levels'&&learnerLevel==='High school')visible=card.rank<=4;return{...card,visible}}))
  },[])

  const clientRefine = useCallback((chips: ActiveFilterChip[], zone: 'all' | 'web' | 'llm' | 'file' | 'webonly' | 'urls' = 'all') => {
    const t0 = Date.now(); setIsFiltering(true)
    const RANGE_IDS = new Set(['price','year','sqft','km','age','beds','baths'])

    function applyChips<T extends { title:string; snippet:string; source?:string; tags?:string[]; visible:boolean }>(
        cards: T[], chipList: ActiveFilterChip[]
      ): T[] {
        return cards.map(card => {
          if (chipList.length === 0) return { ...card, visible: true }
          const txt = [
            card.title, card.snippet, card.source ?? '',
            ...(card.tags ?? []),
            (card as any).price ?? '',
            (card as any).outlet ?? '',
            (card as any).forum ?? '',
            (card as any).videoChannel ?? '',
            (card as any).cardKind ?? '',
            (card as any).difficulty ?? '',
          ].join(' ').toLowerCase()
          for (const chip of chipList) {
            if (RANGE_IDS.has(chip.id)) continue
            if (!txt.includes(chip.value.toLowerCase())) return { ...card, visible: false }
          }
          return { ...card, visible: true }
        })
      }

      setAllWebCards(master => {
        const filtered = applyChips(master, zone === 'all' || zone === 'web' ? chips : [])
        setWebCards(filtered)
        return master
      })
      if (zone === 'all' || zone === 'llm')
        setLlmCards(prev => applyChips(prev, chips) as any)
      if (zone === 'all' || zone === 'file')
        setFileCards(prev => applyChips(prev, chips) as any)
      if (zone === 'all' || zone === 'webonly')
        setWebOnlyCards(prev => applyChips(prev, chips))
      if (zone === 'all' || zone === 'urls')
        setUrlCards(prev => applyChips(prev, chips))

      setFilterTime(Date.now() - t0)
      setTimeout(() => setIsFiltering(false), 300)
    }, [])

  const dismissCard=useCallback((id:string,zone:string)=>{
    if(zone==='web')     setWebCards(    p=>p.map(c=>c.id===id?{...c,visible:false,docSelected:false}:c))
    if(zone==='llm')     setLlmCards(    p=>p.map(c=>c.id===id?{...c,visible:false,docSelected:false}:c))
    if(zone==='file')    setFileCards(   p=>p.map(c=>c.id===id?{...c,visible:false,docSelected:false}:c))
    if(zone==='webonly') setWebOnlyCards(p=>p.map(c=>c.id===id?{...c,visible:false,docSelected:false}:c))
    if(zone==='urls')    setUrlCards(    p=>p.map(c=>c.id===id?{...c,visible:false,docSelected:false}:c))
    if(zone==='more')    setMoreCards(   p=>p.map(c=>c.id===id?{...c,visible:false,docSelected:false}:c))
  },[])

  const toggleDocSelect=useCallback((id:string,zone:string)=>{
    if(zone==='web')     setWebCards(    p=>p.map(c=>c.id===id&&!c.hasVideo?{...c,docSelected:!c.docSelected}:c))
    if(zone==='llm')     setLlmCards(    p=>p.map(c=>c.id===id?{...c,docSelected:!c.docSelected}:c))
    if(zone==='file')    setFileCards(   p=>p.map(c=>c.id===id?{...c,docSelected:!c.docSelected}:c))
    if(zone==='webonly') setWebOnlyCards(p=>p.map(c=>c.id===id?{...c,docSelected:!c.docSelected}:c))
    if(zone==='urls')    setUrlCards(    p=>p.map(c=>c.id===id?{...c,docSelected:!c.docSelected}:c))
    if(zone==='more')    setMoreCards(   p=>p.map(c=>c.id===id&&!c.hasVideo?{...c,docSelected:!c.docSelected}:c))
  },[])

  const clearDocSelections=useCallback(()=>{
    const clr=(p:any[])=>p.map(c=>({...c,docSelected:false}))
    setWebCards(clr);setLlmCards(clr);setFileCards(clr)
    setWebOnlyCards(clr);setUrlCards(clr);setMoreCards(clr)
  },[])

  const reorderCards=useCallback((zone:CardZone,oldIdx:number,newIdx:number)=>{
    const setFn=zone==='web'?setWebCards
      :zone==='file'?(setFileCards as any)
      :zone==='webonly'?setWebOnlyCards
      :zone==='urls'?setUrlCards
      :setMoreCards
    setFn((prev:any[])=>{const vis=prev.filter((c:any)=>c.visible),hid=prev.filter((c:any)=>!c.visible),next=[...vis];const[m]=next.splice(oldIdx,1);next.splice(newIdx,0,m);return[...next,...hid]})
  },[])

  const convertLinksToCards=useCallback((count:number)=>{
    setLinkResults(prev=>{
      const take=prev.slice(0,count),rest=prev.slice(count)
      if(!take.length)return prev
      setWebCards(p=>[...p,...take.map((l,i)=>({id:`link-${l.id}-${i}`,zone:'web' as CardZone,type:'article' as const,rank:21+i,title:l.title,source:l.url,snippet:l.snippet,tags:[],hasVideo:false,visible:true,docSelected:false}))])
      return rest
    })
  },[])

  const convertWebOnlyLinksToCards = useCallback((count:number)=>{
    setWebOnlyLinks(prev=>{
      const take=prev.slice(0,count), rest=prev.slice(count)
      if(!take.length) return prev
      setWebOnlyCards(p=>[...p,...take.map((l,i)=>({
        id:`wolink-${l.id}-${i}`,zone:'webonly' as CardZone,
        type:'article' as const,rank:20+i,
        title:l.title,source:l.url,snippet:l.snippet,
        tags:[],hasVideo:false,visible:true,docSelected:false,
      }))])
      return rest
    })
  },[])

  const clearWeb     =useCallback(()=>{setWebCards([]);setAllWebCards([]);setLinkResults([]);setHasSearched(false);setSearchTime(null);setFilterTime(null);setTotalCards(0);setWebSummaryTable(null);setWebCardGroups([])},[])
  const clearLlm     =useCallback(()=>{setLlmCards([]);setLlmSummaryTable(null);setLlmCardGroups([]);setHasLlmSearched(false);setLlmSearchTime(null)},[])
  const clearFile    =useCallback(()=>{setFileCards([]);setFileSummaryTable(null);setFileCardGroups([]);setHasAnalyzed(false);setAnalyzeTime(null)},[])
  const clearUrls    =useCallback(()=>{setUrlCards([]);setUrlSummaryTable(null);setHasUrlAnalyzed(false);setUrlAnalyzeTime(null)},[])
  const clearMore    =useCallback(()=>setMoreCards([]),[])

  // ▼▼▼ FIX 7: reset returns to general filters instead of clearing to [] ▼▼▼
  const reset=useCallback(()=>{
    setWebCards([]);setAllWebCards([]);setLlmCards([]);setFileCards([]);setMoreCards([])
    setWebOnlyCards([]);setUrlCards([]);setUrlSummaryTable(null)
    setLinkResults([])
    setSidebarFilters(DEFAULT_FILTERS.general)   // ← keeps sidebar visible after reset
    setApiError(null)
    setHasSearched(false);setHasLlmSearched(false);setHasAnalyzed(false)
    setHasWebOnlySearched(false);setHasUrlAnalyzed(false)
    setSearchTime(null);setFilterTime(null);setLlmSearchTime(null);setAnalyzeTime(null)
    setWebOnlySearchTime(null);setUrlAnalyzeTime(null);setTotalCards(0)
    setWebSummaryTable(null);setWebCardGroups([]);setLlmSummaryTable(null)
    setLlmCardGroups([]);setFileSummaryTable(null);setFileCardGroups([])
    setCurrentTopic('')
  },[])

  const allSelected=[
    ...webCards.filter(c=>c.docSelected&&c.visible&&!c.hasVideo),
    ...llmCards.filter(c=>c.docSelected&&c.visible),
    ...fileCards.filter(c=>c.docSelected&&c.visible),
    ...webOnlyCards.filter(c=>c.docSelected&&c.visible&&!c.hasVideo),
    ...urlCards.filter(c=>c.docSelected&&c.visible),
    ...moreCards.filter(c=>c.docSelected&&c.visible&&!c.hasVideo),
  ]

  const filteredTyped = {
    news:   modeFilter === 'all' || modeFilter === 'news'   ? webOnlyTyped.news   : [],
    videos: modeFilter === 'all' || modeFilter === 'videos' ? webOnlyTyped.videos : [],
    images: modeFilter === 'all' || modeFilter === 'images' ? webOnlyTyped.images : [],
    forums: modeFilter === 'all' || modeFilter === 'forums' ? webOnlyTyped.forums : [],
  }

  return{
    webCards:webCards.filter(c=>c.visible),linkResults,sidebarFilters,hasSearched,isSearching,
    searchTime,filterTime,isFiltering,totalCards,summaryTable:webSummaryTable,cardGroups:webCardGroups,webTopic,
    llmCards:llmCards.filter(c=>c.visible),llmSummaryTable,llmCardGroups,hasLlmSearched,isLlmSearching,llmSearchTime,
    fileCards:fileCards.filter(c=>c.visible),fileSummaryTable,fileCardGroups,isAnalyzing,hasAnalyzed,analyzeTime,
    webOnlyCards:webOnlyCards.filter(c=>c.visible),
    webOnlyLinks,
    webOnlyTyped,
    modeFilter, setModeFilter,
    filteredTyped,
    hasWebOnlySearched,isWebOnlySearching,webOnlySearchTime,
    urlCards:urlCards.filter(c=>c.visible),urlSummaryTable,isUrlAnalyzing,hasUrlAnalyzed,urlAnalyzeTime,lastUrlTask,
    moreCards:moreCards.filter(c=>c.visible),allCards,allSelected,
    isMoreLoading,
    hasWeb,hasLlm,hasFile,hasWebOnly,hasUrls,hasMore,hasLinks,hasAny,
    apiError,currentTopic,
    search, llmSearch, analyzeFile, webonlySearch, analyzeUrls, addMoreQuestion, clientRefine,
    convertWebOnlyLinksToCards,
    clearWeb,clearLlm,clearFile,clearWebOnly,clearUrls,clearMore,reset,
    dismissCard,toggleDocSelect,clearDocSelections,reorderCards,convertLinksToCards,
  }
}
