// Notificações internas calculadas a partir da carteira (sem tabela extra, sempre atualizadas).
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import * as Popover from "@radix-ui/react-popover";
import { AlertCircle, Bell, CalendarClock, CircleDollarSign, RefreshCw } from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { installmentStatus, isOpenRenewal, isOpenTask } from "@/lib/domain";
import { daysUntil } from "@/lib/format";

export type Notice = {
  key: string;
  icon: typeof Bell;
  text: string;
  to: string;
  tone: "bad" | "warn" | "info";
};

export function useNotices(): Notice[] {
  const { ws, alertDays } = useWorkspace();
  return useMemo(() => {
    const out: Notice[] = [];
    const renew7 = ws.apolices.filter(
      (a) =>
        isOpenRenewal(a, alertDays) && daysUntil(a.vencimento) >= 0 && daysUntil(a.vencimento) <= 7,
    ).length;
    const expired = ws.apolices.filter(
      (a) => isOpenRenewal(a, alertDays) && daysUntil(a.vencimento) < 0,
    ).length;
    const lateTasks = ws.tarefas.filter(
      (t) =>
        isOpenTask(t) &&
        daysUntil(t.data) < 0 &&
        (!t.responsavel_id || t.responsavel_id === ws.userId || ws.isAdmin),
    ).length;
    const lateInst = ws.parcelas.filter((p) => installmentStatus(p) === "Atrasado").length;
    const staleClaims = ws.sinistros.filter(
      (s) => s.status !== "Finalizado" && daysUntil(s.updated_at.slice(0, 10)) < -7,
    ).length;
    const claimsNoDocs = ws.sinistros.filter(
      (s) => s.status === "Documentação" && !ws.documentos.some((d) => d.sinistro_id === s.id),
    ).length;
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    if (renew7)
      out.push({
        key: "r7",
        icon: RefreshCw,
        tone: "bad",
        to: "/renovacoes",
        text: `${plural(renew7, "apólice vence", "apólices vencem")} nos próximos 7 dias.`,
      });
    if (expired)
      out.push({
        key: "rx",
        icon: RefreshCw,
        tone: "bad",
        to: "/renovacoes",
        text: `${plural(expired, "apólice venceu", "apólices venceram")} sem renovação registrada.`,
      });
    if (lateTasks)
      out.push({
        key: "tl",
        icon: CalendarClock,
        tone: "warn",
        to: "/agenda",
        text: `${plural(lateTasks, "follow-up está atrasado", "follow-ups estão atrasados")}.`,
      });
    if (lateInst)
      out.push({
        key: "pl",
        icon: CircleDollarSign,
        tone: "warn",
        to: "/apolices",
        text: `${plural(lateInst, "parcela em atraso", "parcelas em atraso")}.`,
      });
    if (claimsNoDocs)
      out.push({
        key: "sd",
        icon: AlertCircle,
        tone: "warn",
        to: "/sinistros",
        text: `${plural(claimsNoDocs, "sinistro aguarda", "sinistros aguardam")} documentos.`,
      });
    if (staleClaims)
      out.push({
        key: "ss",
        icon: AlertCircle,
        tone: "info",
        to: "/sinistros",
        text: `${plural(staleClaims, "sinistro precisa", "sinistros precisam")} de atualização.`,
      });
    return out;
  }, [ws, alertDays]);
}

const toneCls = {
  bad: "bg-destructive/10 text-destructive",
  warn: "bg-warning/15 text-[oklch(0.5_0.12_60)]",
  info: "bg-info/10 text-info",
};

export function NotificationBell() {
  const notices = useNotices();
  return (
    <Popover.Root>
      <Popover.Trigger
        className="relative grid size-10 place-items-center rounded-md hover:bg-muted"
        title="Notificações"
      >
        <Bell size={19} />
        {notices.length > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-primary-foreground">
            {notices.length}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(92vw,340px)] rounded-lg border bg-card p-2 shadow-xl"
        >
          <p className="px-3 pb-2 pt-2 font-display text-sm font-bold">Notificações</p>
          {notices.length ? (
            notices.map((n) => (
              <Popover.Close asChild key={n.key}>
                <Link
                  to={n.to}
                  className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-muted"
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-md ${toneCls[n.tone]}`}
                  >
                    <n.icon size={14} />
                  </span>
                  <span className="text-sm">{n.text}</span>
                </Link>
              </Popover.Close>
            ))
          ) : (
            <p className="px-3 pb-4 text-sm text-muted-foreground">Nada pendente. Tudo em dia!</p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
