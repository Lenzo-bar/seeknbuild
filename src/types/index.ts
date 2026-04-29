export type CardType  = 'math'|'article'|'video'|'image'|'file'|'news'|'forum'|'shopping'|'llm'
export type CardZone  = 'web'|'file'|'more'
export type AppMode   = 'web'|'llm'|'file'
export type ThemeName = 'light'|'warm'|'dark'|'blue'
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

// Sidebar filter section — shared by both categories
export interface SidebarFilterSection {
  id: string
  label: string
  type: 'checkboxes'|'radio'|'select'|'range'
  options?: string[]
  min?: number; max?: number; unit?: string
}

// Academia-specific sidebar shape
export interface AcademiaFilterState {
  primaryChecks: Record<string, boolean>   // up to 10 checkboxes
  level: string                            // learner level dropdown
  secondaryA: string                       // sub-topic dropdown
  secondaryB: string                       // format/type dropdown
}

// Active filter chip shown below prompt
export interface ActiveFilterChip {
  id: string
  label: string
  value: string
  category: FilterCategory
}
