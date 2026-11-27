"use client";

import { useCallback, useState } from "react";
import { cycleTaskStatus } from "@/app/actions/tasks";
import { TaskDialog, canEditTasks, type TaskPermissions } from "@/components/task-dialog";
import { STATUS_LABELS, STATUS_STYLES, type BoardColumn, type Person, type Task } from "@/lib/types";

/** Tarjeta de una tarea en el tablero. Al hacer clic abre el detalle. */
export function TaskCard({
  task,
  people,
  columns,
  permissions,
}: {
  task: Task;
  people: Person[];
  columns: Pick<BoardColumn, "id" | "name">[];
  permissions: TaskPermissions;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const assignee = people.find((p) => p.id === task.assignee_id);

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setOpen(true);
        }}
        className="cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition hover:border-zinc-300 hover:shadow"
      >
        <div className={`text-sm font-medium ${task.status === "done" ? "text-zinc-400 line-through" : ""}`}>
          {task.title}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <form action={cycleTaskStatus} onClick={(e) => e.stopPropagation()}>
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="status" value={task.status} />
            <button
              disabled={!canEditTasks(permissions.role)}
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

      {open && (
        <TaskDialog task={task} people={people} columns={columns} permissions={permissions} onClose={close} />
      )}
    </>
  );
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" });
}
