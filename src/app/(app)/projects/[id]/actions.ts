"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskStatus } from "@/lib/types";

export async function createTask(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const columnId = String(formData.get("column_id"));
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("tasks").insert({
    project_id: projectId,
    column_id: columnId,
    title,
    created_by: user?.id,
    assignee_id: String(formData.get("assignee_id") || "") || null,
    due_date: String(formData.get("due_date") || "") || null,
    position: Date.now(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  pending: "in_progress",
  in_progress: "done",
  done: "pending",
};

export async function cycleTaskStatus(formData: FormData) {
  const taskId = String(formData.get("task_id"));
  const projectId = String(formData.get("project_id"));
  const current = String(formData.get("status")) as TaskStatus;

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: NEXT_STATUS[current] ?? "pending" })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}
