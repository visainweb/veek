import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function createOrganization(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", { p_name: name });
  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export default function OnboardingPage(props: PageProps<"/onboarding">) {
  return (
    <Suspense>
      <OnboardingPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function OnboardingPageContent(props: { searchParams: PageProps<"/onboarding">["searchParams"] }) {
  const { error } = await props.searchParams;

  // Si ya pertenece a una organización, no crear otra
  const supabase = await createClient();
  const { count } = await supabase
    .from("organization_members")
    .select("org_id", { count: "exact", head: true });
  if (count && count > 0) redirect("/dashboard");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Crea tu organización</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Es el espacio donde tu equipo comparte proyectos y tareas. Serás su propietario.
        </p>
        {typeof error === "string" && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        <form action={createOrganization} className="mt-6 space-y-4">
          <input name="name" required maxLength={120} placeholder="Ej. Mi empresa" className="input" />
          <button type="submit" className="btn-primary w-full">Continuar</button>
        </form>
      </div>
    </main>
  );
}
