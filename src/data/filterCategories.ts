// filterCategories.ts
// Defines the two main filter categories + topic→category mapping

export type FilterCategory = 'buying-selling' | 'academia' | 'general'

// ── Topic → Category mapping ─────────────────────────────────────
export function getFilterCategory(topic: string): FilterCategory {
  const academia = ['math','science','tech','health','philosophy','art','finance',
                    'economics','history','literature','language','engineering',
                    'education','research','academia']
  const buyingSelling = ['real-estate','automotive','shopping','travel','food',
                         'entertainment','hobby','sports']
  if (academia.some(t => topic.includes(t))) return 'academia'
  if (buyingSelling.some(t => topic.includes(t))) return 'buying-selling'
  return 'general'
}

// ── Academia primary checkboxes (5–10) ───────────────────────────
export const ACADEMIA_PRIMARIES: Record<string, string[]> = {
  math: [
    'Step-by-step solutions','Formal notation','Convergence tests',
    'Geometric interpretation','Physics applications',
    'Engineering applications','Multiple examples','Practice problems',
    'Proof-based','Software / CAS examples',
  ],
  science: [
    'Lab experiments','Theoretical framework','Real-world applications',
    'Historical context','Mathematical derivation',
    'Case studies','Visual diagrams','Practice problems',
    'Research papers','Simulations',
  ],
  philosophy: [
    'Primary texts','Critical analysis','Historical context',
    'Contemporary debates','Comparative study',
    'Ethics focus','Logic & argumentation','Mind & consciousness',
  ],
  economics: [
    'Macroeconomics','Microeconomics','Mathematical models',
    'Policy implications','Case studies',
    'Historical data','Behavioral economics','Global markets',
  ],
  default: [
    'Step-by-step explanations','Formal definitions','Real-world examples',
    'Historical context','Visual aids',
    'Practice exercises','Research-based','Comparative analysis',
    'Critical thinking','Applications',
  ],
}

export const ACADEMIA_LEVELS = [
  'General public',
  'Elementary school',
  'Middle school',
  'High school',
  'University — undergraduate',
  'University — graduate',
  'Advanced research',
]

export const ACADEMIA_SECONDARY_A: Record<string, string[]> = {
  math: ['Algebra','Calculus','Statistics','Geometry','Linear Algebra',
         'Differential Equations','Number Theory','Topology','Probability','Discrete Math'],
  science: ['Physics','Chemistry','Biology','Astronomy','Earth Science',
            'Neuroscience','Genetics','Ecology','Quantum Mechanics','Thermodynamics'],
  philosophy: ['Ethics','Epistemology','Metaphysics','Logic','Aesthetics',
               'Political Philosophy','Philosophy of Mind','Philosophy of Science'],
  economics: ['Microeconomics','Macroeconomics','Behavioral Economics','Development Economics',
              'International Trade','Monetary Policy','Game Theory','Econometrics'],
  default: ['Introductory','Intermediate','Advanced','Specialized','Survey',
            'Applied','Theoretical','Historical','Comparative','Interdisciplinary'],
}

export const ACADEMIA_SECONDARY_B: Record<string, string[]> = {
  math: ['Article','Video lecture','Interactive tool','Textbook chapter',
         'Problem set','Proof walkthrough','Visual demo','Course syllabus'],
  science: ['Lecture','Lab guide','Research paper','Textbook','Documentary',
            'Simulation','Data set','Review article'],
  philosophy: ['Essay','Lecture','Primary source','Commentary','Debate','Podcast','Book chapter'],
  economics: ['Paper','Lecture','Data report','Policy brief','Case study',
              'Interactive model','News analysis','Book chapter'],
  default: ['Article','Video','Podcast','Book','Course','Tutorial',
            'Research paper','Interactive','Infographic','Quiz'],
}

// ── Buying/Selling filters by topic ──────────────────────────────
export const BUYING_SELLING_FILTERS: Record<string, Array<{
  id: string; label: string; type: 'checkboxes'|'radio'|'select'|'range'; options?: string[]; unit?: string
}>> = {
  'real-estate': [
    { id: 'price',    label: 'Price Range',    type: 'range',      unit: '$' },
    { id: 'beds',     label: 'Bedrooms',       type: 'radio',      options: ['Any','1','2','3','4','5+'] },
    { id: 'baths',    label: 'Bathrooms',      type: 'radio',      options: ['Any','1','2','3','4+'] },
    { id: 'sqft',     label: 'Size (sqft)',    type: 'range',      unit: 'sqft' },
    { id: 'proptype', label: 'Property Type',  type: 'checkboxes', options: ['House','Condo','Townhouse','Land','Commercial'] },
    { id: 'listing',  label: 'Listing Type',   type: 'radio',      options: ['For Sale','For Rent','Both'] },
    { id: 'age',      label: 'Year Built',     type: 'range',      unit: '' },
  ],
  automotive: [
    { id: 'make',     label: 'Make',           type: 'checkboxes', options: ['Toyota','Honda','Ford','Chevrolet','BMW','Hyundai','Kia','Tesla'] },
    { id: 'year',     label: 'Year Range',     type: 'range',      unit: '' },
    { id: 'price',    label: 'Price',          type: 'range',      unit: '$' },
    { id: 'cond',     label: 'Condition',      type: 'radio',      options: ['New','Used','Certified Pre-Owned'] },
    { id: 'trans',    label: 'Transmission',   type: 'radio',      options: ['Any','Automatic','Manual'] },
    { id: 'fuel',     label: 'Fuel Type',      type: 'checkboxes', options: ['Gas','Diesel','Electric','Hybrid'] },
    { id: 'km',       label: 'Mileage (km)',   type: 'range',      unit: 'km' },
  ],
  shopping: [
    { id: 'price',    label: 'Price Range',    type: 'range',      unit: '$' },
    { id: 'rating',   label: 'Min Rating',     type: 'radio',      options: ['Any','3+ stars','4+ stars','4.5+ stars'] },
    { id: 'avail',    label: 'Availability',   type: 'radio',      options: ['Any','In Stock'] },
    { id: 'ship',     label: 'Shipping',       type: 'checkboxes', options: ['Free shipping','Same-day','Next-day'] },
  ],
  sports: [
    { id: 'league',   label: 'League',         type: 'checkboxes', options: ['NBA','NFL','NHL','MLB','MLS','EPL','NCAA'] },
    { id: 'team',     label: 'Team',           type: 'select',     options: ['Any team'] },
    { id: 'date',     label: 'Date',           type: 'select',     options: ['Today','This week','This month','This season'] },
    { id: 'dtype',    label: 'Content',        type: 'checkboxes', options: ['Scores','Stats','News','Video highlights'] },
  ],
  news: [
    { id: 'date',     label: 'Date',           type: 'select',     options: ['Past hour','Today','This week','This month'] },
    { id: 'source',   label: 'Source Type',    type: 'checkboxes', options: ['News outlet','Blog','Official','Wire service'] },
    { id: 'region',   label: 'Region',         type: 'select',     options: ['Any','Canada','USA','UK','International'] },
  ],
  general: [
    { id: 'ctype',    label: 'Content Type',   type: 'checkboxes', options: ['Article','Video','Forum','Blog','Official'] },
    { id: 'date',     label: 'Date',           type: 'select',     options: ['Any time','Past week','Past month','Past year'] },
    { id: 'lang',     label: 'Language',       type: 'radio',      options: ['Any','English','French','Spanish'] },
  ],
}
