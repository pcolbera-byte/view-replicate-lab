// Conferência do cálculo das comissões previstas: mostra as que não batem com o
// percentual sobre o prêmio líquido (sem IOF) e recalcula de uma vez.
import { useMemo, useState } from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/shared/ui";
import { useWorkspace } from "@/components/app/workspace-context";
import { rpcSemTipos } from "@/lib/data/workspace";
import { comissaoEsperadaDaParcela, impostoComissao, liquidoInformado } from "@/lib/domain";
import { money } from "@/lib/format";
import type { Comissao } from "@/lib/data/types";

type Divergencia = { c: Comissao; esperado: number; estimado: boolean };

function useDivergencias(): Divergencia[] {
  const { ws, get } = useWorkspace();
  return useMemo(() => {
    if (!ws.temPremioLiquido) return [];
    const repassadas = new Set(ws.repasse_itens.map((i) => i.comissao_id));
    const maxParcela = new Map<string, number>();
    for (const c of ws.comissoes)
      if (!c.endosso_id && c.parcela)
        maxParcela.set(c.apolice_id, Math.max(maxParcela.get(c.apolice_id) ?? 0, c.parcela));
    const out: Divergencia[] = [];
    for (const c of ws.comissoes) {
      if (
        c.status !== "Prevista" ||
        !c.parcela ||
        c.endosso_id ||
        c.conciliacao_id ||
        repassadas.has(c.id) ||
        (c.observacoes ?? "").startsWith("Importada do Mais Corret")
      )
        continue;
      const a = get.apolice(c.apolice_id);
      if (!a) continue;
      const rateio = get.rateio(a.id);
      let pct: number | null = null;
      if (rateio.length) {
        const r = rateio.find((x) => x.produtor_id === c.produtor_id);
        if (!r) continue;
        pct = r.percentual;
      }
      const n = Math.max(a.parcelas_qtd ?? 0, maxParcela.get(a.id) ?? 1);
      const esperado = comissaoEsperadaDaParcela(a, c.parcela, n, pct, impostoComissao(ws.empresa));
      if (Math.abs(esperado - Number(c.valor)) > 0.009)
        out.push({ c, esperado, estimado: !liquidoInformado(a) });
    }
    return out;
  }, [ws, get]);
}

export function ConferenciaComissoes() {
  const { ws, get, run } = useWorkspace();
  const divergencias = useDivergencias();
  const [aberto, setAberto] = useState(false);
  if (!ws.isAdmin || !divergencias.length) return null;
  const atual = divergencias.reduce((t, d) => t + Number(d.c.valor), 0);
  const correto = divergencias.reduce((t, d) => t + d.esperado, 0);
  const estimadas = divergencias.filter((d) => d.estimado).length;
  return (
    <Card className="mb-5 border-warning/60 p-4" data-testid="conferencia-comissoes">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {divergencias.length} comissão(ões) prevista(s) não batem com o cálculo sobre o prêmio
            líquido
          </p>
          <p className="text-sm text-muted-foreground">
            Hoje somam {money(atual)}; pelo % sobre o prêmio líquido (sem IOF), menos o imposto
            retido, seriam <strong className="text-foreground">{money(correto)}</strong>.
            {estimadas > 0 &&
              ` Em ${estimadas} o prêmio líquido não foi informado e foi estimado tirando o IOF do total.`}{" "}
            Recebidas, conciliadas, repassadas e importadas do Mais Corret não são alteradas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setAberto(!aberto)}>
            {aberto ? <ChevronUp /> : <ChevronDown />} Ver
          </Button>
          <Button
            size="sm"
            data-testid="recalcular-comissoes"
            onClick={() =>
              run(
                () => rpcSemTipos<number>("recalcular_comissoes", {}),
                `${divergencias.length} comissão(ões) recalculada(s).`,
              )
            }
          >
            <Calculator /> Recalcular
          </Button>
        </div>
      </div>
      {aberto && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-md border text-sm">
          {divergencias.map(({ c, esperado, estimado }) => {
            const a = get.apolice(c.apolice_id);
            return (
              <div key={c.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-0">
                <span className="min-w-0 flex-1 truncate">
                  {get.clienteNome(a?.cliente_id)} · {a?.seguradora} {a?.numero} · parcela{" "}
                  {c.parcela}
                  {estimado ? " · líquido estimado" : ""}
                </span>
                <span className="tabular-nums text-muted-foreground line-through">
                  {money(c.valor)}
                </span>
                <span className="font-semibold tabular-nums">{money(esperado)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
