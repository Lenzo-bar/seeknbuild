export type CardType  = 'math' | 'article' | 'video' | 'image' | 'file' | 'news' | 'forum' | 'shopping'
export type CardZone  = 'web' | 'file' | 'more'
export type AppMode   = 'web' | 'llm' | 'file'
export type ThemeName = 'light' | 'dark' | 'blue'

export type SearchMode =
  | 'all' | 'news' | 'images' | 'videos'
  | 'forums' | 'shopping' | 'entertainment' | 'sports' | 'hobby'

export interface SearchModeConfig {
  id: SearchMode
  label: string
  subOptions?: { id: string; label: string }[]
}

export interface SearchCard {
  id: string
  zone: CardZone
  type: CardType
  rank: number
  title: string
  source: string
  snippet: string
  math?: string
  steps?: string[]
  tags: string[]
  hasVideo: boolean
  visible: boolean
  docSelected: boolean
  imageUrl?: string
  videoId?: string
  videoThumb?: string
  videoDuration?: string
  videoChannel?: string
  publishedAt?: string
  outlet?: string
  price?: string
  rating?: number
  upvotes?: number
  replies?: number
  forum?: string
}

export interface LinkResult {
  id: string
  title: string
  url: string
  snippet: string
  rank: number
}

export interface FilterState {
  checkboxes: Record<string, boolean>
  learnerLevel: string
  extraFilter: string
}

export interface SidebarFilterSection {
  id: string
  label: string
  type: 'checkboxes' | 'range' | 'select' | 'radio'
  options?: string[]
  min?: number
  max?: number
  unit?: string
}

export interface SidebarFilters {
  sections: SidebarFilterSection[]
  values: Record<string, unknown>
}
