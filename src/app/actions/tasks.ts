"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATUSES: TaskStatus[] = ["pending", "in_progress", "done"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string) {
  return text(formData, key) || null;
}

export async function createTask(formData: FormData) {
  const projectId = text(formData, "project_id");
  const title = text(formData, "title");
  if (!title) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("tasks").insert({
    project_id: projectId,
    column_id: optional(formData, "column_id"),
    title,
    created_by: user?.id,
    assignee_id: optional(formData, "assignee_id"),
    due_date: optional(formData, "due_date"),
    position: Date.now(),
  });
  if (error) throw new Error(error.message);
  refresh();
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: "in_progress",
  in_progress: "done",
  done: "pending",
};

export async function cycleTaskStatus(formData: FormData) {
  const current = text(formData, "status") as TaskStatus;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: NEXT_STATUS[current] ?? "pending" })
    .eq("id", text(formData, "task_id"));
  if (error) throw new Error(error.message);
  refresh();
}

/** Guarda los cambios hechos en el detalle de la tarea. */
export async function updateTask(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const id = text(formData, "task_id");
  const title = text(formData, "title");
  if (!title) return { ok: false, error: "La tarea necesita un título" };

  const status = text(formData, "status") as TaskStatus;
  const priority = text(formData, "priority") as TaskPriority;
  const startDate = optional(formData, "start_date");
  const dueDate = optional(formData, "due_date");
  if (!STATUSES.includes(status) || !PRIORITIES.includes(priority)) {
    return { ok: false, error: "Estado o prioridad no válidos" };
  }
  if (startDate && dueDate && startDate > dueDate) {
    return { ok: false, error: "La fecha de inicio no puede ser posterior a la de entrega" };
  }

  const changes: Record<string, unknown> = {
    title,
    description: optional(formData, "description"),
    status,
    priority,
    assignee_id: optional(formData, "assignee_id"),
    start_date: startDate,
    due_date: dueDate,
  };
  // La columna solo se envía desde el tablero
  if (formData.has("column_id")) changes.column_id = optional(formData, "column_id");

  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").update(changes).eq("id", id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No tienes permiso para editar esta tarea" };

  refresh();
  return { ok: true };
}

/** Borra una tarea. Propietarios y administradores borran cualquiera; los miembros, las que crearon. */
export async function deleteTask(taskId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").delete().eq("id", taskId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) {
    return { ok: false, error: "No tienes permiso para eliminar esta tarea. Solo quien la creó o un administrador puede hacerlo." };
  }
  refresh();
  return { ok: true };
}

/** Cambia las fechas de una tarea (al arrastrarla en el calendario). */
export async function updateTaskDates(
  taskId: string,
  startDate: string | null,
  dueDate: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ start_date: startDate, due_date: dueDate })
    .eq("id", taskId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No tienes permiso para mover esta tarea" };
  refresh();
  return { ok: true };
}

/** Mueve una tarea a otra columna o posición (arrastrar en el tablero). */
export async function moveTask(taskId: string, columnId: string, position: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ column_id: columnId, position })
    .eq("id", taskId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No tienes permiso para mover esta tarea" };
  refresh();
  return { ok: true };
}

/** Crea una tarea desde el tablero y devuelve el resultado (sin lanzar errores). */
export async function quickCreateTask(input: {
  projectId: string;
  columnId: string;
  title: string;
  assigneeId: string | null;
  dueDate: string | null;
  position: number;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Escribe un título" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("tasks").insert({
    project_id: input.projectId,
    column_id: input.columnId,
    title,
    created_by: user?.id,
    assignee_id: input.assigneeId,
    due_date: input.dueDate,
    position: input.position,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
