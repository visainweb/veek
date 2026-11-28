"use client";

import { useCallback, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveTask, quickCreateTask } from "@/app/actions/tasks";
import { createColumn, deleteColumn, moveColumn, renameColumn } from "@/app/actions/projects";
import { TaskCardView } from "@/components/task-card";
import { TaskDialog, canEditTasks, type TaskPermissions } from "@/components/task-dialog";
import type { BoardColumn, Person, Task } from "@/lib/types";

type Col = Pick<BoardColumn, "id" | "name" | "position">;
type Items = Record<string, Task[]>;

const COL = "col:";
const isColId = (id: UniqueIdentifier) => String(id).startsWith(COL);
const colKey = (id: string) => `${COL}${id}`;
const fromColKey = (id: UniqueIdentifier) => String(id).slice(COL.length);

function groupTasks(columns: Col[], tasks: Task[]): Items {
  const items: Items = Object.fromEntries(columns.map((c) => [c.id, [] as Task[]]));
  for (const t of [...tasks].sort((a, b) => a.position - b.position)) {
    if (t.column_id && items[t.column_id]) items[t.column_id].push(t);
  }
  return items;
}

/** Posición entre dos vecinas (se guardan como números con decimales). */
function positionBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return 1000;
  if (before === undefined) return after! - 1000;
  if (after === undefined) return before + 1000;
  return (before + after) / 2;
}

/** Tablero estilo Asana: columnas y tareas que se arrastran. */
export function Board({
  projectId,
  columns,
  tasks,
  people,
  permissions,
}: {
  projectId: string;
  columns: Col[];
  tasks: Task[];
  people: Person[];
  permissions: TaskPermissions;
}) {
  const canEdit = canEditTasks(permissions.role);

  // Copia local para mover al instante; se reemplaza cuando llegan datos nuevos del servidor
  const [source, setSource] = useState({ columns, tasks });
  const [cols, setCols] = useState(columns);
  const [items, setItems] = useState(() => groupTasks(columns, tasks));
  if (source.columns !== columns || source.tasks !== tasks) {
    setSource({ columns, tasks });
    setCols(columns);
    setItems(groupTasks(columns, tasks));
  }

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [dragFrom, setDragFrom] = useState<{ column: string; index: number } | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeDialog = useCallback(() => setOpenTaskId(null), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findColumn(id: UniqueIdentifier, from: Items = items) {
    if (isColId(id)) return fromColKey(id);
    return Object.keys(from).find((c) => from[c].some((t) => t.id === id));
  }

  // Al mover una columna solo cuentan las columnas; al mover una tarea, todo
  const collisionDetection: CollisionDetection = (args) => {
    if (args.active && isColId(args.active.id)) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => isColId(c.id)),
      });
    }
    return closestCorners(args);
  };

  function revert() {
    setCols(columns);
    setItems(groupTasks(columns, tasks));
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
    setError(null);
    if (!isColId(active.id)) {
      const column = findColumn(active.id);
      if (column) setDragFrom({ column, index: items[column].findIndex((t) => t.id === active.id) });
    }
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || isColId(active.id)) return;
    const from = findColumn(active.id);
    const to = findColumn(over.id);
    if (!from || !to || from === to) return;

    setItems((prev) => {
      const moving = prev[from].find((t) => t.id === active.id);
      if (!moving) return prev;
      const target = prev[to];
      const overIndex = isColId(over.id) ? target.length : target.findIndex((t) => t.id === over.id);
      const index = overIndex < 0 ? target.length : overIndex;
      return {
        ...prev,
        [from]: prev[from].filter((t) => t.id !== active.id),
        [to]: [...target.slice(0, index), { ...moving, column_id: to }, ...target.slice(index)],
      };
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const start = dragFrom;
    setDragFrom(null);
    if (!over) return revert();

    // Mover una columna
    if (isColId(active.id)) {
      const oldIndex = cols.findIndex((c) => colKey(c.id) === active.id);
      const overCol = findColumn(over.id);
      const newIndex = cols.findIndex((c) => c.id === overCol);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(cols, oldIndex, newIndex);
      const position = positionBetween(next[newIndex - 1]?.position, next[newIndex + 1]?.position);
      next[newIndex] = { ...next[newIndex], position };
      setCols(next);
      const result = await moveColumn(next[newIndex].id, position);
      if (!result.ok) {
        setError(result.error);
        revert();
      }
      return;
    }

    // Mover una tarea (onDragOver ya la pasó de columna si hacía falta)
    const column = findColumn(active.id);
    if (!column) return revert();
    let list = items[column];
    const oldIndex = list.findIndex((t) => t.id === active.id);
    const overIndex = isColId(over.id) ? list.length - 1 : list.findIndex((t) => t.id === over.id);
    const newIndex = overIndex < 0 ? oldIndex : overIndex;
    if (oldIndex !== newIndex) list = arrayMove(list, oldIndex, newIndex);

    if (start && start.column === column && start.index === newIndex) {
      return; // Volvió a su lugar
    }

    const position = positionBetween(list[newIndex - 1]?.position, list[newIndex + 1]?.position);
    list = list.map((t, i) => (i === newIndex ? { ...t, position, column_id: column } : t));
    setItems((prev) => ({ ...prev, [column]: list }));

    const result = await moveTask(String(active.id), column, position);
    if (!result.ok) {
      setError(result.error);
      revert();
    }
  }

  const activeTask =
    activeId && !isColId(activeId) ? Object.values(items).flat().find((t) => t.id === activeId) : undefined;
  const activeCol = activeId && isColId(activeId) ? cols.find((c) => colKey(c.id) === activeId) : undefined;
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : undefined;
  const columnOptions = cols.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error && <p className="mx-6 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <DndContext
        id={`board-${projectId}`}
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setDragFrom(null);
          revert();
        }}
      >
        <div className="flex flex-1 items-start gap-4 overflow-x-auto p-4 md:p-6">
          <SortableContext items={cols.map((c) => colKey(c.id))} strategy={horizontalListSortingStrategy}>
            {cols.map((col) => (
              <Column
                key={col.id}
                column={col}
                tasks={items[col.id] ?? []}
                otherColumns={cols.filter((c) => c.id !== col.id)}
                projectId={projectId}
                people={people}
                canEdit={canEdit}
                onOpenTask={setOpenTaskId}
              />
            ))}
          </SortableContext>
          {canEdit && <AddColumn projectId={projectId} />}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-[16.5rem]">
              <TaskCardView task={activeTask} people={people} canEdit={false} overlay />
            </div>
          ) : activeCol ? (
            <div className="w-72 rotate-1 rounded-xl bg-zinc-200 p-3 text-sm font-semibold text-zinc-700 shadow-lg">
              {activeCol.name}
              <span className="ml-2 text-xs font-normal text-zinc-500">{items[activeCol.id]?.length ?? 0}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {openTask && (
        <TaskDialog
          key={openTask.id}
          task={openTask}
          people={people}
          columns={columnOptions}
          permissions={permissions}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

function Column({
  column,
  tasks,
  otherColumns,
  projectId,
  people,
  canEdit,
  onOpenTask,
}: {
  column: Col;
  tasks: Task[];
  otherColumns: Col[];
  projectId: string;
  people: Person[];
  canEdit: boolean;
  onOpenTask: (id: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: colKey(column.id),
    disabled: !canEdit,
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-zinc-100 p-3 ${isDragging ? "opacity-40" : ""}`}
    >
      <ColumnHeader
        column={column}
        count={tasks.length}
        otherColumns={otherColumns}
        canEdit={canEdit}
        dragHandle={{ ...attributes, ...listeners }}
      />

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-10 flex-col gap-2 overflow-y-auto">
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} people={people} canEdit={canEdit} onOpen={onOpenTask} />
          ))}
        </div>
      </SortableContext>

      {canEdit && (
        <AddTask
          projectId={projectId}
          columnId={column.id}
          people={people}
          lastPosition={tasks[tasks.length - 1]?.position}
        />
      )}
    </section>
  );
}

function SortableTask({
  task,
  people,
  canEdit,
  onOpen,
}: {
  task: Task;
  people: Person[];
  canEdit: boolean;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task.id);
        listeners?.onKeyDown?.(e);
      }}
      className="touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg"
    >
      <TaskCardView task={task} people={people} canEdit={canEdit} dragging={isDragging} />
    </div>
  );
}

function ColumnHeader({
  column,
  count,
  otherColumns,
  canEdit,
  dragHandle,
}: {
  column: Col;
  count: number;
  otherColumns: Col[];
  canEdit: boolean;
  dragHandle: Record<string, unknown>;
}) {
  const [mode, setMode] = useState<"view" | "menu" | "rename" | "delete">("view");
  const [name, setName] = useState(column.name);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveName() {
    const clean = name.trim();
    if (!clean || clean === column.name) {
      setName(column.name);
      setMode("view");
      return;
    }
    startTransition(async () => {
      const result = await renameColumn(column.id, clean);
      if (result.ok) setMode("view");
      else setError(result.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteColumn(column.id, count > 0 ? target || otherColumns[0]?.id || null : null);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 px-1">
        {mode === "rename" ? (
          <input
            autoFocus
            value={name}
            maxLength={60}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setName(column.name);
                setMode("view");
              }
            }}
            className="input py-1 text-sm font-semibold"
          />
        ) : (
          <h2
            {...(canEdit ? dragHandle : {})}
            onDoubleClick={() => canEdit && setMode("rename")}
            title={canEdit ? "Arrastra para mover la columna · doble clic para renombrar" : undefined}
            className={`flex-1 truncate text-sm font-semibold text-zinc-700 ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            {column.name}
            <span className="ml-2 text-xs font-normal text-zinc-500">{count}</span>
          </h2>
        )}

        {canEdit && mode !== "rename" && (
          <div className="relative">
            <button
              onClick={() => setMode(mode === "menu" ? "view" : "menu")}
              aria-label={`Opciones de ${column.name}`}
              className="rounded px-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
            >
              ⋯
            </button>
            {mode === "menu" && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMode("view")} />
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg">
                  <button onClick={() => setMode("rename")} className="block w-full px-3 py-2 text-left hover:bg-zinc-50">
                    Renombrar columna
                  </button>
                  <button
                    onClick={() => setMode("delete")}
                    disabled={otherColumns.length === 0 && count > 0}
                    className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 disabled:text-zinc-300"
                  >
                    Eliminar columna
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {mode === "delete" && (
        <div className="mt-2 space-y-2 rounded-lg border border-red-200 bg-white p-3 text-sm">
          <p className="font-medium">¿Eliminar «{column.name}»?</p>
          {count > 0 ? (
            <label className="block text-xs text-zinc-600">
              Sus {count} {count === 1 ? "tarea pasará" : "tareas pasarán"} a:
              <select value={target || otherColumns[0]?.id} onChange={(e) => setTarget(e.target.value)} className="input mt-1">
                {otherColumns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-zinc-500">La columna está vacía.</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={remove}
              disabled={pending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button onClick={() => setMode("view")} className="text-xs text-zinc-500 hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function AddTask({
  projectId,
  columnId,
  people,
  lastPosition,
}: {
  projectId: string;
  columnId: string;
  people: Person[];
  lastPosition?: number;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
      >
        + Agregar tarea
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await quickCreateTask({
        projectId,
        columnId,
        title,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
        position: (lastPosition ?? 0) + 1000,
      });
      if (result.ok) {
        // Se queda abierto para agregar varias seguidas
        setTitle("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        required
        maxLength={300}
        placeholder="¿Qué hay que hacer?"
        className="input"
      />
      <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="input" aria-label="Responsable">
        <option value="">Sin responsable</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" aria-label="Fecha de entrega" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          {pending ? "Agregando…" : "Agregar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 text-sm text-zinc-500 hover:underline">
          Cerrar
        </button>
      </div>
    </form>
  );
}

function AddColumn({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-72 shrink-0 rounded-xl border-2 border-dashed border-zinc-200 p-3 text-left text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-800"
      >
        + Agregar columna
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createColumn(projectId, name);
          if (result.ok) {
            setName("");
            setOpen(false);
          } else {
            setError(result.error);
          }
        });
      }}
      className="w-72 shrink-0 space-y-2 rounded-xl bg-zinc-100 p-3"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        required
        maxLength={60}
        placeholder="Nombre de la columna"
        className="input"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          {pending ? "Creando…" : "Crear columna"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 text-sm text-zinc-500 hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
