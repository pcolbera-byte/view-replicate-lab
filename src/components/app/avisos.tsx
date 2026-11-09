// Faixas no topo do app: modo consulta sem internet e lembrete de backup.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DatabaseBackup, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/app/workspace-context";
import { baixarConsultaOffline } from "@/lib/backup/consulta-offline";
import { adiarLembrete, aoMudarBackup, marcarBackup, precisaLembrar } from "@/lib/backup/lembrete";
import { dateTimeBR } from "@/lib/format";
import { isNativeApp } from "@/lib/native";

export function OfflineBanner() {
  const { ws, refresh } = useWorkspace();
  if (!ws.offlineDesde) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100 sm:px-6"
      data-testid="modo-offline"
    >
      <WifiOff size={14} className="shrink-0" />
      <span>
        <strong>Sem conexão: modo consulta.</strong> Você está vendo os dados guardados neste
        computador em {dateTimeBR(ws.offlineDesde)}. Alterações ficam bloqueadas até a conexão
        voltar.
      </span>
      <button type="button" onClick={() => void refresh()} className="font-semibold underline">
        Tentar reconectar
      </button>
    </div>
  );
}

export function BackupLembrete() {
  const { ws } = useWorkspace();
  const empresa = ws.empresa.id;
  const [lembrete, setLembrete] = useState(() => precisaLembrar(empresa));
  useEffect(() => {
    const atualizar = () => setLembrete(precisaLembrar(empresa));
    atualizar();
    const t = window.setInterval(atualizar, 60 * 60_000);
    const parar = aoMudarBackup(atualizar);
    return () => {
      window.clearInterval(t);
      parar();
    };
  }, [empresa]);
  if (!ws.isAdmin || ws.offlineDesde || isNativeApp() || !lembrete) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-xs font-medium sm:px-6"
      data-testid="lembrete-backup"
    >
      <DatabaseBackup size={14} className="shrink-0 text-primary" />
      <span>
        {lembrete.nunca
          ? "Você ainda não fez nenhum backup neste computador."
          : `Seu último backup foi há ${lembrete.dias} dia(s).`}{" "}
        Baixe uma cópia para não perder nada em caso de imprevisto.
      </span>
      <button
        type="button"
        className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground"
        data-testid="lembrete-baixar"
        onClick={() => {
          baixarConsultaOffline(ws);
          marcarBackup(empresa);
          toast.success("Backup baixado. Guarde o arquivo em local seguro.");
        }}
      >
        Baixar backup agora
      </button>
      <button
        type="button"
        className="underline"
        onClick={() => adiarLembrete(empresa)}
        data-testid="lembrete-adiar"
      >
        Lembrar amanhã
      </button>
      <Link
        to="/configuracoes"
        search={{ aba: "backup" }}
        className="text-muted-foreground underline"
      >
        Configurar
      </Link>
    </div>
  );
}
