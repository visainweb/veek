import type { SupabaseClient } from "@supabase/supabase-js";
import type { Person } from "@/lib/types";

/** Personas de la organización, ordenadas por nombre (para elegir responsable). */
export async function getPeople(supabase: SupabaseClient, orgId: string): Promise<Person[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, profiles(full_name)")
    .eq("org_id", orgId);

  return (data ?? [])
    .map((m) => ({
      id: m.user_id as string,
      name: (m.profiles as unknown as { full_name: string | null } | null)?.full_name || "Sin nombre",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
