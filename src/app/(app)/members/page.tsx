import { requireOrg } from "@/lib/org";
import { ROLE_LABELS, type OrgRole } from "@/lib/types";
import { cancelInvitation } from "@/app/actions/members";
import { InviteForm, MemberActions } from "@/components/member-controls";

interface MemberRow {
  user_id: string;
  role: OrgRole;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

const ROLE_ORDER: Record<OrgRole, number> = { owner: 0, admin: 1, member: 2, guest: 3 };

export default async function MembersPage() {
  const { supabase, user, org, role } = await requireOrg();
  const canManage = role === "owner" || role === "admin";

  const [{ data: members, error }, { data: invitationRows }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role, created_at, profiles(full_name, email)")
      .eq("org_id", org.id),
    canManage
      ? supabase
          .from("organization_invitations")
          .select("id, email, role, created_at")
          .eq("org_id", org.id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  const invitations = (invitationRows ?? []) as { id: string; email: string; role: OrgRole }[];
  if (error) throw new Error(error.message);

  const rows = ((members as unknown as MemberRow[] | null) ?? []).sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "", "es"),
  );

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <h1 className="text-2xl font-semibold">Miembros</h1>
      <p className="text-sm text-zinc-500">
        Personas de {org.name} y su rol. {canManage ? "Puedes invitar personas, cambiar su rol o quitarlas." : ""}
      </p>

      {canManage && (
        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="font-medium">Invitar a una persona</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Si ya tiene cuenta en Veek, se agrega al momento. Si no, se une sola en cuanto se registre con ese correo.
          </p>
          <InviteForm canInviteOwners={role === "owner"} />
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <ul className="divide-y divide-zinc-200">
          {rows.map((m) => {
            const name = m.profiles?.full_name || "Sin nombre";
            const isMe = m.user_id === user.id;
            // Un administrador no puede tocar a un propietario
            const canTouch = canManage && (role === "owner" || m.role !== "owner");
            return (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand-dark">
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {name} {isMe && <span className="font-normal text-zinc-400">(tú)</span>}
                  </div>
                  {m.profiles?.email && <div className="truncate text-xs text-zinc-500">{m.profiles.email}</div>}
                </div>
                {canTouch ? (
                  <MemberActions
                    userId={m.user_id}
                    name={name}
                    role={m.role}
                    isMe={isMe}
                    canAssignOwner={role === "owner"}
                  />
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">{ROLE_LABELS[m.role]}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && invitations.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Invitaciones pendientes</h2>
          <ul className="divide-y divide-zinc-200 rounded-xl border border-dashed border-zinc-300 bg-white">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">{ROLE_LABELS[inv.role]}</span>
                <form action={cancelInvitation}>
                  <input type="hidden" name="invitation_id" value={inv.id} />
                  <button className="text-xs text-red-600 hover:underline">Cancelar</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">
            Estas personas entrarán automáticamente cuando creen su cuenta con ese correo.
          </p>
        </section>
      )}

      <section className="mt-8 text-xs text-zinc-500">
        <h2 className="mb-2 font-semibold text-zinc-700">¿Qué puede hacer cada rol?</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Propietario:</b> todo, incluido nombrar a otros propietarios.</li>
          <li><b>Administrador:</b> gestiona miembros y proyectos, y borra cualquier tarea.</li>
          <li><b>Miembro:</b> crea proyectos y tareas, edita tareas y borra las que creó.</li>
          <li><b>Invitado:</b> solo ve y comenta.</li>
        </ul>
      </section>
    </div>
  );
}
