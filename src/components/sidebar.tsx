import Link from "next/link";
import { signOut } from "@/app/(auth)/login/actions";
import { ROLE_LABELS, type OrgRole, type Project } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/my-tasks", label: "Mis tareas" },
  { href: "/calendar", label: "Calendario" },
];

export function Sidebar({
  orgName,
  role,
  projects,
  userName,
}: {
  orgName: string;
  role: OrgRole;
  projects: Pick<Project, "id" | "name" | "color">[];
  userName: string;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col bg-zinc-900 text-zinc-300 md:h-full md:w-60">
      <div className="px-5 py-4">
        <div className="text-xl font-bold text-white">Veek</div>
        <div className="truncate text-xs text-zinc-400">{orgName}</div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 md:flex-col">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm hover:bg-zinc-800 hover:text-white">
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 hidden px-5 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:block">
        Proyectos
      </div>
      <nav className="hidden flex-1 flex-col gap-1 overflow-y-auto px-3 py-2 md:flex">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-zinc-800 hover:text-white">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
      </nav>

      <div className="hidden border-t border-zinc-800 px-5 py-4 md:block">
        <div className="truncate text-sm text-white">{userName}</div>
        <div className="text-xs text-zinc-400">{ROLE_LABELS[role]}</div>
        <form action={signOut} className="mt-2">
          <button className="text-xs text-zinc-400 hover:text-white">Cerrar sesión</button>
        </form>
      </div>
    </aside>
  );
}
