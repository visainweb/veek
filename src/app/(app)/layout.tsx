import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { requireOrg } from "@/lib/org";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:h-screen md:flex-row">
      <Suspense fallback={<aside className="w-full shrink-0 bg-zinc-900 md:h-full md:w-60" />}>
        <SidebarLoader />
      </Suspense>
      <main className="flex-1 overflow-auto bg-zinc-50">
        <Suspense fallback={<div className="p-10 text-sm text-zinc-400">Cargando…</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}

async function SidebarLoader() {
  const { supabase, user, org, role } = await requireOrg();

  const [{ data: projects }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("id, name, color").eq("org_id", org.id).order("created_at"),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <Sidebar
      orgName={org.name}
      role={role}
      projects={projects ?? []}
      userName={profile?.full_name ?? user.email ?? ""}
    />
  );
}
