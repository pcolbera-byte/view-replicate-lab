import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  DatabaseBackup,
  FileJson,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { Card, CardHeader } from "@/components/shared/ui";
import { dateTimeBR } from "@/lib/format";
import {
  baixarJson,
  baixarPlanilha,
  lerBackup,
  restaurar,
  type AnaliseRestauracao,
} from "@/lib/backup/backup";
import { baixarConsultaOffline } from "@/lib/backup/consulta-offline";
import {
  aoMudarBackup,
  definirFrequencia,
  FREQUENCIAS,
  frequenciaBackup,
  marcarBackup,
  ultimoBackup,
} from "@/lib/backup/lembrete";

export function BackupSection() {
  const { ws, refresh, confirm } = useWorkspace();
  const [ultimo, setUltimo] = useState(() => ultimoBackup(ws.empresa.id));
  const [freq, setFreq] = useState(() => frequenciaBackup(ws.empresa.id));
  useEffect(
    () =>
      aoMudarBackup(() => {
        setUltimo(ultimoBackup(ws.empresa.id));
        setFreq(frequenciaBackup(ws.empresa.id));
      }),
    [ws.empresa.id],
  );
  const [analise, setAnalise] = useState<AnaliseRestauracao | null>(null);
  const [prog, setProg] = useState<{ feito: number; total: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const total = (["clientes", "apolices", "veiculos", "parcelas", "comissoes"] as const).reduce(
    (t, k) => t + ws[k].length,
    0,
  );

  const marcar = () => marcarBackup(ws.empresa.id);

  async function escolher(file: File | undefined) {
    if (!file) return;
    try {
      setAnalise(await lerBackup(file, ws));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function executar() {
    if (!analise) return;
    const ok = await confirm({
      title: `Recriar ${analise.faltando} registro(s)?`,
      description:
        "Os registros do backup que não existem mais no sistema serão recriados. O que já existe não é alterado.",
      confirmLabel: "Restaurar",
    });
    if (ok === false) return;
    setProg({ feito: 0, total: 1 });
    try {
      const erros = await restaurar(analise, ws.empresa.id, (feito, t) =>
        setProg({ feito, total: t }),
      );
      await refresh();
      if (erros.length) toast.warning(`Restaurado com avisos: ${erros.slice(0, 2).join(" · ")}`);
      else toast.success("Backup restaurado.");
      setAnalise(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A restauração foi interrompida.");
    } finally {
      setProg(null);
    }
  }

  return (
    <div className="space-y-5" data-testid="backup">
      <Card>
        <CardHeader
          title="Fazer backup"
          subtitle="Baixe uma cópia de todos os dados da corretora para guardar no seu computador ou no Google Drive."
        />
        <div className="space-y-4 p-4 lg:p-5">
          <button
            type="button"
            data-testid="baixar-consulta-offline"
            onClick={() => {
              baixarConsultaOffline(ws);
              marcar();
              toast.success("Backup baixado. Guarde o arquivo em local seguro.");
            }}
            className="flex w-full items-start gap-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:border-primary/60"
          >
            <ShieldCheck className="mt-0.5 shrink-0 text-primary" />
            <span>
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                Backup com consulta offline (.html)
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  Recomendado
                </span>
              </span>
              <span className="text-sm text-muted-foreground">
                Um único arquivo que <strong>abre em qualquer navegador, sem internet</strong>:
                busca de clientes, telefones, apólices, veículos e renovações. Também serve para
                restaurar os dados aqui no Corretix.
              </span>
            </span>
          </button>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                baixarJson(ws);
                marcar();
                toast.success("Backup completo baixado.");
              }}
              className="flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <FileJson className="mt-0.5 shrink-0 text-celeste" />
              <span>
                <span className="block font-semibold">Backup completo (.json)</span>
                <span className="text-sm text-muted-foreground">
                  Guarda tudo e serve para <strong>restaurar</strong> aqui mesmo, se algo for
                  apagado.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                baixarPlanilha(ws);
                marcar();
                toast.success("Planilha baixada.");
              }}
              className="flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <FileSpreadsheet className="mt-0.5 shrink-0 text-emerald" />
              <span>
                <span className="block font-semibold">Planilha (Excel)</span>
                <span className="text-sm text-muted-foreground">
                  Uma aba para cada cadastro: clientes, apólices, parcelas, comissões…
                </span>
              </span>
            </button>
          </div>
          <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm" data-testid="ultimo-backup">
              {ultimo
                ? `Último backup neste computador: ${dateTimeBR(ultimo)}.`
                : "Nenhum backup feito neste computador ainda."}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Lembrar de fazer backup</span>
              <select
                value={freq}
                onChange={(e) => definirFrequencia(ws.empresa.id, Number(e.target.value))}
                className="h-9 rounded-md border bg-background px-2 text-sm"
                data-testid="frequencia-backup"
              >
                {FREQUENCIAS.map((f) => (
                  <option key={f.dias} value={f.dias}>
                    {f.rotulo}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {total.toLocaleString("pt-BR")} registros principais hoje. Guarde uma cópia fora do
            computador também (pen drive ou Google Drive). Os arquivos anexados (PDFs e fotos) não
            entram no backup; baixe-os pela ficha quando precisar.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Restaurar backup"
          subtitle="Recria registros apagados por engano a partir de um backup desta corretora (.html de consulta offline ou .json)."
        />
        <div className="space-y-4 p-4 lg:p-5">
          <input
            ref={input}
            type="file"
            accept=".json,application/json,.html,text/html"
            hidden
            onChange={(e) => escolher(e.target.files?.[0])}
          />
          {!analise ? (
            <Button variant="outline" onClick={() => input.current?.click()}>
              <Upload /> Escolher arquivo de backup
            </Button>
          ) : (
            <>
              <p className="text-sm">
                Backup de <strong>{analise.backup.empresa_nome}</strong>, gerado em{" "}
                {dateTimeBR(analise.backup.gerado_em)}.
              </p>
              <div className="overflow-hidden rounded-md border text-sm">
                {analise.porTabela
                  .filter((t) => t.total)
                  .map((t) => (
                    <div
                      key={t.tabela}
                      className="flex justify-between border-b px-3 py-1.5 last:border-0"
                    >
                      <span>{t.rotulo}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {t.total} no backup ·{" "}
                        <span className={t.faltando ? "font-semibold text-foreground" : ""}>
                          {t.faltando} a recriar
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
              {analise.faltando === 0 ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald">
                  <CheckCircle2 size={17} /> Nada a restaurar: tudo do backup já existe no sistema.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {analise.faltando > 0 && (
                  <Button onClick={executar} disabled={!!prog}>
                    {prog ? <LoaderCircle className="animate-spin" /> : <DatabaseBackup />}
                    {prog
                      ? `Restaurando… ${Math.round((prog.feito / Math.max(prog.total, 1)) * 100)}%`
                      : `Recriar ${analise.faltando} registro(s)`}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setAnalise(null)} disabled={!!prog}>
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
