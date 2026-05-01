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
      <SearchCard
        card={card} zone={zone}
        faded={expandedId !== null && card.id !== expandedId}
        isDragging={isDragging}
        dragListeners={listeners}
        dragAttributes={attributes}
        onExpand={() => onExpand(card.id)}
        onDismiss={() => onDismiss(card.id)}
        onToggleDoc={() => onToggleDoc(card.id)}
      />
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
