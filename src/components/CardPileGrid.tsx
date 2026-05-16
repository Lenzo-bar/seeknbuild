import { useState, useEffect, useRef } from 'react'
import type { SearchCard, CardZone } from '../types'
import { SearchCard as SearchCardComp } from './SearchCard'
import type { CardGroupOption } from './CardGroupBar'
import styles from './CardPileGrid.module.css'

interface Props {
  cards:       SearchCard[]
  zone:        CardZone
  cols:        number
  activeGroup: CardGroupOption
  customGroupName?: string       // used when group id starts with "custom:"
  expandedId:  string | null
  onExpand:    (id: string) => void
  onDismiss:   (id: string) => void
  onToggleDoc: (id: string) => void
  onReorder:   (zone: CardZone, oldIdx: number, newIdx: number) => void
}

interface Pile {
  groupKey: string
  label:    string
  cards:    SearchCard[]
}

// ── Group cards into piles based on active group ─────────────────────────────
function buildPiles(cards: SearchCard[], group: CardGroupOption, customName?: string): Pile[] {
  const pileMap = new Map<string, SearchCard[]>()

  // Seed piles from subItems so order is preserved
  const subItems = group.subItems.length > 0
    ? group.subItems
    : ['Other']

  subItems.forEach(item => pileMap.set(item, []))
  pileMap.set('Other', pileMap.get('Other') ?? [])

  cards.forEach(card => {
    // Try groupValues first (AI-assigned)
    const gv = (card as any).groupValues
    const assignedValue = gv?.[group.id] || gv?.[group.cardKeyword]

    if (assignedValue) {
      // Find best-matching subItem (case-insensitive partial)
      const match = subItems.find(s =>
        s.toLowerCase() === assignedValue.toLowerCase() ||
        s.toLowerCase().includes(assignedValue.toLowerCase()) ||
        assignedValue.toLowerCase().includes(s.toLowerCase())
      )
      const key = match || assignedValue
      if (!pileMap.has(key)) pileMap.set(key, [])
      pileMap.get(key)!.push(card)
      return
    }

    // Fallback: scan title + snippet + source + tags for subItem keywords
    const text = [card.title, card.snippet, card.source, ...(card.tags || [])].join(' ').toLowerCase()
    let placed = false
    for (const item of subItems) {
      if (text.includes(item.toLowerCase())) {
        pileMap.get(item)!.push(card)
        placed = true
        break
      }
    }
    if (!placed) {
      pileMap.get('Other')!.push(card)
    }
  })

  // Build result — skip empty piles except "Other" if non-empty
  const result: Pile[] = []
  pileMap.forEach((pileCards, key) => {
    if (pileCards.length === 0) return
    result.push({
      groupKey: key,
      label:    key,
      cards:    pileCards,
    })
  })

  return result
}

// ── Single pile component ─────────────────────────────────────────────────────
interface PileProps {
  pile:        Pile
  zone:        CardZone
  expandedId:  string | null
  gridCol:     number          // which CSS grid column the first card occupies
  animating:   boolean
  onExpand:    (id: string) => void
  onDismiss:   (id: string) => void
  onToggleDoc: (id: string) => void
}

function CardPile({ pile, zone, expandedId, animating, onExpand, onDismiss, onToggleDoc }: PileProps) {
  const [topIndex, setTopIndex] = useState(0)

  // Reset when pile changes
  useEffect(() => { setTopIndex(0) }, [pile.cards.length])

  const front   = pile.cards[topIndex]
  const ghost   = pile.cards[topIndex + 1] ?? null
  const remaining = pile.cards.length - 1

  if (!front) return null

  return (
    <div className={`${styles.pile} ${animating ? styles.pileAnimating : ''}`}>
      {/* Pile header */}
      <div className={styles.pileHeader}>
        <span className={styles.pileLabel}>{pile.label}</span>
        <span className={styles.pileCount}>{pile.cards.length} card{pile.cards.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Stack wrapper */}
      <div className={styles.stackWrap}>
        {/* Ghost card — 1 card peeking behind with offset + opacity */}
        {ghost && (
          <div
            className={styles.ghostCard}
            title={`${ghost.title} — click to bring to front`}
            onClick={() => {
              // Bring clicked ghost to front by rotating the pile
              setTopIndex(i => (i + 1) % pile.cards.length)
            }}
          >
            <div className={styles.ghostHeader}>
              <span className={styles.ghostRank}>#{ghost.rank}</span>
              <span className={styles.ghostTitle}>{ghost.title}</span>
            </div>
          </div>
        )}

        {/* Front card — full SearchCard */}
        <div className={styles.frontCard}>
          <SearchCardComp
            card={front}
            zone={zone}
            faded={false}
            onExpand={() => onExpand(front.id)}
            onDismiss={() => onDismiss(front.id)}
            onToggleDoc={() => onToggleDoc(front.id)}
          />
        </div>
      </div>

      {/* Navigation — cycle through pile */}
      {pile.cards.length > 1 && (
        <div className={styles.pileNav}>
          <button
            className={styles.navBtn}
            onClick={() => setTopIndex(i => (i - 1 + pile.cards.length) % pile.cards.length)}
            title="Previous card"
          >‹</button>
          <span className={styles.navInfo}>
            {topIndex + 1} / {pile.cards.length}
          </span>
          <button
            className={styles.navBtn}
            onClick={() => setTopIndex(i => (i + 1) % pile.cards.length)}
            title="Next card"
          >›</button>
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function CardPileGrid({
  cards, zone, cols, activeGroup, customGroupName,
  expandedId, onExpand, onDismiss, onToggleDoc, onReorder,
}: Props) {
  const [animating, setAnimating] = useState(false)
  const prevGroupId = useRef<string>(activeGroup.id)

  // Trigger slide animation whenever group changes
  useEffect(() => {
    if (prevGroupId.current !== activeGroup.id) {
      setAnimating(true)
      const t = setTimeout(() => setAnimating(false), 420)
      prevGroupId.current = activeGroup.id
      return () => clearTimeout(t)
    }
  }, [activeGroup.id])

  const piles = buildPiles(cards, activeGroup, customGroupName)

  if (piles.length === 0) {
    return (
      <div className={styles.emptyMsg}>
        No cards could be grouped under "{activeGroup.label}". Try a different category.
      </div>
    )
  }

  return (
    <div
      className={styles.pileGrid}
      style={{ gridTemplateColumns: `repeat(${Math.min(cols, piles.length)}, 1fr)` }}
    >
      {piles.map((pile, i) => (
        <CardPile
          key={pile.groupKey}
          pile={pile}
          zone={zone}
          expandedId={expandedId}
          gridCol={i}
          animating={animating}
          onExpand={onExpand}
          onDismiss={onDismiss}
          onToggleDoc={onToggleDoc}
        />
      ))}
    </div>
  )
}
