import { requireOrg } from "@/lib/org";
import { getPeople } from "@/lib/people";
import type { Task } from "@/lib/types";
import { CalendarView } from "@/components/calendar-view";

export default async function CalendarPage() {
  const { supabase, user, org, role } = await requireOrg();

  const [{ data: tasks }, { data: projects }, people] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("org_id", org.id)
      .or("due_date.not.is.null,start_date.not.is.null"),
    supabase.from("projects").select("id, name, color").eq("org_id", org.id).order("created_at"),
    getPeople(supabase, org.id),
  ]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">Calendario</h1>
        <p className="text-sm text-zinc-500">
          Las tareas aparecen en su fecha de entrega (o de inicio a entrega). Arrástralas para cambiar la fecha.
        </p>
      </header>
      <CalendarView
        tasks={(tasks as Task[] | null) ?? []}
        projects={projects ?? []}
        people={people}
        permissions={{ role, userId: user.id }}
      />
    </div>
  );
}
