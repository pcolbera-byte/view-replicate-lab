import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, MailCheck } from "lucide-react";
import { AuthLayout, Notice } from "@/components/auth/auth-layout";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/auth-errors";
import { pageHead } from "@/lib/seo";
import { isNativeApp } from "@/lib/native";

export const Route = createFileRoute("/auth")({
  head: () => pageHead("Entrar", "Acesse a gestão segura da sua corretora de seguros."),
  component: AuthPage,
});

type Mode = "login" | "register" | "recover" | "check-email";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  // O Google não permite login dentro do app nativo (WebView); lá fica só e-mail e senha.
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
    if (new URLSearchParams(window.location.search).get("conta") === "excluida")
      setNotice({ tone: "ok", text: "Sua conta foi excluída." });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const go = (m: Mode) => {
    setMode(m);
    setNotice(null);
    setNeedsConfirm(false);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setNeedsConfirm(false);
    if (mode === "register") {
      if (password.length < 8)
        return setNotice({ tone: "error", text: "A senha precisa ter pelo menos 8 caracteres." });
      if (password !== password2)
        return setNotice({ tone: "error", text: "As senhas não conferem." });
    }
    setBusy(true);
    try {
      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        setNotice({
          tone: "ok",
          text: "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.",
        });
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { nome: name.trim(), empresa: company.trim() },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        // Supabase devolve usuário sem identidades quando o e-mail já existe (proteção contra enumeração).
        if (data.user && data.user.identities?.length === 0)
          throw new Error("User already registered");
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else setMode("check-email");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (/not confirmed/i.test(raw)) setNeedsConfirm(true);
      setNotice({ tone: "error", text: authErrorMessage(raw) });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    setNotice(
      error
        ? { tone: "error", text: authErrorMessage(error.message) }
        : {
            tone: "ok",
            text: "Enviamos um novo link de confirmação. Confira também a caixa de spam.",
          },
    );
  }

  async function google() {
    setBusy(true);
    setNotice(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setNotice({ tone: "error", text: authErrorMessage(result.error.message) });
      setBusy(false);
    } else if (!result.redirected) navigate({ to: "/dashboard", replace: true });
  }

  const titles: Record<Mode, [string, string]> = {
    login: ["Bem-vindo de volta", "Entre para acompanhar sua carteira."],
    register: ["Crie sua conta", "Comece a organizar sua corretora."],
    recover: ["Recuperar acesso", "Enviaremos um link para criar uma nova senha."],
    "check-email": ["Confirme seu e-mail", ""],
  };

  return (
    <AuthLayout>
      <div className="mb-8">
        <div className="mb-6 grid size-12 place-items-center rounded-md bg-secondary text-primary">
          {mode === "check-email" ? <MailCheck size={22} /> : <LockKeyhole size={22} />}
        </div>
        <h2 className="font-display text-3xl font-bold">{titles[mode][0]}</h2>
        {titles[mode][1] && <p className="mt-2 text-muted-foreground">{titles[mode][1]}</p>}
      </div>

      {mode === "check-email" ? (
        <div className="space-y-4">
          <p className="text-sm">
            Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail e clique no
            link para ativar a conta; depois é só entrar.
          </p>
          <p className="text-sm text-muted-foreground">Não chegou? Verifique o spam ou reenvie.</p>
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={resend}>
              Reenviar e-mail
            </Button>
            <Button onClick={() => go("login")}>Ir para o login</Button>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <label className="block text-sm font-semibold">
                  Seu nome
                  <input
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 h-11 w-full rounded-md border bg-card px-3"
                    placeholder="Nome completo"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Nome da corretora{" "}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="mt-2 h-11 w-full rounded-md border bg-card px-3"
                    placeholder="Ex.: Silva Corretora de Seguros"
                  />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Recebeu convite de uma corretora? Use o e-mail convidado; você entra direto na
                    equipe.
                  </span>
                </label>
              </>
            )}
            <label className="block text-sm font-semibold">
              E-mail
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-3.5 text-muted-foreground" size={16} />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-md border bg-card pl-10 pr-3"
                  placeholder="voce@corretora.com.br"
                />
              </div>
            </label>
            {mode !== "recover" && (
              <label className="block text-sm font-semibold">
                Senha
                <div className="relative mt-2">
                  <input
                    required
                    minLength={mode === "register" ? 8 : 6}
                    type={show ? "text" : "password"}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-md border bg-card px-3 pr-11"
                    placeholder={mode === "register" ? "Mínimo de 8 caracteres" : "Sua senha"}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-1 top-1 grid size-9 place-items-center rounded text-muted-foreground"
                    title={show ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
            )}
            {mode === "register" && (
              <label className="block text-sm font-semibold">
                Confirmar senha
                <input
                  required
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="mt-2 h-11 w-full rounded-md border bg-card px-3"
                />
              </label>
            )}
            {notice && (
              <Notice tone={notice.tone}>
                {notice.text}
                {needsConfirm && (
                  <button
                    type="button"
                    onClick={resend}
                    className="mt-2 block font-semibold underline"
                  >
                    Reenviar e-mail de confirmação
                  </button>
                )}
              </Notice>
            )}
            <Button disabled={busy} size="lg" className="mt-2 w-full">
              {busy
                ? "Aguarde…"
                : mode === "login"
                  ? "Entrar"
                  : mode === "register"
                    ? "Criar conta"
                    : "Enviar link"}{" "}
              <ArrowRight />
            </Button>
          </form>
          {mode !== "recover" && !native && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> ou{" "}
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={google}
                disabled={busy}
              >
                Continuar com Google
              </Button>
            </>
          )}
          <div className="mt-7 flex justify-between gap-4 text-sm">
            <button
              type="button"
              className="font-semibold text-primary"
              onClick={() => go(mode === "register" ? "login" : "register")}
            >
              {mode === "register" ? "Já tenho conta" : "Criar conta"}
            </button>
            <button
              type="button"
              className="text-muted-foreground"
              onClick={() => go(mode === "recover" ? "login" : "recover")}
            >
              {mode === "recover" ? "Voltar para entrar" : "Esqueceu a senha?"}
            </button>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
