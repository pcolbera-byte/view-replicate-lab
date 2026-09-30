import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { Card, CardHeader } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import {
  IMPORT_STEPS,
  buildImport,
  readMaisCorret,
  sendImport,
  type ImportPlan,
  type ImportProgress,
} from "./maiscorret";

type Stage =
  | { kind: "idle" }
  | { kind: "reading"; fileName: string }
  | { kind: "preview"; fileName: string; plan: ImportPlan }
  | { kind: "sending"; fileName: string; plan: ImportPlan; progress: ImportProgress }
  | { kind: "done"; plan: ImportPlan; errors: string[] }
  | { kind: "error"; message: string };

export function ImportacaoSection() {
  const { ws, refresh } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  async function choose(file: File | undefined) {
    if (!file) return;
    setStage({ kind: "reading", fileName: file.name });
    try {
      const tables = await readMaisCorret(file);
      const existentes = new Map(ws.seguradoras.map((s) => [s.nome.toLowerCase(), s.id]));
      const plan = buildImport(tables, {
        empresaId: ws.empresa.id,
        adminId: ws.userId,
        existentes,
        comProdutores: ws.temProdutores,
        produtoresExistentes: new Map(
          ws.produtores.map((p) => [p.nome.toLowerCase(), { id: p.id, usuario_id: p.usuario_id }]),
        ),
        atual: {
          clientes: ws.clientes,
          apolices: ws.apolices,
          comissoes: ws.comissoes,
          apolice_rateio: ws.apolice_rateio,
        },
      });
      setStage({ kind: "preview", fileName: file.name, plan });
    } catch (e) {
      setStage({
        kind: "error",
        message:
          e instanceof Error
            ? e.message
            : "Não foi possível ler o arquivo. Confira se é o .mdb do Mais Corret.",
      });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function start() {
    if (stage.kind !== "preview") return;
    const { plan, fileName } = stage;
    try {
      const errors = await sendImport(plan, ws.empresa.id, (progress) =>
        setStage({
          kind: "sending",
          fileName,
          plan,
          progress: { ...progress, errors: [...progress.errors] },
        }),
      );
      await refresh();
      setStage({ kind: "done", plan, errors });
    } catch (e) {
      await refresh();
      setStage({
        kind: "error",
        message: e instanceof Error ? e.message : "A importação foi interrompida.",
      });
    }
  }

  const plan =
    stage.kind === "preview" || stage.kind === "sending" || stage.kind === "done"
      ? stage.plan
      : null;
  const st = (s: string) => plan?.rows.apolices.filter((a) => a.status === s).length ?? 0;
  const correcoes = plan
    ? plan.updates.clientes.length + plan.updates.apolices.length + plan.updates.comissoes.length
    : 0;

  return (
    <Card>
      <CardHeader
        title="Importar do Mais Corret"
        subtitle="Traz produtores, clientes, veículos, apólices (com o histórico de renovações), rateio de comissão, parcelas e comissões a vencer, endossos e anotações. Pode repetir: nada duplica e o que já entrou é corrigido."
      />
      <div className="space-y-5 p-4 lg:p-5">
        <input
          ref={input}
          type="file"
          accept=".mdb,.accdb"
          hidden
          onChange={(e) => choose(e.target.files?.[0])}
        />

        {(stage.kind === "idle" || stage.kind === "error") && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <FileUp size={28} className="text-emerald" />
              <span className="font-semibold">Escolher o arquivo do Mais Corret (.mdb)</span>
              <span className="text-sm text-muted-foreground">
                O arquivo é lido aqui no seu navegador. Nada é gravado antes de você confirmar.
              </span>
            </button>
            {stage.kind === "error" && (
              <p
                role="alert"
                className="flex gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                <span className="whitespace-pre-line">{stage.message}</span>
              </p>
            )}
          </div>
        )}

        {stage.kind === "reading" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={17} /> Lendo {stage.fileName}…
          </p>
        )}

        {plan && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Num label="Clientes" value={plan.rows.clientes.length} />
              {ws.temProdutores && (
                <Num
                  label="Produtores"
                  value={plan.rows.produtores.length}
                  hint={`${plan.rows.apolice_rateio.length} linhas de rateio`}
                />
              )}
              <Num label="Veículos" value={plan.rows.veiculos.length} />
              <Num
                label="Apólices"
                value={plan.rows.apolices.length}
                hint={`${plan.vigentes} vigentes`}
              />
              <Num label="Parcelas a vencer" value={plan.rows.parcelas.length} />
              <Num label="Comissões previstas" value={plan.rows.comissoes.length} />
              <Num
                label="Histórico"
                value={plan.rows.historico_contatos.length}
                hint="endossos e anotações"
              />
              <Num label="Seguradoras novas" value={plan.rows.seguradoras.length} />
              <Num
                label="Renovadas / encerradas"
                value={`${st("Renovada")} / ${st("Encerrada")}`}
                hint={`${st("Cancelada")} canceladas`}
              />
              {correcoes > 0 && (
                <Num label="Correções" value={correcoes} hint="em registros já importados" />
              )}
            </div>
            {!ws.temProdutores && (
              <p className="flex gap-2 rounded-md bg-warning/15 p-3 text-sm">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                <span>
                  Os produtores e o rateio de comissão não serão importados porque falta aplicar no
                  Lovable a migração <strong>20260930150000_produtores.sql</strong>. Aplique e
                  importe de novo: o restante não duplica.
                </span>
              </p>
            )}
            {(plan.avisos.length > 0 || plan.ignorados.length > 0) && (
              <details className="rounded-md bg-muted p-3 text-sm">
                <summary className="cursor-pointer font-semibold">
                  Avisos e itens não importados
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {plan.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                  {plan.ignorados.map(([k, n]) => (
                    <li key={k}>
                      {n} × {k}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {stage.kind === "preview" && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button onClick={start}>
              <Upload /> Importar para “{ws.empresa.nome}”
            </Button>
            <Button variant="ghost" onClick={() => setStage({ kind: "idle" })}>
              Cancelar
            </Button>
            <span className="text-xs text-muted-foreground">Arquivo: {stage.fileName}</span>
          </div>
        )}

        {stage.kind === "sending" && (
          <div className="space-y-2 border-t pt-4">
            {[...IMPORT_STEPS, { key: "correcoes" as const, label: "Correções" }].map(
              ({ key, label }, mine, steps) => {
                const idx = steps.findIndex((s) => s.key === stage.progress.step);
                const total = key === "correcoes" ? correcoes : stage.plan.rows[key].length;
                const done = mine < idx ? total : mine === idx ? stage.progress.done : 0;
                const pct = total ? Math.round((done / total) * 100) : mine <= idx ? 100 : 0;
                return (
                  <div
                    key={key}
                    className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3 text-sm"
                  >
                    <span className={cn(mine === idx && "font-semibold")}>{label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-emerald transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {done}/{total}
                    </span>
                  </div>
                );
              },
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Não feche esta página até terminar.
            </p>
          </div>
        )}

        {stage.kind === "done" && (
          <div className="space-y-3 border-t pt-4">
            {stage.errors.length === 0 ? (
              <p className="flex items-center gap-2 font-semibold text-emerald">
                <CheckCircle2 size={19} /> Importação concluída.
              </p>
            ) : (
              <div className="rounded-md bg-warning/15 p-3 text-sm">
                <p className="mb-1 font-semibold">Importação concluída com avisos:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {stage.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/clientes">Ver clientes</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/renovacoes">Ver renovações</Link>
              </Button>
              <Button variant="ghost" onClick={() => setStage({ kind: "idle" })}>
                Importar outro arquivo
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Num({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string | undefined;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
