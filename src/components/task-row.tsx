"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { TaskDialog, type TaskPermissions } from "@/components/task-dialog";
import { formatDate } from "@/components/task-card";
import { STATUS_LABELS, STATUS_STYLES, type Person, type Task } from "@/lib/types";

/** Fila de "Mis tareas". Al hacer clic abre el detalle de la tarea. */
export function TaskRow({
  task,
  project,
  people,
  permissions,
}: {
  task: Task;
  project: { name: string; color: string } | null;
  people: Person[];
  permissions: TaskPermissions;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setOpen(true);
        }}
        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-zinc-50"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: project?.color }} />
        <span className={`flex-1 truncate text-sm ${task.status === "done" ? "text-zinc-400 line-through" : ""}`}>
          {task.title}
        </span>
        <Link
          href={`/projects/${task.project_id}`}
          onClick={(e) => e.stopPropagation()}
          className="hidden text-xs text-zinc-500 hover:underline sm:inline"
        >
          {project?.name}
        </Link>
        <span className="w-14 text-right text-xs text-zinc-500">{task.due_date ? formatDate(task.due_date) : ""}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>
      {open && (
        <TaskDialog task={task} people={people} projectName={project?.name} permissions={permissions} onClose={close} />
      )}
    </li>
  );
}
