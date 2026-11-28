"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { deleteProject, updateProject, type Result } from "@/app/actions/projects";
import type { OrgRole, Project } from "@/lib/types";

/** Cabecera del proyecto con el botón para editarlo o eliminarlo. */
export function ProjectHeader({
  project,
  role,
}: {
  project: Pick<Project, "id" | "name" | "color" | "description">;
  role: OrgRole;
}) {
  const [editing, setEditing] = useState(false);
  const canEdit = role !== "guest";

  return (
    <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-4 md:px-6">
      <span className="h-6 w-6 shrink-0 rounded-md" style={{ backgroundColor: project.color }} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold">{project.name}</h1>
        {project.description && <p className="truncate text-sm text-zinc-500">{project.description}</p>}
      </div>
      <span className="hidden rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 sm:inline">Tablero</span>
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Editar proyecto
        </button>
      )}
      {editing && (
        <EditProjectDialog
          project={project}
          canDelete={role === "owner" || role === "admin"}
          onClose={() => setEditing(false)}
        />
      )}
    </header>
  );
}

function EditProjectDialog({
  project,
  canDelete,
  onClose,
}: {
  project: Pick<Project, "id" | "name" | "color" | "description">;
  canDelete: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, saving] = useActionState<Result | null, FormData>(updateProject, null);
  const [confirm, setConfirm] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (state?.ok) ref.current?.close();
  }, [state]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="m-auto w-[min(100%-2rem,28rem)] rounded-2xl p-0 shadow-xl backdrop:bg-black/40"
    >
      <form action={action} className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Editar proyecto</h2>
        <input type="hidden" name="project_id" value={project.id} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Nombre</span>
          <input name="name" required maxLength={120} defaultValue={project.name} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Descripción</span>
          <textarea name="description" rows={3} defaultValue={project.description ?? ""} className="input resize-y" />
        </label>
        <label className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-600">Color</span>
          <input
            type="color"
            name="color"
            defaultValue={project.color}
            className="h-9 w-14 cursor-pointer rounded border border-zinc-200"
          />
        </label>
        {state && !state.ok && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => ref.current?.close()} className="px-3 text-sm text-zinc-500 hover:underline">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>

      {canDelete && (
        <div className="border-t border-zinc-200 bg-red-50/40 p-6">
          {!askDelete ? (
            <button onClick={() => setAskDelete(true)} className="text-sm font-medium text-red-600 hover:underline">
              Eliminar proyecto
            </button>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                Se borrarán el proyecto, sus columnas y <b>todas sus tareas</b>. No se puede deshacer. Escribe{" "}
                <b>{project.name}</b> para confirmar:
              </p>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
              {deleteError && <p className="text-red-700">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  disabled={confirm.trim() !== project.name.trim() || deleting}
                  onClick={() =>
                    startDelete(async () => {
                      const result = await deleteProject(project.id);
                      if (result && !result.ok) setDeleteError(result.error);
                    })
                  }
                  className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {deleting ? "Eliminando…" : "Eliminar para siempre"}
                </button>
                <button onClick={() => setAskDelete(false)} className="text-zinc-500 hover:underline">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
