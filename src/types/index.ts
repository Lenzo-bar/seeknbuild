export type CardType       = 'math'|'article'|'video'|'image'|'file'|'news'|'forum'|'shopping'|'llm'
export type CardZone       = 'web'|'file'|'more'|'webonly'|'urls'
export type AppMode        = 'web'|'llm'|'file'|'webonly'|'urls'
export type ThemeName      = 'light'|'warm'|'dark'|'blue'
export type FilterCategory = 'buying-selling'|'academia'|'general'

export type SearchMode =
  | 'all'|'news'|'images'|'videos'|'forums'
  | 'shopping'|'entertainment'|'sports'|'hobby'

export interface SearchModeConfig {
  id: SearchMode
  label: string
  subOptions?: { id: string; label: string }[]
}

export interface SearchCard {
  id: string; zone: CardZone; type: CardType; rank: number
  title: string; source: string; snippet: string
  math?: string; steps?: string[]; tags: string[]
  hasVideo: boolean; visible: boolean; docSelected: boolean
  imageUrl?: string; videoId?: string; videoThumb?: string
  videoDuration?: string; videoChannel?: string
  publishedAt?: string; outlet?: string
  price?: string; rating?: number
  upvotes?: number; replies?: number; forum?: string
}

export interface LinkResult {
  id: string; rank: number; title: string; url: string; snippet: string
}

export interface FilterState {
  checkboxes: Record<string, boolean>
  learnerLevel: string
  extraFilter: string
}

export interface SidebarFilterSection {
  id: string
  label: string
  type: 'checkboxes'|'radio'|'select'|'range'
  options?: string[]
  min?: number; max?: number; unit?: string
}

export interface AcademiaFilterState {
  primaryChecks: Record<string, boolean>
  level: string
  secondaryA: string
  secondaryB: string
}

export interface ActiveFilterChip {
  id:         string
  sectionId?: string          // which sidebar section this came from
  label:      string
  value:      string
  category?:  FilterCategory  // optional — not all chips have a category
}