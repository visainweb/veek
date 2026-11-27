"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { deleteTask, updateTask, type ActionResult } from "@/app/actions/tasks";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type BoardColumn,
  type OrgRole,
  type Person,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

export interface TaskPermissions {
  role: OrgRole;
  userId: string;
}

export function canEditTasks(role: OrgRole) {
  return role !== "guest";
}

export function canDeleteTask(task: Pick<Task, "created_by">, { role, userId }: TaskPermissions) {
  return role === "owner" || role === "admin" || (role === "member" && task.created_by === userId);
}

/** Ventana con el detalle de una tarea: editar todos sus campos o eliminarla. */
export function TaskDialog({
  task,
  people,
  columns,
  projectName,
  permissions,
  onClose,
}: {
  task: Task;
  people: Person[];
  /** Solo en el tablero: permite mover la tarea de columna. */
  columns?: Pick<BoardColumn, "id" | "name">[];
  projectName?: string;
  permissions: TaskPermissions;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, saving] = useActionState<ActionResult | null, FormData>(updateTask, null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const editable = canEditTasks(permissions.role);
  const deletable = canDeleteTask(task, permissions);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteTask(task.id);
      if (result.ok) onClose();
      else setDeleteError(result.error);
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // Cerrar al hacer clic fuera de la ventana
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="m-auto w-[min(100%-2rem,36rem)] rounded-2xl p-0 shadow-xl backdrop:bg-black/40"
    >
      <form action={formAction} className="flex max-h-[85vh] flex-col">
        <input type="hidden" name="task_id" value={task.id} />

        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-6 py-4">
          <div className="min-w-0 flex-1">
            {projectName && <div className="mb-1 text-xs text-zinc-500">{projectName}</div>}
            <input
              name="title"
              required
              maxLength={300}
              defaultValue={task.title}
              disabled={!editable}
              aria-label="Título"
              className="w-full rounded-md border border-transparent px-1 py-0.5 text-lg font-semibold outline-none hover:border-zinc-200 focus:border-brand disabled:bg-transparent"
            />
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar"
            className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <fieldset disabled={!editable} className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <Field label="Estado">
            <select name="status" defaultValue={task.status} className="input">
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>

          <Field label="Prioridad">
            <select name="priority" defaultValue={task.priority} className="input">
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </Field>

          <Field label="Responsable">
            <select name="assignee_id" defaultValue={task.assignee_id ?? ""} className="input">
              <option value="">Sin responsable</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          {columns ? (
            <Field label="Columna">
              <select name="column_id" defaultValue={task.column_id ?? ""} className="input">
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}

          <Field label="Fecha de inicio">
            <input type="date" name="start_date" defaultValue={task.start_date ?? ""} className="input" />
          </Field>

          <Field label="Fecha de entrega">
            <input type="date" name="due_date" defaultValue={task.due_date ?? ""} className="input" />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Descripción">
              <textarea
                name="description"
                rows={5}
                defaultValue={task.description ?? ""}
                placeholder="Agrega más detalles sobre esta tarea…"
                className="input resize-y"
              />
            </Field>
          </div>
        </fieldset>

        {(state && !state.ok) || deleteError ? (
          <p className="mx-6 mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {deleteError ?? (state && !state.ok ? state.error : "")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-6 py-4">
          <div>
            {deletable &&
              (confirmDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  ¿Eliminar esta tarea?
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-zinc-500 hover:underline">
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Eliminar tarea
                </button>
              ))}
          </div>

          {editable ? (
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          ) : (
            <span className="text-xs text-zinc-500">Los invitados solo pueden ver las tareas</span>
          )}
        </div>
      </form>
    </dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  );
}
