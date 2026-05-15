// src/data/filterCategories.ts
import type { FilterCategory } from '../types'

export function getFilterCategory(topic: string): FilterCategory {
  const t = topic.toLowerCase()
  if (/math|calculus|algebra|science|physics|chemistry|biology|history|philosophy|economics|engineering|medicine|law|university|student|research|theorem|proof|equation/.test(t)) return 'academia'
  if (/buy|sell|price|rent|lease|house|condo|car|shop|store|deal|discount|market|real.?estate|property|vehicle|product|amazon/.test(t)) return 'buying-selling'
  return 'general'
}
