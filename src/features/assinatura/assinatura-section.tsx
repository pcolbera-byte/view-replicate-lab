import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { Badge, Card, CardHeader } from "@/components/shared/ui";
import { dateBR, dateTimeBR, todayISO } from "@/lib/format";
import { isNativeApp } from "@/lib/native";
import { diasDeTeste, liberadoAte, PLANO, valorBR, type Assinatura } from "@/lib/plano";
import {
  cancelarAssinatura,
  iniciarAssinatura,
  sincronizarAssinatura,
} from "./assinatura.functions";

const ROTULO: Record<Assinatura["status"], [string, "good" | "warn" | "bad" | "info" | "neutral"]> =
  {
    teste: ["Teste grátis", "info"],
    pendente: ["Aguardando pagamento", "warn"],
    ativa: ["Ativa", "good"],
    atrasada: ["Pagamento pendente", "bad"],
    cancelada: ["Cancelada", "neutral"],
    isenta: ["Isenta", "good"],
  };

const erro = (e: unknown) =>
  e instanceof Error
    ? e.message.replace(/^Error:\s*/, "")
    : "Não foi possível falar com o Mercado Pago.";

export function AssinaturaSection() {
  const { ws, refresh, confirm } = useWorkspace();
  const a = ws.assinatura;
  const [email, setEmail] = useState(ws.email);
  const [busy, setBusy] = useState<"" | "assinar" | "sync" | "cancelar">("");
  const nativo = isNativeApp();
  const voltou = useRef(false);

  // Volta do Mercado Pago: confere o pagamento na hora (o aviso automático pode demorar).
  useEffect(() => {
    if (voltou.current || !a?.mp_preapproval_id) return;
    if (new URLSearchParams(window.location.search).get("retorno") !== "1") return;
    voltou.current = true;
    void sincronizar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.mp_preapproval_id]);

  async function assinar() {
    setBusy("assinar");
    try {
      const { url } = await iniciarAssinatura({ data: { email } });
      window.location.href = url;
    } catch (e) {
      toast.error(erro(e));
      setBusy("");
    }
  }
  async function sincronizar(silencioso = false) {
    setBusy("sync");
    try {
      const r = await sincronizarAssinatura();
      await refresh();
      if (!silencioso || r.status === "authorized")
        toast.success(
          r.status === "authorized" ? "Assinatura ativa. Obrigado!" : "Situação atualizada.",
        );
    } catch (e) {
      toast.error(erro(e));
    } finally {
      setBusy("");
    }
  }
  async function cancelar() {
    const ok = await confirm({
      title: "Cancelar a assinatura?",
      description: `Não haverá novas cobranças. O acesso continua até ${dateBR(a?.pago_ate ?? a?.proxima_cobranca)}.`,
      confirmLabel: "Cancelar assinatura",
      destructive: true,
    });
    if (ok === false) return;
    setBusy("cancelar");
    try {
      await cancelarAssinatura();
      await refresh();
      toast.success("Assinatura cancelada.");
    } catch (e) {
      toast.error(erro(e));
    } finally {
      setBusy("");
    }
  }

  if (!a)
    return (
      <Card>
        <CardHeader
          title="Assinatura"
          subtitle="A cobrança ainda não foi ativada neste banco (migração 20260930200000_assinaturas.sql)."
        />
      </Card>
    );

  const [rotulo, tom] = ROTULO[a.status];
  const hoje = todayISO();
  const dias = diasDeTeste(a, hoje);
  const ate = liberadoAte(a);
  const podeAssinar = ws.isAdmin && !nativo && a.status !== "ativa" && a.status !== "isenta";

  return (
    <div className="space-y-5" data-testid="assinatura">
      <Card>
        <CardHeader
          title="Assinatura"
          subtitle={`${PLANO.nome} · ${valorBR(Number(a.valor ?? PLANO.valor))}/mês`}
          action={<Badge tone={tom}>{rotulo}</Badge>}
        />
        <div className="space-y-2 p-4 text-sm lg:p-5">
          {a.status === "isenta" && <p>Esta corretora tem acesso liberado sem cobrança.</p>}
          {(a.status === "teste" || a.status === "pendente") && (
            <p>
              {dias >= 0 ? (
                <>
                  Teste grátis até <strong>{dateBR(a.teste_ate)}</strong> (
                  {dias === 0 ? "último dia" : `faltam ${dias} dia${dias === 1 ? "" : "s"}`}).
                  Assinando agora, a primeira cobrança só acontece no fim do teste.
                </>
              ) : (
                <>O teste grátis terminou em {dateBR(a.teste_ate)}.</>
              )}
            </p>
          )}
          {a.status === "pendente" && (
            <p className="text-muted-foreground">
              Você começou a assinatura mas o pagamento ainda não foi confirmado pelo Mercado Pago.
            </p>
          )}
          {a.status === "ativa" && (
            <p className="flex items-center gap-2">
              <CheckCircle2 size={17} className="text-emerald" /> Próxima cobrança em{" "}
              <strong>{dateBR(a.proxima_cobranca)}</strong>.
            </p>
          )}
          {a.status === "atrasada" && (
            <p>
              O Mercado Pago não conseguiu cobrar a última mensalidade. Atualize o cartão na sua
              conta do Mercado Pago ou assine novamente.
              {ate && <> Acesso garantido até {dateBR(ate)}.</>}
            </p>
          )}
          {a.status === "cancelada" && (
            <p>
              Assinatura cancelada{a.cancelada_em ? ` em ${dateBR(a.cancelada_em)}` : ""}.
              {ate && hoje <= ate ? ` Acesso até ${dateBR(ate)}.` : ""}
            </p>
          )}
          {a.ultimo_pagamento_em && (
            <p className="text-muted-foreground">
              Último pagamento: {dateTimeBR(a.ultimo_pagamento_em)}
              {a.ultimo_pagamento_status ? ` (${a.ultimo_pagamento_status})` : ""}
            </p>
          )}
        </div>
      </Card>

      {nativo && a.status !== "isenta" && (
        <p className="text-sm text-muted-foreground">
          A assinatura é gerenciada pelo site do CorretorOne, no navegador do computador.
        </p>
      )}

      {!ws.isAdmin && a.status !== "isenta" && (
        <p className="text-sm text-muted-foreground">
          Somente o administrador da corretora pode assinar ou cancelar.
        </p>
      )}

      {podeAssinar && (
        <Card>
          <CardHeader
            title={a.status === "pendente" ? "Concluir o pagamento" : "Assinar"}
            subtitle="Pagamento mensal no cartão de crédito, pelo Mercado Pago. Cancele quando quiser."
          />
          <div className="space-y-4 p-4 lg:p-5">
            <label className="block text-sm font-semibold">
              E-mail da sua conta no Mercado Pago
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-md border bg-background px-3 text-sm font-normal sm:max-w-sm"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Use o mesmo e-mail com que você entra no Mercado Pago.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={assinar} disabled={!!busy}>
                {busy === "assinar" ? <LoaderCircle className="animate-spin" /> : <CreditCard />}
                Assinar por {valorBR(PLANO.valor)}/mês
                <ExternalLink className="opacity-70" />
              </Button>
              {a.mp_preapproval_id && (
                <Button variant="outline" size="lg" onClick={() => sincronizar()} disabled={!!busy}>
                  <RefreshCw className={busy === "sync" ? "animate-spin" : ""} /> Já paguei —
                  atualizar
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {ws.isAdmin && !nativo && a.status === "ativa" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => sincronizar()} disabled={!!busy}>
            <RefreshCw className={busy === "sync" ? "animate-spin" : ""} /> Atualizar situação
          </Button>
          <Button variant="ghost" className="text-destructive" onClick={cancelar} disabled={!!busy}>
            Cancelar assinatura
          </Button>
        </div>
      )}
    </div>
  );
}
