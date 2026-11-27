import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org";
import { getPeople } from "@/lib/people";
import type { BoardColumn, Task } from "@/lib/types";
import { createTask } from "@/app/actions/tasks";
import { TaskCard } from "@/components/task-card";

export default async function ProjectBoardPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const { supabase, user, org, role } = await requireOrg();

  const [{ data: project }, { data: columns }, { data: tasks }, people] = await Promise.all([
    supabase.from("projects").select("id, name, color").eq("id", id).maybeSingle(),
    supabase.from("board_columns").select("*").eq("project_id", id).order("position"),
    supabase.from("tasks").select("*").eq("project_id", id).order("position"),
    getPeople(supabase, org.id),
  ]);

  if (!project) notFound();

  const boardColumns = (columns as BoardColumn[] | null) ?? [];
  const columnOptions = boardColumns.map((c) => ({ id: c.id, name: c.name }));
  const permissions = { role, userId: user.id };
  const canEdit = role !== "guest";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-6 py-4">
        <span className="h-6 w-6 rounded-md" style={{ backgroundColor: project.color }} />
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">Tablero</span>
      </header>

      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {boardColumns.map((col) => {
          const colTasks = ((tasks as Task[] | null) ?? []).filter((t) => t.column_id === col.id);
          return (
            <section key={col.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-zinc-100/80 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-zinc-700">
                {col.name}
                <span className="text-xs font-normal text-zinc-500">{colTasks.length}</span>
              </h2>

              <div className="flex flex-col gap-2">
                {colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} people={people} columns={columnOptions} permissions={permissions} />
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
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
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

