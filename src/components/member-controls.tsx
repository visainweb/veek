"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { changeMemberRole, inviteMember, removeMember, type InviteResult } from "@/app/actions/members";
import { ROLE_LABELS, type OrgRole } from "@/lib/types";

function roleOptions(includeOwner: boolean) {
  return (Object.keys(ROLE_LABELS) as OrgRole[]).filter((r) => includeOwner || r !== "owner");
}

/** Formulario para invitar por correo. */
export function InviteForm({ canInviteOwners }: { canInviteOwners: boolean }) {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteMember, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  // Solo se muestra tras invitar, ya en el navegador
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const signupLink = state?.ok ? `${origin}/login?mode=signup&email=${encodeURIComponent(state.email)}` : "";

  return (
    <div className="mt-4">
      <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row">
        <input name="email" type="email" required placeholder="correo@ejemplo.com" className="input sm:flex-1" />
        <select name="role" defaultValue="member" className="input sm:w-40" aria-label="Rol">
          {roleOptions(canInviteOwners).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Invitando…" : "Invitar"}
        </button>
      </form>

      {state && !state.ok && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}

      {state?.ok && state.kind === "added" && (
        <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Listo: {state.email} ya tenía cuenta y ahora es parte de la organización.
        </p>
      )}

      {state?.ok && state.kind === "invited" && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Invitación guardada para {state.email}. Envíale este enlace para que cree su cuenta; entrará directo a la
          organización:
          <CopyLink value={signupLink} />
        </div>
      )}
    </div>
  );
}

function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex gap-2">
      <input readOnly value={value} className="input flex-1 bg-white text-xs" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="rounded-lg border border-emerald-300 bg-white px-3 text-xs font-medium hover:bg-emerald-100"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

/** Cambiar el rol de un miembro o quitarlo de la organización. */
export function MemberActions({
  userId,
  name,
  role,
  isMe,
  canAssignOwner,
}: {
  userId: string;
  name: string;
  role: OrgRole;
  isMe: boolean;
  canAssignOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Muestra el rol nuevo mientras se guarda; si falla, vuelve al anterior
  const [value, setOptimisticRole] = useOptimistic(role);

  function onRoleChange(next: OrgRole) {
    setError(null);
    startTransition(async () => {
      setOptimisticRole(next);
      const result = await changeMemberRole(userId, next);
      if (result.error) setError(result.error);
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMember(userId);
      if (result.error) setError(result.error);
      setConfirming(false);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          value={value}
          disabled={pending}
          onChange={(e) => onRoleChange(e.target.value as OrgRole)}
          className="input w-36 py-1.5"
          aria-label={`Rol de ${name}`}
        >
          {roleOptions(canAssignOwner || role === "owner").map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        {!isMe &&
          (confirming ? (
            <span className="flex items-center gap-1 text-xs">
              <button
                onClick={onRemove}
                disabled={pending}
                className="rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Quitar
              </button>
              <button onClick={() => setConfirming(false)} className="px-1 text-zinc-500 hover:underline">
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              title={`Quitar a ${name} de la organización`}
              className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Quitar
            </button>
          ))}
      </div>
      {error && <p className="max-w-xs text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
