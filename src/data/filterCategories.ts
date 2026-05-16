// src/data/filterCategories.ts
import type { FilterCategory } from '../types'

export function getFilterCategory(topic: string): FilterCategory {
  const t = topic.toLowerCase()
  if (/math|calculus|algebra|science|physics|chemistry|biology|history|philosophy|economics|engineering|medicine|law|university|student|research|theorem|proof|equation/.test(t)) return 'academia'
  if (/buy|sell|price|rent|lease|house|condo|car|shop|store|deal|discount|market|real.?estate|property|vehicle|product|amazon/.test(t)) return 'buying-selling'
  return 'general'
}

export const ACADEMIA_LEVELS = [
  'Any level',
  'General public',
  'Elementary school',
  'Middle school',
  'High school',
  'University — undergraduate',
  'University — graduate',
  'Advanced research',
]

export const ACADEMIA_PRIMARIES: Record<string, string[]> = {
  default: [
    'Step-by-step explanations', 'Formal definitions', 'Real-world examples',
    'Historical context', 'Visual aids', 'Practice exercises',
    'Research-based', 'Comparative analysis', 'Critical thinking', 'Applications',
  ],
}

export const ACADEMIA_SECONDARY_A: Record<string, string[]> = {
  default: [
    'Introductory', 'Intermediate', 'Advanced', 'Specialized', 'Survey',
    'Applied', 'Theoretical', 'Historical', 'Comparative', 'Interdisciplinary',
  ],
}

export const ACADEMIA_SECONDARY_B: Record<string, string[]> = {
  default: [
    'Article', 'Video', 'Podcast', 'Book', 'Course', 'Tutorial',
    'Research paper', 'Interactive', 'Infographic', 'Quiz',
  ],
}

export const BUYING_SELLING_FILTERS: Record<string, Array<{
  id: string
  label: string
  type: 'checkboxes' | 'radio' | 'select' | 'range'
  options?: string[]
  unit?: string
}>> = {
  'real-estate': [
    { id: 'price',   label: 'Price Range',   type: 'range',      unit: '$' },
    { id: 'beds',    label: 'Bedrooms',      type: 'radio',      options: ['Any', '1', '2', '3', '4', '5+'] },
    { id: 'type',    label: 'Property Type', type: 'checkboxes', options: ['House', 'Condo', 'Townhouse', 'Land'] },
    { id: 'listing', label: 'Listing Type',  type: 'radio',      options: ['For Sale', 'For Rent'] },
  ],
  automotive: [
    { id: 'make',  label: 'Make',       type: 'checkboxes', options: ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW', 'Hyundai'] },
    { id: 'year',  label: 'Year Range', type: 'range',      unit: '' },
    { id: 'price', label: 'Price',      type: 'range',      unit: '$' },
    { id: 'cond',  label: 'Condition',  type: 'radio',      options: ['New', 'Used', 'Certified Pre-Owned'] },
  ],
  default: [
    { id: 'price',  label: 'Price Range', type: 'range',      unit: '$' },
    { id: 'rating', label: 'Min Rating',  type: 'radio',      options: ['Any', '3+ stars', '4+ stars'] },
    { id: 'cond',   label: 'Condition',   type: 'radio',      options: ['New', 'Used', 'Refurbished'] },
  ],
}