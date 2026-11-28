"use client";

import { cycleTaskStatus } from "@/app/actions/tasks";
import { STATUS_LABELS, STATUS_STYLES, type Person, type Task } from "@/lib/types";

/** Contenido visual de la tarjeta de una tarea en el tablero. */
export function TaskCardView({
  task,
  people,
  canEdit,
  dragging = false,
  overlay = false,
}: {
  task: Task;
  people: Person[];
  canEdit: boolean;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const assignee = people.find((p) => p.id === task.assignee_id);

  return (
    <article
      className={`rounded-lg border bg-white p-3 shadow-sm transition ${
        dragging ? "border-dashed border-zinc-300 opacity-40" : "border-zinc-200 hover:border-zinc-300 hover:shadow"
      } ${overlay ? "rotate-2 cursor-grabbing shadow-lg" : "cursor-pointer"}`}
    >
      <div className={`text-sm font-medium ${task.status === "done" ? "text-zinc-400 line-through" : ""}`}>
        {task.title}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <form
          action={cycleTaskStatus}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input type="hidden" name="task_id" value={task.id} />
          <input type="hidden" name="status" value={task.status} />
          <button
            disabled={!canEdit}
            title="Cambiar estado"
            className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[task.status]}`}
          >
            {STATUS_LABELS[task.status]}
          </button>
        </form>
        {task.priority === "high" && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">Alta</span>
        )}
        {assignee && <span>👤 {assignee.name}</span>}
        {task.due_date && <span>📅 {formatDate(task.due_date)}</span>}
        {task.description && <span title="Tiene descripción">≡</span>}
      </div>
    </article>
  );
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" });
}
