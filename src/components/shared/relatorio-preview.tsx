// Visualização na tela de um relatório (o mesmo conteúdo do PDF/Excel), com os botões para
// gerar o arquivo depois de conferir.
import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/panel";
import {
  baixarExcel,
  baixarPdf,
  textoCelula,
  type Relatorio,
  type TipoColuna,
} from "@/lib/relatorio/exportar";
import { cn } from "@/lib/utils";

/** Mais linhas que isso ficam só no arquivo (a tela fica leve). */
const LIMITE_LINHAS = 500;

const direita = (t?: TipoColuna) => t === "moeda" || t === "numero" || t === "inteiro";

export function RelatorioPreview({
  relatorio: r,
  onClose,
}: {
  relatorio: Relatorio | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const baixar = async (tipo: "pdf" | "xlsx") => {
    if (!r) return;
    setBusy(tipo);
    try {
      if (tipo === "pdf") await baixarPdf(r);
      else baixarExcel(r);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o arquivo.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal
      open={!!r}
      onClose={onClose}
      title={r?.titulo ?? ""}
      description={r ? [r.empresa, r.subtitulo].filter(Boolean).join(" · ") : undefined}
      width="w-[min(98vw,1180px)]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() => void baixar("xlsx")}
            disabled={!!busy}
            data-testid="previa-xlsx"
          >
            {busy === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Excel
          </Button>
          <Button onClick={() => void baixar("pdf")} disabled={!!busy} data-testid="previa-pdf">
            {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />} PDF
          </Button>
        </>
      }
    >
      {r && (
        <div className="space-y-5" data-testid="previa-relatorio">
          {r.resumo && r.resumo.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {r.resumo.map(([k, v]) => (
                <div key={k} className="rounded-md bg-secondary/70 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {k}
                  </p>
                  <p className="font-display text-sm font-bold text-primary">{v}</p>
                </div>
              ))}
            </div>
          )}
          {r.secoes.map((s, i) => (
            <section key={i}>
              {s.titulo && (
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-celeste">
                  {s.titulo}
                </h3>
              )}
              {s.texto ? (
                <p className="text-sm text-muted-foreground">{s.texto}</p>
              ) : s.campos ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {s.campos
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-sm">
                        <dt className="w-40 shrink-0 text-xs font-semibold text-muted-foreground">
                          {k}
                        </dt>
                        <dd className="min-w-0 break-words">{v}</dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <Tabela secao={s} />
              )}
            </section>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Tabela({ secao: s }: { secao: Relatorio["secoes"][number] }) {
  const colunas = s.colunas ?? [];
  const linhas = s.linhas ?? [];
  if (!linhas.length) return <p className="text-sm text-muted-foreground">Nenhum registro.</p>;
  const visiveis = linhas.slice(0, LIMITE_LINHAS);
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="max-h-[55vh] overflow-auto">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-primary text-primary-foreground">
            <tr>
              {colunas.map((c, j) => (
                <th
                  key={j}
                  className={cn(
                    "whitespace-nowrap px-2.5 py-2 font-semibold",
                    direita(c.tipo) ? "text-right" : "text-left",
                  )}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l, i) => (
              <tr key={i} className="border-t odd:bg-muted/30">
                {l.map((v, j) => (
                  <td
                    key={j}
                    className={cn(
                      "max-w-[260px] px-2.5 py-1.5 align-top",
                      direita(colunas[j]?.tipo) && "whitespace-nowrap text-right tabular-nums",
                    )}
                  >
                    {textoCelula(v, colunas[j]?.tipo)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {s.totais && (
            <tfoot className="sticky bottom-0 bg-secondary font-semibold text-primary">
              <tr>
                {s.totais.map((v, j) => (
                  <td
                    key={j}
                    className={cn(
                      "px-2.5 py-2",
                      direita(colunas[j]?.tipo) && "whitespace-nowrap text-right tabular-nums",
                    )}
                  >
                    {textoCelula(v, colunas[j]?.tipo)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {linhas.length > LIMITE_LINHAS && (
        <p className="border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Mostrando {LIMITE_LINHAS} de {linhas.length} linhas. O PDF e o Excel trazem todas.
        </p>
      )}
    </div>
  );
}
