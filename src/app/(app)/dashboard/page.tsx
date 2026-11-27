import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/org";

async function createProject(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { supabase, org } = await requireOrg();
  const { data, error } = await supabase
    .from("projects")
    .insert({ org_id: org.id, name, color: String(formData.get("color") ?? "#f06a6a") })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/projects/${data.id}`);
}

export default async function DashboardPage() {
  const { supabase, org, role } = await requireOrg();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, description, color")
    .eq("org_id", org.id)
    .order("created_at");

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold">Proyectos</h1>
      <p className="text-sm text-zinc-500">{org.name}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(projects ?? []).map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="mb-3 h-10 w-10 rounded-lg" style={{ backgroundColor: p.color }} />
            <div className="font-medium">{p.name}</div>
            {p.description && <div className="mt-1 line-clamp-2 text-sm text-zinc-500">{p.description}</div>}
          </Link>
        ))}

        {role !== "guest" && (
          <form action={createProject} className="flex flex-col justify-between gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-5">
            <div className="text-sm font-medium text-zinc-600">Nuevo proyecto</div>
            <input name="name" required maxLength={120} placeholder="Nombre del proyecto" className="input" />
            <div className="flex items-center gap-2">
              <input type="color" name="color" defaultValue="#f06a6a" className="h-9 w-12 cursor-pointer rounded border border-zinc-200" />
              <button type="submit" className="btn-primary flex-1">Crear</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
