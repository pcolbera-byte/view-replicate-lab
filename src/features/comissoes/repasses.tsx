// Repasse de comissões aos produtores: fecha o mês de cada produtor com as comissões já
// recebidas pela corretora, registra o pagamento e gera o extrato/recibo em PDF.
import { useMemo, useState } from "react";
import { BadgeCheck, Eye, FileText, HandCoins, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/panel";
import { Card, EmptyState, FilterSelect, StatusBadge } from "@/components/shared/ui";
import { useWorkspace } from "@/components/app/workspace-context";
import { deleteRecord, rpcSemTipos, updateFields } from "@/lib/data/workspace";
import type { Comissao, Repasse } from "@/lib/data/types";
import { dateBR, money, todayISO } from "@/lib/format";
import { baixarExcel, baixarPdf, type Relatorio } from "@/lib/relatorio/exportar";
import { RelatorioPreview } from "@/components/shared/relatorio-preview";
import { mesLabel, relatorioRepasse } from "./repasse-relatorio";
import { cn } from "@/lib/utils";

type Ctx = ReturnType<typeof useWorkspace>;

const fimDoMes = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y ?? 2000, m ?? 1, 0)).toISOString().slice(0, 10);
};
const FORMAS = ["PIX", "Transferência", "Dinheiro", "Boleto", "Cheque", "Outro"];

/** Percentual padrão do repasse: com rateio a comissão já é a parte do produtor (100%). */
function percentualPadrao(ctx: Pick<Ctx, "get">, c: Comissao): number {
  if (ctx.get.rateio(c.apolice_id).length) return 100;
  const p = ctx.get.produtor(c.produtor_id);
  return p?.percentual_padrao != null ? Number(p.percentual_padrao) : 100;
}

export function RepassesSection() {
  const ctx = useWorkspace();
  const { ws, get, run, confirm } = ctx;
  const produtores = ws.produtores.filter((p) => p.tipo !== "Corretora");
  const meus = ws.produtores.filter((p) => p.usuario_id === ws.userId).map((p) => p.id);
  const [produtor, setProdutor] = useState(produtores[0]?.id ?? "");
  const [mes, setMes] = useState(todayISO().slice(0, 7));
  const [pct, setPct] = useState<Record<string, string>>({});
  const [fora, setFora] = useState<Set<string>>(new Set());
  const [obs, setObs] = useState("");
  const [previa, setPrevia] = useState<Relatorio | null>(null);
  const [pagar, setPagar] = useState<{ r: Repasse; data: string; forma: string } | null>(null);

  const repassadas = useMemo(
    () => new Set(ws.repasse_itens.map((i) => i.comissao_id)),
    [ws.repasse_itens],
  );
  // Comissões do produtor já recebidas pela corretora até o fim do mês e ainda não repassadas.
  const pendentes = useMemo(
    () =>
      ws.comissoes
        .filter(
          (c) =>
            c.produtor_id === produtor &&
            c.status === "Recebida" &&
            !repassadas.has(c.id) &&
            (c.data_recebida ?? c.data_prevista) <= fimDoMes(mes),
        )
        .sort((a, b) => (a.data_recebida ?? "").localeCompare(b.data_recebida ?? "")),
    [ws.comissoes, produtor, repassadas, mes],
  );
  const base = (c: Comissao) => Number(c.valor_recebido ?? c.valor);
  const pctDe = (c: Comissao) => {
    const v = pct[c.id];
    return v === undefined ? percentualPadrao(ctx, c) : Number(v.replace(",", ".")) || 0;
  };
  const valorDe = (c: Comissao) => Math.round(base(c) * pctDe(c)) / 100;
  const incluidas = pendentes.filter((c) => !fora.has(c.id));
  const total = incluidas.reduce((t, c) => t + valorDe(c), 0);

  const historico = ws.repasses.filter((r) =>
    ws.isAdmin ? !produtor || r.produtor_id === produtor : meus.includes(r.produtor_id),
  );

  async function gerar() {
    if (!incluidas.length) return;
    if (incluidas.some((c) => pctDe(c) < 0 || pctDe(c) > 100)) {
      toast.error("O percentual de repasse deve ficar entre 0 e 100.");
      return;
    }
    const ok = await run(
      () =>
        rpcSemTipos("gerar_repasse", {
          _produtor: produtor,
          _competencia: `${mes}-01`,
          _itens: incluidas.map((c) => ({
            comissao_id: c.id,
            base: base(c),
            percentual: pctDe(c),
          })),
          _observacoes: obs.trim(),
        }),
      "Repasse gerado.",
    );
    if (ok) {
      setPct({});
      setFora(new Set());
      setObs("");
    }
  }

  async function excluir(r: Repasse) {
    const ok = await confirm({
      title: "Excluir este repasse?",
      description: "As comissões dele voltam para a lista de comissões a repassar.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok !== false) await run(() => deleteRecord("repasses", r.id), "Repasse excluído.");
  }

  async function exportar(r: Repasse, tipo: "pdf" | "xlsx") {
    const rel = relatorioRepasse({ ws, get }, r);
    try {
      if (tipo === "pdf") await baixarPdf(rel);
      else baixarExcel(rel);
    } catch {
      toast.error("Não foi possível gerar o arquivo.");
    }
  }

  if (!ws.temOperacao)
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        O repasse precisa da atualização do banco <strong>20261013120000_operacao_corretora</strong>{" "}
        (Lovable Cloud → SQL).
      </Card>
    );
  if (ws.isAdmin && !produtores.length)
    return (
      <Card>
        <EmptyState
          icon={HandCoins}
          title="Nenhum produtor cadastrado"
          subtitle="Cadastre os produtores em Configurações → Produtores para fazer os repasses."
        />
      </Card>
    );

  return (
    <div className="space-y-5" data-testid="repasses">
      {ws.isAdmin && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Fechar repasse do mês</p>
              <p className="text-xs text-muted-foreground">
                Entram as comissões do produtor já recebidas pela corretora até o fim do mês e ainda
                não repassadas. O % vem do rateio da apólice ou do percentual padrão do produtor e
                pode ser ajustado.
              </p>
            </div>
            <FilterSelect
              aria-label="Produtor do repasse"
              value={produtor}
              onChange={(v) => {
                setProdutor(v);
                setPct({});
                setFora(new Set());
              }}
              options={produtores.map((p) => ({
                value: p.id,
                label: `${p.nome}${p.percentual_padrao != null ? ` (${p.percentual_padrao}%)` : ""}`,
              }))}
              allLabel={null}
            />
            <label className="text-xs font-semibold text-muted-foreground">
              Competência
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="mt-1 block h-10 rounded-md border bg-card px-3 text-sm text-foreground"
              />
            </label>
          </div>
          {pendentes.length ? (
            <>
              <div className="hidden grid-cols-[2rem_minmax(0,1.6fr)_1fr_7rem_7rem_6rem_7rem] gap-3 bg-muted/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                <span />
                <span>Cliente · apólice</span>
                <span>Recebida em</span>
                <span className="text-right">Comissão</span>
                <span className="text-right">Previsto</span>
                <span className="text-right">% repasse</span>
                <span className="text-right">Repasse</span>
              </div>
              {pendentes.map((c) => {
                const a = get.apolice(c.apolice_id);
                const dentro = !fora.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-1 border-t px-4 py-2.5 text-sm lg:grid-cols-[2rem_minmax(0,1.6fr)_1fr_7rem_7rem_6rem_7rem]",
                      !dentro && "opacity-50",
                    )}
                    data-testid="item-repasse"
                  >
                    <input
                      type="checkbox"
                      className="col-start-1 row-span-2 row-start-1 size-4 self-start lg:row-span-1 lg:row-start-auto lg:self-center"
                      aria-label="Incluir no repasse"
                      checked={dentro}
                      onChange={() => {
                        const s = new Set(fora);
                        if (s.has(c.id)) s.delete(c.id);
                        else s.add(c.id);
                        setFora(s);
                      }}
                    />
                    <span className="col-start-2 row-start-1 min-w-0 lg:col-start-auto lg:row-start-auto">
                      <span className="block truncate font-medium">
                        {get.clienteNome(a?.cliente_id)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a?.seguradora} {a?.numero}
                        {c.parcela ? ` · parcela ${c.parcela}` : c.endosso_id ? " · endosso" : ""}
                      </span>
                    </span>
                    <span className="hidden text-muted-foreground lg:block">
                      {dateBR(c.data_recebida)}
                    </span>
                    <span className="hidden text-right tabular-nums lg:block">
                      {money(base(c))}
                    </span>
                    <span className="hidden text-right tabular-nums text-muted-foreground lg:block">
                      {money(c.valor)}
                    </span>
                    <span className="col-start-2 row-start-2 flex lg:row-start-auto items-center gap-2 lg:col-start-auto lg:justify-end">
                      <span className="text-xs text-muted-foreground lg:hidden">
                        {money(base(c))} ×
                      </span>
                      <input
                        aria-label="Percentual do repasse"
                        inputMode="decimal"
                        value={pct[c.id] ?? String(percentualPadrao(ctx, c))}
                        onChange={(e) => setPct({ ...pct, [c.id]: e.target.value })}
                        className="h-8 w-16 rounded-md border bg-background px-2 text-right text-sm"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </span>
                    <span className="col-start-3 row-start-1 text-right lg:col-start-auto font-semibold tabular-nums lg:row-start-auto">
                      {money(valorDe(c))}
                    </span>
                  </div>
                );
              })}
              <div className="flex flex-col gap-2 border-t bg-muted/30 p-4 sm:flex-row sm:items-center">
                <input
                  placeholder="Observação (opcional)"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                />
                <p className="text-sm">
                  {incluidas.length} comissão(ões) · total <strong>{money(total)}</strong>
                </p>
                <Button
                  disabled={!incluidas.length}
                  onClick={() => void gerar()}
                  data-testid="gerar-repasse"
                >
                  <HandCoins /> Gerar repasse
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              icon={HandCoins}
              title="Nada a repassar para este produtor"
              subtitle="As comissões aparecem aqui depois que a corretora dá baixa nelas (manualmente ou pela conciliação)."
            />
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <p className="border-b bg-muted/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {ws.isAdmin ? "Repasses gerados" : "Seus repasses"}
        </p>
        {historico.length ? (
          historico.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-sm"
              data-testid="repasse"
            >
              <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                <p className="truncate font-medium">
                  {get.produtorNome(r.produtor_id)} · competência {mesLabel(r.competencia)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {ws.repasse_itens.filter((i) => i.repasse_id === r.id).length} comissão(ões)
                  {r.pago_em
                    ? ` · pago em ${dateBR(r.pago_em)}${r.forma_pagamento ? ` (${r.forma_pagamento})` : ""}`
                    : ""}
                  {r.observacoes ? ` · ${r.observacoes}` : ""}
                </p>
              </div>
              <span className="font-semibold tabular-nums">{money(r.valor)}</span>
              <StatusBadge status={r.status === "Pago" ? "Pago" : "Pendente"} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPrevia(relatorioRepasse({ ws, get }, r))}
                data-testid="ver-repasse"
              >
                <Eye /> Ver
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void exportar(r, "pdf")}
                data-testid="pdf-repasse"
              >
                <FileText /> PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void exportar(r, "xlsx")}>
                Excel
              </Button>
              {ws.isAdmin && r.status === "Aberto" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => setPagar({ r, data: todayISO(), forma: "PIX" })}
                    data-testid="pagar-repasse"
                  >
                    <BadgeCheck /> Pago
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir repasse"
                    onClick={() => void excluir(r)}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
              {ws.isAdmin && r.status === "Pago" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    run(() =>
                      updateFields("repasses", r.id, {
                        status: "Aberto",
                        pago_em: null,
                      }),
                    )
                  }
                >
                  Reabrir
                </Button>
              )}
            </div>
          ))
        ) : (
          <EmptyState title="Nenhum repasse ainda" />
        )}
      </Card>

      <RelatorioPreview relatorio={previa} onClose={() => setPrevia(null)} />
      <Modal
        open={!!pagar}
        onClose={() => setPagar(null)}
        title="Registrar pagamento do repasse"
        description={
          pagar ? `${get.produtorNome(pagar.r.produtor_id)} · ${money(pagar.r.valor)}` : undefined
        }
        width="w-[min(94vw,420px)]"
        footer={
          <>
            <Button variant="outline" onClick={() => setPagar(null)}>
              Cancelar
            </Button>
            <Button
              data-testid="confirmar-pagamento"
              onClick={async () => {
                if (!pagar) return;
                const ok = await run(
                  () =>
                    updateFields("repasses", pagar.r.id, {
                      status: "Pago",
                      pago_em: pagar.data,
                      forma_pagamento: pagar.forma,
                    }),
                  "Repasse marcado como pago.",
                );
                if (ok) setPagar(null);
              }}
            >
              Confirmar pagamento
            </Button>
          </>
        }
      >
        {pagar && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted-foreground">
              Data do pagamento
              <input
                type="date"
                value={pagar.data}
                onChange={(e) => setPagar({ ...pagar, data: e.target.value })}
                className="mt-1 block h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Forma
              <FilterSelect
                className="mt-1 block w-full"
                value={pagar.forma}
                onChange={(v) => setPagar({ ...pagar, forma: v })}
                options={FORMAS}
                allLabel={null}
              />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
