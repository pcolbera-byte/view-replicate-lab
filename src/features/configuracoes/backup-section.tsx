import { useRef, useState } from "react";
import {
  CheckCircle2,
  DatabaseBackup,
  FileJson,
  FileSpreadsheet,
  LoaderCircle,
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

const CHAVE = (empresa: string) => `corretix-ultimo-backup-${empresa}`;
const lerUltimo = (empresa: string) => {
  try {
    return localStorage.getItem(CHAVE(empresa));
  } catch {
    return null;
  }
};

export function BackupSection() {
  const { ws, refresh, confirm } = useWorkspace();
  const [ultimo, setUltimo] = useState(() => lerUltimo(ws.empresa.id));
  const [analise, setAnalise] = useState<AnaliseRestauracao | null>(null);
  const [prog, setProg] = useState<{ feito: number; total: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const total = (["clientes", "apolices", "veiculos", "parcelas", "comissoes"] as const).reduce(
    (t, k) => t + ws[k].length,
    0,
  );

  const marcar = () => {
    const agora = new Date().toISOString();
    try {
      localStorage.setItem(CHAVE(ws.empresa.id), agora);
    } catch {
      /* navegador sem armazenamento: só não lembra a data */
    }
    setUltimo(agora);
  };

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
          <p className="text-xs text-muted-foreground">
            {ultimo
              ? `Último backup feito neste aparelho: ${dateTimeBR(ultimo)}.`
              : "Nenhum backup feito neste aparelho ainda."}{" "}
            Recomendado: uma vez por semana. {total.toLocaleString("pt-BR")} registros principais
            hoje. Os arquivos anexados (PDFs e fotos) não entram no backup; baixe-os pela ficha
            quando precisar.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Restaurar backup"
          subtitle="Recria registros apagados por engano a partir de um backup completo (.json) desta corretora."
        />
        <div className="space-y-4 p-4 lg:p-5">
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
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
