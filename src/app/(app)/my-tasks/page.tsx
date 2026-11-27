import { requireOrg } from "@/lib/org";
import { getPeople } from "@/lib/people";
import type { Task } from "@/lib/types";
import { TaskRow } from "@/components/task-row";

type TaskWithProject = Task & { projects: { name: string; color: string } | null };

export default async function MyTasksPage() {
  const { supabase, user, org, role } = await requireOrg();
  const [{ data: tasks }, people] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, projects(name, color)")
      .eq("org_id", org.id)
      .eq("assignee_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    getPeople(supabase, org.id),
  ]);

  const list = (tasks as unknown as TaskWithProject[] | null) ?? [];
  const permissions = { role, userId: user.id };

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold">Mis tareas</h1>
      <ul className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {list.length === 0 && <li className="p-6 text-sm text-zinc-500">No tienes tareas asignadas.</li>}
        {list.map(({ projects, ...task }) => (
          <TaskRow key={task.id} task={task} project={projects} people={people} permissions={permissions} />
        ))}
      </ul>
    </div>
  );
}
