import { Suspense } from "react";
import Link from "next/link";
import { signIn, signUp } from "./actions";

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense>
      <LoginPageContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function LoginPageContent(props: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await props.searchParams;
  const isSignup = params.mode === "signup";
  const error = typeof params.error === "string" ? params.error : null;
  const message = typeof params.message === "string" ? params.message : null;
  // Enlace de invitación: /login?mode=signup&email=...
  const invitedEmail = typeof params.email === "string" ? params.email : undefined;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="text-3xl font-bold tracking-tight text-brand">Veek</span>
          <p className="mt-1 text-sm text-zinc-500">
            {isSignup ? "Crea tu cuenta" : "Inicia sesión para continuar"}
          </p>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

        <form action={isSignup ? signUp : signIn} className="space-y-4">
          {isSignup && (
            <Field label="Nombre" name="full_name" type="text" autoComplete="name" />
          )}
          <Field label="Correo" name="email" type="email" autoComplete="email" defaultValue={invitedEmail} />
          <Field
            label="Contraseña"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={6}
          />
          <button type="submit" className="btn-primary w-full">
            {isSignup ? "Crear cuenta" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {isSignup ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
          <Link href={isSignup ? "/login" : "/login?mode=signup"} className="font-medium text-brand hover:underline">
            {isSignup ? "Inicia sesión" : "Regístrate"}
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      <input required className="input" {...input} />
    </label>
  );
}
