"use server";

import { refresh } from "next/cache";
import { requireOrg } from "@/lib/org";
import { ROLE_LABELS, type OrgRole } from "@/lib/types";

export type InviteResult =
  | { ok: true; kind: "added" | "invited"; email: string }
  | { ok: false; error: string };

function isRole(value: string): value is OrgRole {
  return value in ROLE_LABELS;
}

export async function inviteMember(_prev: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member");
  if (!email) return { ok: false, error: "Escribe un correo" };
  if (!isRole(role)) return { ok: false, error: "Rol no válido" };

  const { supabase, org } = await requireOrg();
  const { data, error } = await supabase.rpc("invite_member", { p_org: org.id, p_email: email, p_role: role });
  if (error) return { ok: false, error: error.message };

  refresh();
  return { ok: true, kind: data === "added" ? "added" : "invited", email };
}

export async function changeMemberRole(userId: string, role: string): Promise<{ error?: string }> {
  if (!isRole(role)) return { error: "Rol no válido" };
  const { supabase, org } = await requireOrg();
  const { error } = await supabase.rpc("change_member_role", { p_org: org.id, p_user: userId, p_role: role });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function removeMember(userId: string): Promise<{ error?: string }> {
  const { supabase, org } = await requireOrg();
  const { error } = await supabase.rpc("remove_member", { p_org: org.id, p_user: userId });
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function cancelInvitation(formData: FormData) {
  const { supabase, org } = await requireOrg();
  const { error } = await supabase
    .from("organization_invitations")
    .delete()
    .eq("org_id", org.id)
    .eq("id", String(formData.get("invitation_id")));
  if (error) throw new Error(error.message);
  refresh();
}
