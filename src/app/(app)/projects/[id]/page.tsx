import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/org";
import { getPeople } from "@/lib/people";
import type { BoardColumn, Task } from "@/lib/types";
import { Board } from "@/components/board";
import { ProjectHeader } from "@/components/project-header";

export default async function ProjectBoardPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const { supabase, user, org, role } = await requireOrg();

  const [{ data: project }, { data: columns }, { data: tasks }, people] = await Promise.all([
    supabase.from("projects").select("id, name, color, description").eq("id", id).maybeSingle(),
    supabase.from("board_columns").select("id, name, position").eq("project_id", id).order("position"),
    supabase.from("tasks").select("*").eq("project_id", id).order("position"),
    getPeople(supabase, org.id),
  ]);

  if (!project) notFound();

  return (
    <div className="flex h-full flex-col">
      <ProjectHeader project={project} role={role} />
      <Board
        projectId={id}
        columns={(columns as Pick<BoardColumn, "id" | "name" | "position">[] | null) ?? []}
        tasks={(tasks as Task[] | null) ?? []}
        people={people}
        permissions={{ role, userId: user.id }}
      />
    </div>
  );
}
