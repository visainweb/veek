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

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership?.organizations) redirect("/onboarding");

  return {
    supabase,
    user,
    org: membership.organizations as unknown as Organization,
    role: membership.role as OrgRole,
  };
}
