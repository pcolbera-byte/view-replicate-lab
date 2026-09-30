// Faixa do teste grátis e bloqueio quando o teste/pagamento vence.
import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { SignOutButton } from "@/components/app/sign-out-button";
import { BrandMark } from "@/components/brand/logo";
import { acessoLiberado, diasDeTeste, PLANO, valorBR } from "@/lib/plano";
import { todayISO } from "@/lib/format";
import { isNativeApp } from "@/lib/native";

export function TesteBanner() {
  const { ws } = useWorkspace();
  const a = ws.assinatura;
  if (!a || isNativeApp()) return null;
  const hoje = todayISO();
  if (a.status === "teste" || a.status === "pendente") {
    const d = diasDeTeste(a, hoje);
    if (d < 0) return null;
    return (
      <div className="border-b border-celeste/30 bg-celeste/10 px-4 py-2 text-center text-xs font-medium sm:px-6">
        Teste grátis: {d === 0 ? "último dia" : `faltam ${d} dia${d === 1 ? "" : "s"}`}.{" "}
        {ws.isAdmin ? (
          <Link
            to="/configuracoes"
            search={{ aba: "assinatura" }}
            className="font-semibold underline"
          >
            Assinar por {valorBR(PLANO.valor)}/mês
          </Link>
        ) : (
          "O administrador pode assinar em Configurações."
        )}
      </div>
    );
  }
  if (a.status === "atrasada")
    return (
      <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-xs font-medium sm:px-6">
        O último pagamento da assinatura não foi aprovado.{" "}
        {ws.isAdmin && (
          <Link
            to="/configuracoes"
            search={{ aba: "assinatura" }}
            className="font-semibold underline"
          >
            Ver assinatura
          </Link>
        )}
      </div>
    );
  return null;
}

/** Mostra a tela de bloqueio no lugar da página quando o acesso venceu (Configurações continua aberta). */
export function AcessoGate({ children }: { children: ReactNode }) {
  const { ws } = useWorkspace();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (acessoLiberado(ws.assinatura, todayISO()) || path.startsWith("/configuracoes"))
    return <>{children}</>;
  const nativo = isNativeApp();
  return (
    <div className="mx-auto max-w-lg py-10 text-center" data-testid="bloqueio">
      <div className="mx-auto mb-5 flex w-fit items-center gap-3">
        <BrandMark size={48} />
        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock size={18} />
        </span>
      </div>
      <h1 className="font-display text-2xl font-bold">
        {ws.assinatura?.status === "teste" || ws.assinatura?.status === "pendente"
          ? "Seu teste grátis terminou"
          : "Sua assinatura não está ativa"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        Seus dados continuam guardados.{" "}
        {nativo
          ? "Para voltar a usar, o administrador da corretora precisa regularizar a assinatura pelo site."
          : ws.isAdmin
            ? `Assine o ${PLANO.nome} por ${valorBR(PLANO.valor)}/mês para continuar de onde parou.`
            : "Peça ao administrador da corretora para assinar e liberar o acesso."}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {ws.isAdmin && !nativo && (
          <Button asChild size="lg">
            <Link to="/configuracoes" search={{ aba: "assinatura" }}>
              Assinar agora
            </Link>
          </Button>
        )}
        <SignOutButton variant="outline" />
      </div>
    </div>
  );
}
