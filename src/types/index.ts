export type CardType = 'math' | 'article' | 'video' | 'image' | 'file'
export type CardZone = 'web' | 'file' | 'more'
export type AppMode  = 'web' | 'llm' | 'file'
export type ThemeName = 'light' | 'dark' | 'blue'

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

export interface ButtonStates {
  search:   boolean   // active when mode=web and not yet loading
  analyze:  boolean   // active when mode=file AND file chosen
  moreQ:    boolean   // active when hasAny
  clearWeb: boolean   // active when hasWeb || hasLinks
  clearFile:boolean   // active when hasFile
  reset:    boolean   // active when hasAny || prompt has text
}
