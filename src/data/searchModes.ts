import type { SearchModeConfig } from '../types'

export const SEARCH_MODES: SearchModeConfig[] = [
  { id: 'all',           label: 'All' },
  { id: 'news',          label: 'News' },
  { id: 'images',        label: 'Images' },
  { id: 'videos',        label: 'Videos' },
  { id: 'forums',        label: 'Forums' },
  { id: 'shopping',      label: 'Shopping' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'sports',        label: 'Sports' },
  {
    id: 'hobby',
    label: 'Hobby',
    subOptions: [
      { id: 'carpentry',  label: 'Carpentry' },
      { id: 'collection', label: 'Collection' },
      { id: 'fishing',    label: 'Fishing' },
    ],
  },
]
