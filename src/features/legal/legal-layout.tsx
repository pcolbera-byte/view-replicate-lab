import type { ReactNode } from "react";
import { BrandMark, Wordmark } from "@/components/brand/logo";
import { LEGAL } from "@/lib/legal";

/** Página pública e simples (privacidade, termos, exclusão de conta) — as lojas exigem um link aberto. */
export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5 text-lg">
            <BrandMark size={32} /> <Wordmark />
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Atualizado em {LEGAL.atualizadoEm}</p>
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed">{children}</div>
        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-1 border-t pt-6 text-sm text-muted-foreground">
          <a href="/privacidade" className="hover:text-foreground hover:underline">
            Política de privacidade
          </a>
          <a href="/termos" className="hover:text-foreground hover:underline">
            Termos de uso
          </a>
          <a href="/excluir-conta" className="hover:text-foreground hover:underline">
            Excluir conta
          </a>
          <a href="/auth" className="hover:text-foreground hover:underline">
            Entrar
          </a>
        </nav>
      </main>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-4 font-display text-xl font-bold">{children}</h2>;
}
export function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-6">{children}</ul>;
}
