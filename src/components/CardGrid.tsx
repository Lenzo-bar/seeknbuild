import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SearchCard as CardData, CardZone } from '../types'
import { SearchCard } from './SearchCard'
import styles from './CardGrid.module.css'

function SortableCard({ card, zone, expandedId, onExpand, onDismiss, onToggleDoc }: {
  card: CardData; zone: CardZone; expandedId: string | null
  onExpand: (id: string) => void; onDismiss: (id: string) => void; onToggleDoc: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })

  return (
    <div
      ref={setNodeRef}
      className={styles.cardWrapper}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.55 : undefined,
      }}
    >
      {/* ── Drag handle — grab cursor lives here only ── */}
      <div
        className={`${styles.dragHandle} ${isDragging ? styles.dragHandleActive : ''}`}
        {...listeners}
        {...attributes}
        title="Drag to reorder"
      >
        <GripIcon />
      </div>

      {/* ── Card body — pointer cursor, click to expand ── */}
      <div className={styles.cardBody} onClick={() => onExpand(card.id)}>
        <SearchCard
          card={card} zone={zone}
          faded={expandedId !== null && card.id !== expandedId}
          dragListeners={undefined}
          dragAttributes={undefined}
          onExpand={() => onExpand(card.id)}
          onDismiss={() => onDismiss(card.id)}
          onToggleDoc={() => onToggleDoc(card.id)}
        />
      </div>
    </div>
  )
}

interface Props {
  cards: CardData[]; zone: CardZone; cols: number; expandedId: string | null
  onReorder: (zone: CardZone, oldIndex: number, newIndex: number) => void
  onExpand: (id: string) => void; onDismiss: (id: string) => void; onToggleDoc: (id: string) => void
}

export function CardGrid({ cards, zone, cols, expandedId, onReorder, onExpand, onDismiss, onToggleDoc }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = cards.findIndex(c => c.id === active.id)
    const newIndex = cards.findIndex(c => c.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) onReorder(zone, oldIndex, newIndex)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={cards.map(c => c.id)} strategy={rectSortingStrategy}>
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {cards.map(card => (
            <SortableCard
              key={card.id} card={card} zone={zone} expandedId={expandedId}
              onExpand={onExpand} onDismiss={onDismiss} onToggleDoc={onToggleDoc}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/* ── Grip icon ── */
function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5"  cy="4"  r="1.3"/>
      <circle cx="11" cy="4"  r="1.3"/>
      <circle cx="5"  cy="8"  r="1.3"/>
      <circle cx="11" cy="8"  r="1.3"/>
      <circle cx="5"  cy="12" r="1.3"/>
      <circle cx="11" cy="12" r="1.3"/>
    </svg>
  )
}
