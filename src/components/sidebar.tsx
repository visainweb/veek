"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/login/actions";
import { ROLE_LABELS, type OrgRole, type Project } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: "⌂" },
  { href: "/my-tasks", label: "Mis tareas", icon: "✓" },
  { href: "/calendar", label: "Calendario", icon: "▦" },
  { href: "/members", label: "Miembros", icon: "☺" },
];

/**
 * Menú lateral de toda la altura de la pantalla.
 * En el celular se abre como panel desde el botón ☰.
 */
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-zinc-800 hover:text-white ${
      pathname === href || pathname.startsWith(`${href}/`) ? "bg-zinc-800 text-white" : ""
    }`;

  return (
    <>
      {/* Barra superior solo en celular */}
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 text-white md:hidden">
        <span className="text-lg font-bold">Veek</span>
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-md px-2 py-1 text-xl hover:bg-zinc-800">
          ☰
        </button>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 shrink-0 flex-col bg-zinc-900 text-zinc-300 transition-transform md:static md:h-full md:w-60 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        onClick={(e) => {
          // Cerrar el panel en el celular al elegir un enlace
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        <div className="flex items-start justify-between px-5 py-4">
          <div className="min-w-0">
            <div className="text-xl font-bold text-white">Veek</div>
            <div className="truncate text-xs text-zinc-400">{orgName}</div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Cerrar menú" className="text-zinc-400 hover:text-white md:hidden">
            ✕
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              <span className="w-4 text-center text-zinc-500">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 flex items-center justify-between px-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Proyectos
          <Link href="/dashboard" title="Nuevo proyecto" className="text-base leading-none hover:text-white">
            +
          </Link>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className={linkClass(`/projects/${p.id}`)}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
          {projects.length === 0 && <p className="px-3 text-xs text-zinc-500">Aún no hay proyectos</p>}
        </nav>

        <div className="border-t border-zinc-800 px-5 py-4">
          <div className="truncate text-sm text-white">{userName}</div>
          <div className="text-xs text-zinc-400">{ROLE_LABELS[role]}</div>
          <form action={signOut} className="mt-2">
            <button className="text-xs text-zinc-400 hover:text-white">Cerrar sesión</button>
          </form>
        </div>
      </aside>
    </>
  );
}
