import Link from "next/link";
import { requireOrg } from "@/lib/org";
import { STATUS_LABELS, type TaskStatus } from "@/lib/types";

export default async function MyTasksPage() {
  const { supabase, user, org } = await requireOrg();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, due_date, project_id, projects(name, color)")
    .eq("org_id", org.id)
    .eq("assignee_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold">Mis tareas</h1>
      <ul className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {(tasks ?? []).length === 0 && (
          <li className="p-6 text-sm text-zinc-500">No tienes tareas asignadas.</li>
        )}
        {(tasks ?? []).map((t) => {
          const project = t.projects as unknown as { name: string; color: string } | null;
          return (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: project?.color }} />
              <span className="flex-1 truncate text-sm">{t.title}</span>
              <Link href={`/projects/${t.project_id}`} className="hidden text-xs text-zinc-500 hover:underline sm:inline">
                {project?.name}
              </Link>
              <span className="text-xs text-zinc-500">{t.due_date ?? ""}</span>
              <span className="text-xs font-medium">{STATUS_LABELS[t.status as TaskStatus]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
