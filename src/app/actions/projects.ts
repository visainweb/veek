"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: true } | { ok: false; error: string };

/** Cambia nombre, descripción o color de un proyecto. */
export async function updateProject(_prev: Result | null, formData: FormData): Promise<Result> {
  const id = String(formData.get("project_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "El proyecto necesita un nombre" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      color: String(formData.get("color") ?? "#f06a6a"),
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No tienes permiso para editar este proyecto" };
  refresh();
  return { ok: true };
}

/** Borra el proyecto con todas sus columnas y tareas. Solo propietarios y administradores. */
export async function deleteProject(projectId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").delete().eq("id", projectId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) {
    return { ok: false, error: "Solo un propietario o administrador puede eliminar proyectos" };
  }
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Columnas (secciones) del tablero
// ---------------------------------------------------------------------------

export async function createColumn(projectId: string, name: string): Promise<Result> {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { ok: false, error: "Escribe un nombre" };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("board_columns")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("board_columns")
    .insert({ project_id: projectId, name: clean, position: (last?.position ?? 0) + 1000 });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function renameColumn(columnId: string, name: string): Promise<Result> {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { ok: false, error: "Escribe un nombre" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("board_columns").update({ name: clean }).eq("id", columnId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No tienes permiso para cambiar esta columna" };
  refresh();
  return { ok: true };
}

export async function moveColumn(columnId: string, position: number): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("board_columns").update({ position }).eq("id", columnId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Borra una columna. Sus tareas no se pierden: pasan a la columna `moveTasksTo`.
 * `moveTasksTo` solo puede ser null si la columna está vacía.
 */
export async function deleteColumn(columnId: string, moveTasksTo: string | null): Promise<Result> {
  const supabase = await createClient();

  if (moveTasksTo) {
    const { error } = await supabase.from("tasks").update({ column_id: moveTasksTo }).eq("column_id", columnId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("column_id", columnId);
    if (count) return { ok: false, error: "Elige a qué columna mover sus tareas" };
  }

  const { data, error } = await supabase.from("board_columns").delete().eq("id", columnId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No tienes permiso para eliminar esta columna" };
  refresh();
  return { ok: true };
}
