import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

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
      <div className="hidden flex-col justify-between bg-primary p-14 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3 font-display text-xl font-bold">
          <span className="grid size-10 place-items-center rounded-md bg-accent text-primary">
            <ShieldCheck size={22} />
          </span>{" "}
          corretor<span className="-ml-3 text-emerald">360</span>
        </div>
        <div className="max-w-lg">
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
        <p className="text-sm opacity-60">
          Corretor360 · seus dados isolados e protegidos por corretora
        </p>
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-12 flex items-center gap-2 font-display text-xl font-bold lg:hidden">
            <ShieldCheck className="text-primary" /> corretor360
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
