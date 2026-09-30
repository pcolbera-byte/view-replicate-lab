import type { ReactNode } from "react";
import { BrandMark, Wordmark } from "@/components/brand/logo";

export function Notice({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <div
      role="status"
      className={`rounded-md p-3 text-sm ${tone === "error" ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground"}`}
    >
      {children}
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-celeste-strong via-primary to-primary-deep p-14 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full border-[3.5rem] border-white/10"
        />
        <div className="relative flex items-center gap-3 text-xl">
          <BrandMark size={44} className="drop-shadow-md" />
          <Wordmark onDark />
        </div>
        <div className="relative max-w-lg">
          <p className="mb-6 text-sm font-semibold uppercase opacity-70">
            Gestão da corretora de seguros
          </p>
          <h1 className="text-5xl font-bold leading-tight">
            Organize a carteira.
            <br />
            Não perca a renovação.
          </h1>
          <p className="mt-6 text-lg opacity-75">
            Leads, clientes, apólices, parcelas, sinistros e comissões num só lugar — no computador
            e no celular.
          </p>
        </div>
        <p className="relative text-sm opacity-70">
          Corretix · seus dados isolados e protegidos por corretora
        </p>
      </div>
      <div className="flex items-center justify-center px-6 pb-16 pt-[calc(4rem+env(safe-area-inset-top))]">
        <div className="w-full max-w-sm">
          <div className="mb-12 flex items-center gap-2.5 text-xl lg:hidden">
            <BrandMark size={36} /> <Wordmark />
          </div>
          {children}
          <p className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <a href="/privacidade" className="hover:text-foreground hover:underline">
              Política de privacidade
            </a>
            <a href="/termos" className="hover:text-foreground hover:underline">
              Termos de uso
            </a>
            <a href="/excluir-conta" className="hover:text-foreground hover:underline">
              Excluir conta
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
