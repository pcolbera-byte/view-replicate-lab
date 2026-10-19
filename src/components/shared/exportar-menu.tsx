import { useState } from "react";
import { Download, Eye, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { baixarExcel, baixarPdf, type Relatorio } from "@/lib/relatorio/exportar";
import { RelatorioPreview } from "./relatorio-preview";

/** Botão "Exportar": ver na tela, PDF ou Excel de um relatório montado na hora. */
export function ExportarMenu({
  gerar,
  label = "Exportar",
  disabled,
  size = "default",
  variant = "outline",
  testId,
}: {
  gerar: () => Relatorio;
  label?: string;
  disabled?: boolean;
  size?: "default" | "sm";
  variant?: "outline" | "default" | "ghost";
  testId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [previa, setPrevia] = useState<Relatorio | null>(null);
  const exportar = async (tipo: "pdf" | "xlsx") => {
    setBusy(true);
    try {
      const r = gerar();
      if (tipo === "pdf") await baixarPdf(r);
      else baixarExcel(r);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o arquivo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} disabled={disabled || busy} data-testid={testId}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />} {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              try {
                setPrevia(gerar());
              } catch (e) {
                console.error(e);
                toast.error("Não foi possível montar o relatório.");
              }
            }}
            data-testid={testId && `${testId}-ver`}
          >
            <Eye /> Ver na tela
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void exportar("pdf")}
            data-testid={testId && `${testId}-pdf`}
          >
            <FileText /> PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void exportar("xlsx")}
            data-testid={testId && `${testId}-xlsx`}
          >
            <FileSpreadsheet /> Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RelatorioPreview relatorio={previa} onClose={() => setPrevia(null)} />
    </>
  );
}
