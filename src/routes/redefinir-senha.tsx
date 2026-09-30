import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/auth-errors";
import { pageHead } from "@/lib/seo";
import { AuthLayout, Notice } from "@/components/auth/auth-layout";

// Destino do link "Esqueceu a senha?". O supabase-js lê o token do link e abre uma sessão de recuperação;
// aqui o usuário define a nova senha antes de entrar.
export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => pageHead("Nova senha"),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"wait" | "ok" | "invalid">("wait");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) setReady("ok");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady("ok");
    });
    const t = setTimeout(() => setReady((r) => (r === "wait" ? "invalid" : r)), 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (pw !== pw2) return setError("As senhas não conferem.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) return setError(authErrorMessage(err.message));
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <AuthLayout>
      <h2 className="mb-2 font-display text-3xl font-bold">Criar nova senha</h2>
      {ready === "wait" && <p className="text-muted-foreground">Validando o link…</p>}
      {ready === "invalid" && (
        <div className="space-y-4">
          <Notice tone="error">
            O link é inválido ou expirou. Solicite um novo em “Esqueceu a senha?”.
          </Notice>
          <Button onClick={() => navigate({ to: "/auth" })}>Voltar para o login</Button>
        </div>
      )}
      {ready === "ok" && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold">
            Nova senha
            <input
              required
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="mt-2 h-11 w-full rounded-md border bg-card px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Confirmar nova senha
            <input
              required
              type="password"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="mt-2 h-11 w-full rounded-md border bg-card px-3"
            />
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          <Button disabled={busy} size="lg" className="w-full">
            {busy ? "Salvando…" : "Salvar e entrar"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
