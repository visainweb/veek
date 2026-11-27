import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org";
import { STATUS_LABELS, type BoardColumn, type Task, type TaskStatus } from "@/lib/types";
import { createTask, cycleTaskStatus } from "./actions";

const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: "bg-zinc-100 text-zinc-600",
  in_progress: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
};

export default async function ProjectBoardPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const { supabase, org, role } = await requireOrg();

  const [{ data: project }, { data: columns }, { data: tasks }, { data: members }] = await Promise.all([
    supabase.from("projects").select("id, name, color").eq("id", id).maybeSingle(),
    supabase.from("board_columns").select("*").eq("project_id", id).order("position"),
    supabase.from("tasks").select("*").eq("project_id", id).order("position"),
    supabase.from("organization_members").select("user_id, profiles(full_name)").eq("org_id", org.id),
  ]);

  if (!project) notFound();

  const people = new Map(
    (members ?? []).map((m) => [
      m.user_id as string,
      ((m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "Sin nombre"),
    ]),
  );
  const canEdit = role !== "guest";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-4">
        <span className="h-6 w-6 rounded-md" style={{ backgroundColor: project.color }} />
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">Tablero</span>
      </header>

      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {(columns as BoardColumn[] | null ?? []).map((col) => {
          const colTasks = ((tasks as Task[] | null) ?? []).filter((t) => t.column_id === col.id);
          return (
            <section key={col.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-zinc-100/80 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-zinc-700">
                {col.name}
                <span className="text-xs font-normal text-zinc-500">{colTasks.length}</span>
              </h2>

              <div className="flex flex-col gap-2">
                {colTasks.map((task) => (
                  <article key={task.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                    <div className="text-sm font-medium">{task.title}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <form action={cycleTaskStatus}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="status" value={task.status} />
                        <button
                          disabled={!canEdit}
                          title="Cambiar estado"
                          className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[task.status]}`}
                        >
                          {STATUS_LABELS[task.status]}
                        </button>
                      </form>
                      {task.assignee_id && <span>👤 {people.get(task.assignee_id) ?? "—"}</span>}
                      {task.due_date && <span>📅 {formatDate(task.due_date)}</span>}
                    </div>
                  </article>
                ))}
              </div>

              {canEdit && (
                <details className="mt-2">
                  <summary className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-200">
                    + Agregar tarea
                  </summary>
                  <form action={createTask} className="mt-2 space-y-2 rounded-lg bg-white p-3">
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="column_id" value={col.id} />
                    <input name="title" required placeholder="Título de la tarea" className="input" />
                    <select name="assignee_id" className="input" defaultValue="">
                      <option value="">Sin responsable</option>
                      {[...people].map(([uid, name]) => (
                        <option key={uid} value={uid}>{name}</option>
                      ))}
                    </select>
                    <input type="date" name="due_date" className="input" />
                    <button type="submit" className="btn-primary w-full">Agregar</button>
                  </form>
                </details>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" });
}
