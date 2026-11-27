import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole, Organization } from "@/lib/types";

/** Devuelve el usuario y su organización actual, o redirige a login / onboarding. */
export async function requireOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  // Un error de permisos no debe confundirse con "no tiene organización":
  // eso devolvía al usuario a /onboarding una y otra vez.
  if (error) throw new Error(`No se pudo cargar tu organización: ${error.message}`);
  if (!membership?.organizations) redirect("/onboarding");

  return {
    supabase,
    user,
    org: membership.organizations as unknown as Organization,
    role: membership.role as OrgRole,
  };
}
