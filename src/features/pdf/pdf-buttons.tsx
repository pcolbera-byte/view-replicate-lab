import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { baixarPdf, type Relatorio } from "@/lib/relatorio/exportar";
import { pdfApolice, pdfCliente, pdfEndosso } from "./documentos";

function BotaoPdf({
  gerar,
  label = "PDF",
  testId,
  compacto,
}: {
  gerar: () => Relatorio | null;
  label?: string;
  testId?: string;
  compacto?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={compacto ? "ghost" : "outline"}
      className={compacto ? "h-8 px-2 text-xs" : undefined}
      title="Gerar PDF"
      disabled={busy}
      data-testid={testId}
      onClick={async () => {
        const r = gerar();
        if (!r) return;
        setBusy(true);
        try {
          await baixarPdf(r);
        } catch (e) {
          console.error(e);
          toast.error("Não foi possível gerar o PDF.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <FileText />} {label}
    </Button>
  );
}

export function PdfApoliceButton({ apoliceId }: { apoliceId: string }) {
  const { ws, get } = useWorkspace();
  return (
    <BotaoPdf
      testId="pdf-apolice"
      gerar={() => {
        const a = get.apolice(apoliceId);
        return a ? pdfApolice({ ws, get }, a) : null;
      }}
    />
  );
}

export function PdfClienteButton({ clienteId }: { clienteId: string }) {
  const { ws, get } = useWorkspace();
  return (
    <BotaoPdf
      testId="pdf-cliente"
      label="Ficha em PDF"
      gerar={() => pdfCliente({ ws, get }, clienteId)}
    />
  );
}

export function PdfEndossoButton({ endossoId }: { endossoId: string }) {
  const { ws, get } = useWorkspace();
  return (
    <BotaoPdf
      compacto
      testId="pdf-endosso"
      gerar={() => {
        const e = ws.endossos.find((x) => x.id === endossoId);
        return e ? pdfEndosso({ ws, get }, e) : null;
      }}
    />
  );
}
