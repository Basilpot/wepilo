import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraggableSyntheticListeners, DraggableAttributes } from "@dnd-kit/core";

export type DragHandleProps = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (el: HTMLElement | null) => void;
};

export function DragHandle({ handle, className }: { handle: DragHandleProps; className?: string }) {
  return (
    <button
      type="button"
      ref={handle.setActivatorNodeRef}
      aria-label="Drag to reorder"
      className={cn(
        "flex h-6 w-6 cursor-grab items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing",
        className,
      )}
      {...handle.attributes}
      {...handle.listeners}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
}

function SortableRow<T>({
  item,
  id,
  renderItem,
  className,
}: {
  item: T;
  id: string;
  renderItem: (item: T, handle: DragHandleProps) => React.ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={className}>
      {renderItem(item, { attributes, listeners, setActivatorNodeRef })}
    </div>
  );
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  grid,
  className,
  footer,
}: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, handle: DragHandleProps) => React.ReactNode;
  grid?: boolean;
  className?: string;
  footer?: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => getId(i) === active.id);
    const newIndex = items.findIndex((i) => getId(i) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableRow key={getId(item)} id={getId(item)} item={item} renderItem={(i, handle) => renderItem(i, index, handle)} />
          ))}
          {footer}
        </div>
      </SortableContext>
    </DndContext>
  );
}
