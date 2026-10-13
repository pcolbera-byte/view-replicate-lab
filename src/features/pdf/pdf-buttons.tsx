import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { baixarPdf, type Relatorio } from "@/lib/relatorio/exportar";
import { pdfApolice, pdfCliente } from "./documentos";

function BotaoPdf({
  gerar,
  label = "PDF",
  testId,
}: {
  gerar: () => Relatorio | null;
  label?: string;
  testId?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
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
